import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

function App() {
  const socketRef = useRef<WebSocket | null>(null);

  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [roomActivity, setRoomActivity] = useState("");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000/?roomId=ABC123");

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
      </div>

      <div style={{ padding: "10px 20px", backgroundColor: "#252526",
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

      <Editor
        height="calc(100% - 180px)"
        defaultLanguage="cpp"
        defaultValue={`#include <iostream>
using namespace std;

int main() {
    return 0;
}`}
        theme="vs-dark"
      />
    </div>
  );
}

export default App;