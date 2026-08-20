import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { BrowserRouter, Routes, Route, useParams, useNavigate, isRouteErrorResponse } from "react-router-dom";

type Question = {
  id: string;
  title: string;
  description: string;
  difficulty: String;
};

function Home() {
  const navigate = useNavigate();
  const [roomId] = useState("");
  const createRoom = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/rooms", {
        method: "POST"
      });

      const data = await response.json();

      navigate(`/room/${data.roomId}`);
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  return (
    <div>
      <h1>CodeTogether</h1>

      <button onClick={createRoom}>
        Create Interview
      </button>

      {roomId && (
        <div>
          Room ID: {roomId}
        </div>
      )}
    </div>
  );
}

function InterviewRoom() {
  const socketRef = useRef<WebSocket | null>(null);
  const isRemoteUpdate = useRef(false);
  const { roomId } = useParams();
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [roomActivity, setRoomActivity] = useState("");
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    return 0;
}`);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = 
    useState<Question | null>(null);
  useEffect(() => {
    if (!roomId) {
      return;
    }

    const socket = new WebSocket(`ws://localhost:3000/?roomId=${roomId}`);

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      setConnectionStatus("Connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "user_joined") {
          console.log("A new user joined the room");
          setRoomActivity("🟢 A new user joined the room");
        }

        if (data.type === "user_left") {
          console.log("A user left the room");
          setRoomActivity("🔴 A user left the room");
        }

        if (data.type === "code_change") {
          console.log("Received code:", data.code);

          isRemoteUpdate.current = true;

          setCode(data.code);
        }

        if (data.type === "question_change") {
          console.log("Received question:", data.question.title);

          setSelectedQuestion(data.question);
        }

      } catch {
        setReceivedMessages((previousMessages) => [
          ...previousMessages, event.data
        ]);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnectionStatus("Disconnected");
    };

    socket.onerror = () => {
      console.log("WebSocket error");
      setConnectionStatus("Connection error");
    };

    return () => {
      socket.close();
    };
  }, [roomId]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response =await fetch("http://localhost:3000/api/questions");

        const data = await response.json();

        setQuestions(data);
      } catch {
        console.error("Failed to fetch questions:",Error);
      }
    };

    fetchQuestions();
  }, []);

  const sendMessage = () => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      message.trim() !== ""
    ) {
      socketRef.current.send(message);

      setMessage("");
    }
  };

  return (
    <div style={{ height: "100vh", backgroundColor: "#1e1e1e" }}>
      <div
        style={{
          height: "50px",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          color: "white",
          gap: "20px"
        }}
      >
        <strong>CodeTogether</strong>

        <span>
          WebSocket: {connectionStatus}
        </span>

        <span>
          Room: {roomId}
        </span>
      </div>

      <div style={{
        padding: "10px 20px", backgroundColor: "#252526",
        color: "white"
      }}
      >
        {roomActivity}
      </div>

      <div style={{ padding: "10px", color: "white" }}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a message"
        />

        <button onClick={sendMessage}>
          Send
        </button>

        <div style={{ marginTop: "10px" }}>
          {receivedMessages.map((msg, index) => (
            <div key={index}>
              {msg}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 20px", color: "white"}}>
        <h3>Select Interview Question</h3>

        <select 
          value={selectedQuestion?.id ?? ""}
          onChange={(event)=> {
            const question = questions.find(
              (question) => question.id === event.target.value
            );

            setSelectedQuestion(question ?? null);

            if (
              question &&
              socketRef.current &&
              socketRef.current.readyState === WebSocket.OPEN
            ) {
              socketRef.current.send(
                JSON.stringify({
                  type: "question_change",
                  question
                })
              );
            }
          }}
          >
            <option value="">
              Select a question
            </option>

            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.title}
              </option>
            ))}
          </select>  
      </div>

      {selectedQuestion && (
        <div style={{ marginTop: "15px"}}>
          <h3>{selectedQuestion.title}</h3>

          <p>{selectedQuestion.description}</p>

          <p>
            Difficulty: {selectedQuestion.difficulty}
          </p>
        </div>
      )}

      <Editor
        height="calc(100% - 180px)"
        defaultLanguage="cpp"
        value={code}
        theme="vs-dark"

        onChange={(value) => {

          if (value !== undefined) {
            setCode(value);

            if (isRemoteUpdate.current) {
              isRemoteUpdate.current = false;
              return;
            }

            if (
              socketRef.current &&
              socketRef.current.readyState === WebSocket.OPEN
            ) {
              socketRef.current.send(
                JSON.stringify({
                  type: "code_change",
                  code: value
                })
              );
            }
          }
        }}
      />
    </div>
  );
}
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/room/:roomId"
          element={<InterviewRoom />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;