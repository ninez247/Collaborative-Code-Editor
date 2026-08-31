import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";

const languages = [
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" }
];

type Question = {
  id: string;
  title: string;
  description: string;
  difficulty: String;
};

function Home() {
  const [roomId] = useState("");
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const createRoom = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/rooms", {
        method: "POST"
      });

      const data = await response.json();

      navigate(`/room/${data.roomId}?role=interviewer`);
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };
  const joinRoom = () => {
    if (joinRoomId.trim() === "") {
      return;
    }
    navigate(`/room/${joinRoomId.trim()}?role=candidate`);
  }

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

      <div style={{ marginTop: "20px" }}>
        <input
          value={joinRoomId}
          onChange={(event) => setJoinRoomId(event.target.value)}
          placeholder="Enter Room ID"
        />

        <button onClick={joinRoom}>
          Join Interview
        </button>
      </div>
    </div>
  );
}

function InterviewRoom() {
  const socketRef = useRef<WebSocket | null>(null);
  const isRemoteUpdate = useRef(false);
  const { roomId } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const role = searchParams.get("role");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [roomActivity, setRoomActivity] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    return 0;
}`);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] =
    useState<Question | null>(null);
  useEffect(() => {
    if (!roomId) {
      return;
    }
    const socket = new WebSocket(`ws://localhost:3000/?roomId=${roomId}&role=${role}`);

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

        if (data.type === "language_change") {
          console.log("Received language:", data.language);

          setLanguage(data.language);

          isRemoteUpdate.current = true;

          setCode(data.code);
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
  }, [roomId, role]);

  useEffect(() => {
    if(timeLeft<=0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) => previousTime -1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft/60);
  const seconds = timeLeft%60;

  const formattedTime = 
    `${minutes.toString().padStart(2, "0")}:` +
    `${seconds.toString().padStart(2, "0")}`;

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/questions");

        const data = await response.json();

        setQuestions(data);
      } catch {
        console.error("Failed to fetch questions:", Error);
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

  const runCode = async () => {

    if (isRunning) {
      return;
    }

    try {
      setIsRunning(true);
      setOutput("Running...");

      const response = await fetch("http://localhost:3000/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code, language, stdin: input
        })
      });

      const data = await response.json();

      console.log("Run result:", data);

      if (data.status === "Accepted") {
        setOutput(data.output || "Program finished successfully.");
      } else {
        setOutput(data.output || data.error || "");
      }
    } catch (error) {
      console.error("Failed to run code:", error);
      setOutput("Failed to connect to the code execution server.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      height: "100vh", backgroundColor: "#1e1e1e",
      overflow: "auto"
    }}>
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

        <span>
          Role: {role}
        </span>

        <span
        style={{
          marginLeft: "auto",
          fontWeight: "bold",
          fontSize: "18px"
        }}
        >
          ⏱ {formattedTime}
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

      <div style={{ padding: "10px 20px", color: "white" }}>
        {role === "interviewer" && (
          <>
            <h3>Select Language</h3>
            <select
              value={language}
              onChange={(event) => {
                const newLanguage = event.target.value;

                setLanguage(newLanguage);

                if (
                  socketRef.current &&
                  socketRef.current.readyState === WebSocket.OPEN
                ) {
                  socketRef.current.send(
                    JSON.stringify({
                      type: "language_change",
                      language: newLanguage
                    })
                  );
                }
              }}
            >
              {languages.map((languageOption) => (
                <option
                  key={languageOption.value}
                  value={languageOption.value}
                >
                  {languageOption.label}
                </option>
              ))}
            </select>

            <h3>Select Interview Question</h3>

            <select
              value={selectedQuestion?.id ?? ""}
              onChange={(event) => {
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
          </>
        )}

        <div
          style={{
            display: "flex",
            gap: "20px",
            padding: "20px",
            width: "100%",
            boxSizing: "border-box",
            alignItems: "stretch"
          }}
        >
          {/* Question Panel */}
          <div
            style={{
              flex: "0 0 30%",
              height: "fit-content",
              backgroundColor: "#252526",
              color: "white",
              padding: "20px",
              borderRadius: "8px",
              boxSizing: "border-box",
              overflowY: "auto",
              minWidth: 0
            }}
          >
            {selectedQuestion ? (
              <>
                <h2>{selectedQuestion.title}</h2>

                <p>{selectedQuestion.description}</p>

                <p>
                  <strong>Difficulty:</strong>{" "}
                  {selectedQuestion.difficulty}
                </p>
              </>
            ) : (
              <p>Select an interview question to begin.</p>
            )}
          </div>

          {/* Code Editor */}
          <div
            style={{
              flex: "1",
              minWidth: 0,
              height: "460px",
              borderRadius: "8px",
              overflow: "auto"
            }}
          >
            <Editor
              height="460px"
              language={language}
              value={code}
              theme="vs-dark"
              onChange={(value) => {
                if (isRemoteUpdate.current) {
                  isRemoteUpdate.current = false;
                  return;
                }

                setCode(value ?? "");

                if (
                  socketRef.current &&
                  socketRef.current.readyState === WebSocket.OPEN
                ) {
                  socketRef.current.send(
                    JSON.stringify({
                      type: "code_change",
                      code: value ?? ""
                    })
                  );
                }
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            marginLeft: "20px",
            marginRight: "20px",
            padding: "10px",
            backgroundColor: "#1e1e1e",
            color: "white",
            borderRadius: "8px",
            boxSizing: "border-box"
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: "10px"
            }}
          >
            Input
          </h3>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter program input here..."
            style={{
              width: "100%",
              height: "100px",
              backgroundColor: "#1e1e1e",
              color: "white",
              padding: "10px",
              border: "1px solid #444",
              borderRadius: "5px",
              boxSizing: "border-box",
              resize: "vertical"
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              margin: "20px 0"
            }}
          >
            <button
              onClick={runCode}
              disabled={isRunning}
              style={{
                padding: "10px 25px",
                fontSize: "15px",
                cursor: isRunning ? "not-allowed" : "pointer"
              }}
            >
              {isRunning ? "Running..." : "▶ Run Code"}
            </button>
          </div>

          <h3
            style={{
              marginBottom: "10px"
            }}
          >
            Output
          </h3>

          <pre
            style={{
              minHeight: "100px",
              margin: 0,
              padding: "10px",
              backgroundColor: "1e1e1e",
              border: "1px, solid #444",
              borderRadius: "5px",
              whiteSpace: "pre-wrap",
              overflow: "auto"
            }}
          >
            {output || "Program output will appear here..."}
          </pre>
        </div>
      </div>
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