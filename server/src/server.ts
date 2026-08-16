import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const rooms = new Map<string, Set<WebSocket>>();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "CodeTogether backend is running"
  });
});

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost:3000");

  const roomId = url.searchParams.get("roomId");

  console.log("User wants to join room:", roomId);

  if(!roomId) {
    socket.close();
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId)!;

  room.add(socket);

  room.forEach((client) => {
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

  currentRoom.forEach((client) => {
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

    currentRoom.delete(socket);

    console.log(`User left room ${roomId}`);

    currentRoom.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "user_left"
          })
        );
      }
    });

    if (currentRoom.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted`);
    }
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});