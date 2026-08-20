import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";

function generateRoomId(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const app = express();

type Room = {
  clients: Set<WebSocket>;
  code: string;
};

const rooms = new Map<string, Room>();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "CodeTogether backend is running"
  });
});

app.post("/api/rooms", (req, res) => {
  const roomId = generateRoomId();

  rooms.set(roomId, {
    clients: new Set(),
    code: `#include <iostream>
    using namespace std;
    
    int main() {
      return 0;
    }`
  });

  res.json({
    roomId
  });
});

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost:3000");

  const roomId = url.searchParams.get("roomId");

  console.log("User wants to join room:", roomId);

  if (!roomId) {
    socket.close();
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      code: `#include <iostream>
using namespace std;

int main() {
    return 0;
}`
  });
  }

  const room = rooms.get(roomId)!;

  room.clients.add(socket);

  socket.send(
    JSON.stringify({
      type: "code_change",
      code: room.code
    })
  );

  room.clients.forEach((client) => {
    if (client !== socket && client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "user_joined"
        })
      );
    }
  });

  console.log(`User joined room ${roomId}`);

  socket.send("Welcome to CodeTogether!");

  socket.on("message", (message) => {
    console.log(`Message in room ${roomId}:`, message.toString());

    const currentRoom = rooms.get(roomId);

    if (!currentRoom) {
      return;
    }

    try {
      const data = JSON.parse(message.toString());

      if (data.type === "code_change") {
        currentRoom.code = data.code;
        console.log("Current room code updated.");
      }
    } catch {
      console.log("Received non-JSON message");
    }

    currentRoom.clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  socket.on("close", () => {
    const currentRoom = rooms.get(roomId);

    if (!currentRoom) {
      return;
    }

    currentRoom.clients.delete(socket);

    console.log(`User left room ${roomId}`);

    currentRoom.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "user_left"
          })
        );
      }
    });

    if (currentRoom.clients.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted`);
    }
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});