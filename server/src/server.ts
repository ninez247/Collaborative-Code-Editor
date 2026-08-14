import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();

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

wss.on("connection", (socket) => {
  console.log("A user connected through WebSocket");

  socket.send("Welcome to CodeTogether!");

  socket.on("message", (message) => {
  console.log("Received:", message.toString());

  wss.clients.forEach((client) => {
    if (client !== socket && client.readyState === 1) {
      client.send(message.toString());
    }
  });
});

  socket.on("close", () => {
    console.log("A user disconnected");
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});