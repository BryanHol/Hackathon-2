/*
Author: David Caudron
Purpose: Basic text chat functionality
Instructor: FUCK YOU KIDNEY!
Filename: textchat.js
*/

if (!window.getCollabRoomName) {
    window.getCollabRoomName = function () {
        return new URLSearchParams(window.location.search).get("room") || "main";
    };

    window.ensureCollabSocket = function () {
        if (!window.collabSocket || window.collabSocket.readyState === WebSocket.CLOSED) {
            window.collabSocket = new WebSocket("ws://127.0.0.1:8765");

            window.collabSocket.addEventListener("open", () => {
                window.collabSocket.send(JSON.stringify({
                    type: "join_room",
                    room: window.getCollabRoomName(),
                    client_id: localStorage.getItem("clientId") || "",
                    username: localStorage.getItem("savedUsername") || "Anonymous"
                }));
            });
        }

        return window.collabSocket;
    };

    window.sendCollabMessage = function (payload) {
        const socket = window.ensureCollabSocket();

        socket.addEventListener("open", () => {
            console.log("WebSocket connected");
        });

socket.addEventListener("close", (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
});

socket.addEventListener("error", () => {
    console.log("WebSocket error");
});

socket.addEventListener("message", (event) => {
    console.log("Raw WebSocket message:", event.data);
});

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            console.log("WebSocket is not open yet.");
        }
    };
}

// Listener wrapper to ensure page is loaded before trying to find content
document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("sendButton");
    const chatHistory = document.getElementById("chatHistory");
    const chatInput = document.getElementById("chatInput");
    const usernameInput = document.getElementById("usernameInput");
    const saveUsernameButton = document.getElementById("saveUsernameButton");
    const savedUsername = localStorage.getItem("savedUsername");
    const socket = window.ensureCollabSocket();
    let username = savedUsername || "Anonymous";

    if (savedUsername) {
        updateDisplayName();
        usernameInput.style.display = 'none';
        saveUsernameButton.style.display = 'none';
    }

    socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data);

        if (payload.type === "user_registered" && payload.user && payload.user.client_id) {
            localStorage.setItem("clientId", payload.user.client_id);
            return;
        }

        if (payload.type === "init_state") {
            chatHistory.innerHTML = "";
            for (const message of payload.state.messages) {
                appendChatMessage(message);
            }
            return;
        }

        if (payload.type === "chat_message") {
            appendChatMessage(payload.message);
        }
    });

    function appendChatMessage(message) {
        const newMessage = document.createElement("div");
        newMessage.className = "chatMessage";
        newMessage.innerHTML = `
            <span class="timeStamp">${message.time}</span>
            <strong>${message.username}:</strong>
            <span class="text">${message.text}</span>
        `;

        chatHistory.appendChild(newMessage);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Message handling function
    function sendMessage() {
        const messageText = chatInput.value.trim();

        if (messageText !== "") { // prevent empty message
            window.sendCollabMessage({
                type: "chat_message",
                room: window.getCollabRoomName(),
                client_id: localStorage.getItem("clientId") || "",
                username: username || "Anonymous",
                text: messageText
            });

            chatInput.value = ""; // clear input box after send
        }
    }

    // Function to save username
    function saveUsername() {
        const name = usernameInput.value.trim();
        if (name != "") {
            username = name;
            localStorage.setItem("savedUsername", username);
            updateDisplayName();

            document.getElementById("usernameInput").style.display = 'none';
            document.getElementById("saveUsernameButton").style.display = 'none';

            window.sendCollabMessage({
                type: "set_username",
                room: window.getCollabRoomName(),
                client_id: localStorage.getItem("clientId") || "",
                username: username
            });
        }
    }

    // Function to get the current time and convert it to time stamp for chat message
    function getTimeStamp() {
        const time = new Date();
        const timeStamp = time.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
        return timeStamp;
    }

    // Function to update the username display
    function updateDisplayName() {
        const displayName = document.getElementById("usernameDisplay");
        let savedUsernameLabel = document.getElementById("savedUsernameLabel");

        if (!savedUsernameLabel) {
            savedUsernameLabel = document.createElement("span");
            savedUsernameLabel.id = "savedUsernameLabel";
            displayName.appendChild(savedUsernameLabel);
        }

        savedUsernameLabel.textContent = username;
    }

    // Trigger on click
    sendButton.addEventListener("click", sendMessage);
    saveUsernameButton.addEventListener("click", saveUsername);

    // Trigger on enter key
    chatInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
            chatInput.focus(); // return focus to input box after send
        }
    });
    usernameInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            saveUsername();
        }
    });
});