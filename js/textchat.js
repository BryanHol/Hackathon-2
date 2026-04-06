/*
Author: David Caudron
Purpose: Basic text chat functionality
Instructor: FUCK YOU KIDNEY!
Filename: textchat.js
*/

// Listener wrapper to ensure page is loaded before trying to find content
document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("sendButton");
    const chatHistory = document.getElementById("chatHistory");
    const chatInput = document.getElementById("chatInput");
    const usernameInput = document.getElementById("usernameInput");
    const saveUsernameButton = document.getElementById("saveUsernameButton");
    const savedUsername = sessionStorage.getItem("savedUsername");
    const socket = window.ensureCollabSocket();
    let username = savedUsername || "Anonymous";

    if (savedUsername) {
        updateDisplayName();
        usernameInput.style.display = "none";
        saveUsernameButton.style.display = "none";
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

    function sendMessage() {
        const messageText = chatInput.value.trim();

        if (messageText !== "") {
            window.sendCollabMessage({
                type: "chat_message",
                room: window.getCollabRoomName(),
                client_id: localStorage.getItem("clientId") || "",
                username: username || "Anonymous",
                text: messageText
            });

            chatInput.value = "";
        }
    }

    function saveUsername() {
        const name = usernameInput.value.trim();

        if (name !== "") {
            username = name;
            sessionStorage.setItem("savedUsername", username);
            updateDisplayName();

            document.getElementById("usernameInput").style.display = "none";
            document.getElementById("saveUsernameButton").style.display = "none";

            window.sendCollabMessage({
                type: "set_username",
                room: window.getCollabRoomName(),
                client_id: localStorage.getItem("clientId") || "",
                username: username
            });
        }
    }

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

    sendButton.addEventListener("click", sendMessage);
    saveUsernameButton.addEventListener("click", saveUsername);

    chatInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
            chatInput.focus();
        }
    });

    usernameInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            saveUsername();
        }
    });
});