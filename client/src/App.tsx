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
  difficulty: string;
  category: string;
};

type ChatMessage = {
  message: string;
  sender: string;
};

function Home() {
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "30px"
      }}
    >
      <h1>CodeTogether</h1>

      <div>
        <h2>Create an Interview</h2>

        <button onClick={createRoom}>
          Create Interview
        </button>
      </div>

      <div>
        <h2>Join an Interview</h2>

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
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const role = searchParams.get("role");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<ChatMessage[]>([]);
  const [roomActivity, setRoomActivity] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    return 0;
}`);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copyNotification, setCopyNotification] = useState(false);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerStartedAt, setTimeStartedAt] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] =
    useState<Question | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const categories = [
    "All",
    ...Array.from(
      new Set(questions.map((question) => question.category))
    )
  ];

  const difficulties = [
    "All",
    ...Array.from(
      new Set(questions.map((question) => question.difficulty))
    )
  ];

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

        if (data.type === "timer_sync") {
          setTimeStartedAt(data.timerStartedAt);

          setElapsedTime(
            Math.floor(
              (Date.now() - data.timerStartedAt) / 1000
            )
          );
        }

        if (data.type === "interview_ended") {
          setTimeStartedAt(null);
        }

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

        if (data.type === "chat_message") {
          setReceivedMessages((previousMessages) => [
            ...previousMessages,
            {
              message: data.message,
              sender: data.sender
            }
          ]);
        }

        if (data.type === "room_error") {
          alert(data.message);
          navigate("/");
          return;
        }

      } catch {
        console.error("Invalid WebSocket message:", event.data);
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
    if (timerStartedAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - timerStartedAt) / 1000
      );

      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerStartedAt]);

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

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

  const filteredQuestions = questions.filter((question) => {
    const matchesCategory =
      categoryFilter === "All" ||
      question.category === categoryFilter;

    const matchesDifficulty =
      difficultyFilter === "All" ||
      question.difficulty === difficultyFilter;

    return matchesCategory && matchesDifficulty;
  });

  const sendMessage = () => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      message.trim() !== ""
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "chat_message",
          message: message.trim(),
          sender: role
        })
      );

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
      <style>
        {`
    .interview-workspace {
      display: flex;
      gap: 20px;
      padding: 20px;
      width: 100%;
      box-sizing: border-box;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .interview-workspace {
        flex-direction: column;
      }

      .interview-question,
      .interview-editor,
      .interview-chat {
        flex: none !important;
        width: 100% !important;
      }

      .interview-question {
        height: fit-content !important;
      }

      .interview-editor,
      .interview-chat {
        height: 460px !important;
      }
    }
  `}
      </style>
      <div
        style={{
          height: "60px",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          backgroundColor: "#252526",
          color: "white",
          gap: "24px",
          borderBottom: "1px solid #3a3a3a",
          boxSizing: "border-box"
        }}
      >
        <strong>CodeTogether</strong>

        <span>
          WebSocket: {connectionStatus}
        </span>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap"
          }}  
        >
          Room: {roomId}
          <button
            onClick={() => {
              if (roomId) {
                navigator.clipboard.writeText(roomId);
                setCopyNotification(true);

                setTimeout(() => {
                  setCopyNotification(false);
                }, 2000);
              }
            }}
            style={{ flexShrink: 0 }}
          >
            Copy
          </button>
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

      {copyNotification && (
        <div
          style={{
            padding: "8px 20px",
            backgroundColor: "#252526",
            color: "white"
          }}
        >
          Room ID copied!
        </div>
      )}

      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "10px 20px"
      }}
      >
        <button onClick={() => setIsChatOpen(!isChatOpen)}>
          {isChatOpen ? "Close Chat" : "Open Chat"}
        </button>
      </div>

      <div style={{ padding: "10px 20px", color: "white" }}>
        {role === "interviewer" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  if (
                    socketRef.current &&
                    socketRef.current.readyState === WebSocket.OPEN
                  ) {
                    socketRef.current.send(
                      JSON.stringify({
                        type: "start_interview"
                      })
                    );
                  }
                }}
                disabled={timerStartedAt !== null}
              >
                {timerStartedAt !== null
                  ? "Interview Started"
                  : "Start Interview"}
              </button>

              <button
                onClick={() => {
                  if (
                    socketRef.current &&
                    socketRef.current.readyState === WebSocket.OPEN
                  ) {
                    socketRef.current.send(
                      JSON.stringify({
                        type: "end_interview"
                      })
                    );
                  }
                }}
                disabled={timerStartedAt === null}
              >
                End Interview
              </button>
            </div>

            <div>
              <label>Language: </label>
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
            </div>

            <div>
              <label>Category: </label>
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                }}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Difficulty: </label>
              <select
                value={difficultyFilter}
                onChange={(event) =>
                  setDifficultyFilter(event.target.value)
                }
              >
                {difficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Question: </label>
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
                <option value="" hidden>
                  Select a question
                </option>

                {filteredQuestions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div
          className="interview-workspace"
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
            className="interview-question"
            style={{
              flex: "0 0 30%",
              height: "fit-content",
              backgroundColor: "#252526",
              color: "white",
              padding: "24px",
              borderRadius: "8px",
              boxSizing: "border-box",
              overflowY: "auto",
              minWidth: 0,
              border: "1px solid #3a3a3a"
            }}
          >
            {selectedQuestion ? (
              <>
                <h2
                  style={{
                    margin: 0,
                    marginBottom: "16px",
                    fontSize: "22px"
                  }}
                >
                  {selectedQuestion.title}
                </h2>

                <p
                  style={{
                    lineHeight: "1.6",
                    color: "#d4d4d4",
                    marginBottom: "20px"
                  }}
                >
                  {selectedQuestion.description}
                </p>

                <p style={{ marginBottom: "10px" }}>
                  <strong>Difficulty:</strong>{" "}
                  {selectedQuestion.difficulty}
                </p>

                <p>
                  <strong>Category:</strong>{" "}
                  {selectedQuestion.category}
                </p>
              </>
            ) : (
              <p>Select an interview question to begin.</p>
            )}
          </div>

          {/* Code Editor */}
          <div
            className="interview-editor"
            style={{
              flex: "1",
              minWidth: 0,
              height: "460px",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #3a3a3a",
              boxSizing: "border-box",
              paddingTop: "10px"
            }}
          >
            <Editor
              height="460px"
              language={language}
              value={code}
              theme="vs-dark"
              options={{
                padding: {
                  top: 15
                },
                minimap: {
                  enabled: false
                },
                fontSize: 14,
                tabSize: 4,
                wordWrap: "off"
              }}
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

          {isChatOpen && (
            <div
              className="interview-chat"
              style={{
                flex: "0 0 25%",
                height: "460px",
                backgroundColor: "#252526",
                color: "white",
                padding: "15px",
                overflow: "hidden",
                borderRadius: "8px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: 'column',
                minWidth: 0,
                border: "1px solid #3a3a3a"
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Chat
              </h3>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  marginBottom: "10px",
                  padding: "10px",
                  backgroundColor: "#1e1e1e",
                  borderRadius: "5px"
                }}
              >
                {receivedMessages.map((msg, index) => (
                  <div key={index}
                    style={{
                      marginBottom: "10px",
                      padding: "8px 10px",
                      backgroundColor: "#252526",
                      borderRadius: "5px"
                    }}
                  >
                    <strong>{msg.sender}:</strong>{" "}
                    {msg.message}
                  </div>
                ))}
              </div>

              <div style={{
                display: "flex",
                gap: "10px",
                width: "100%",
                boxSizing: "border-box"
              }}
              >
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "9px 10px",
                    backgroundColor: "#1e1e1e",
                    color: "white",
                    border: "1px solid #444",
                    borderRadius: "5px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />

                <button
                  onClick={sendMessage}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: "20px",
            marginLeft: "20px",
            marginRight: "20px",
            padding: "15px",
            backgroundColor: "#252526",
            color: "white",
            borderRadius: "8px",
            border: "1px solid #3a3a3a",
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
                padding: "10px 28px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: isRunning ? "not-allowed" : "pointer",
                borderRadius: "5px",
                border: "none"
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
              padding: "12px",
              backgroundColor: "#1e1e1e",
              border: "1px solid #444",
              borderRadius: "5px",
              whiteSpace: "pre-wrap",
              overflow: "auto",
              fontFamily: "monospace",
              lineHeight: "1.5",
              boxSizing: "border-box"
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