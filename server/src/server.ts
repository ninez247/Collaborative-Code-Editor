import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";
import "dotenv/config";
import { runCode } from "./services/codeExecution";

function generateRoomId(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const app = express();

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    return 0;
}`;

type Language = "cpp" | "python" | "java" | "javascript";

const languageIds: Record<Language, number> = {
  cpp: 54,
  python: 71,
  java: 62,
  javascript: 63
};

type Room = {
  clients: Set<WebSocket>;
  code: Record<Language, string>;
  selectedQuestion: Question | null;
  language: Language;
};

type Question = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
};

const questions: Question[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description:
      "Given an array of integers and a target, return the indices of two numbers that add up to the target.",
    difficulty: "Easy"
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    description:
      "Write a function that reverses a string.",
    difficulty: "Easy"
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Given a string containing brackets, determine whether the brackets are valid.",
    difficulty: "Easy"
  }
];

const rooms = new Map<string, Room>();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "CodeTogether backend is running"
  });
});

app.get("/api/questions", (req, res) => {
  res.json(questions);
});

app.post("/api/rooms", (req, res) => {
  const roomId = generateRoomId();

  rooms.set(roomId, {
    clients: new Set(),
    code: {
      cpp: DEFAULT_CODE,
      python: "",
      java: "",
      javascript: ""
    },
    selectedQuestion: null,
    language: "cpp"
  });

  res.json({
    roomId
  });
});

app.post("/api/run", async (req, res) => {
  try {
    const { code, language, stdin } = req.body;

    const languageId = languageIds[language as Language];

    if (!languageId) {
      return res.status(400).json({
        status: "error",
        output: "",
        error: "Unsupported Language"
      });
    }

    console.log("Received code to run:", code);
    console.log("Received language:", language);
    console.log("Language ID:", languageId);

    const result = await runCode({
      sourceCode: code,
      languageId,
      stdin
    });

    console.log("Execution result:", result);

    res.json({
      status: result.status,
      output: result.stdout ?? "",
      error:
        result.stderr ??
        result.compileOutput ??
        null
    });

  } catch (error) {
    console.error("Code execution failed:", error);

    res.status(500).json({
      status: "error",
      output: "",
      error: "Failed to execute code"
    });
  }
});

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", "http://localhost:3000");

  const roomId = url.searchParams.get("roomId");

  const role = url.searchParams.get("role");

  if (role !== "interviewer" && role !== "candidate") {
    socket.close();
    return;
  }

  console.log("User wants to join room:", roomId,
    "Role:", role
  );

  if (!roomId) {
    socket.close();
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      code: {
        cpp: DEFAULT_CODE,
        python: "",
        java: "",
        javascript: ""
      },
      selectedQuestion: null,
      language: "cpp"
    });
  }

  const room = rooms.get(roomId)!;

  room.clients.add(socket);

  socket.send(
    JSON.stringify({
      type: "code_change",
      code: room.code[room.language]
    })
  );

  if (room.selectedQuestion) {
    socket.send(
      JSON.stringify({
        type: "question_change",
        question: room.selectedQuestion
      })
    );
  }

  socket.send(
    JSON.stringify({
      type: "language_change",
      language: room.language,
      code: room.code[room.language]
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
        currentRoom.code[currentRoom.language] = data.code;
        console.log("Current room code updated.");
      }

      if (data.type === "question_change") {
        if (role !== "interviewer") {
          console.log("Candidate attempted to change the question");
          return;
        }
        currentRoom.selectedQuestion = data.question;
        console.log(
          "Current question updated:",
          data.question.title
        );
      }

      if (data.type === "language_change") {
        if (role !== "interviewer") {
          console.log("Candidate attempted to change the language");
          return;
        }

        if (
          data.language !== "cpp" &&
          data.language !== "python" &&
          data.language !== "java" &&
          data.language !== "javascript"
        ) {
          console.log("Invalid language:", data.language);
          return;
        }

        currentRoom.language = data.language;

        console.log(
          "Current language updated:",
          data.language
        );

        currentRoom.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "language_change",
                language: currentRoom.language,
                code: currentRoom.code[currentRoom.language]
              })
            );
          }
        });

        return;
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