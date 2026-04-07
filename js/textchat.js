/*
Author: David Caudron
Team Members: Peter Ursem, Bryan Holl, Andrea Restrepo
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
    const savedUsername = localStorage.getItem("savedUsername");
    //let username;
    
    // Message object
    window.message = class {
        constructor(text) {
            this.sender = window.user.username;
            this.team = window.user.team;
            this.text = text;
            this.timeStamp = getTimeStamp();
        }       
    };


    if (savedUsername) {
        //username = savedUsername;
        window.user.username = savedUsername;
        updateDisplayName();
    } 

    // Function to create a message JSON object
    /*function createMessageJSON(messageText, username, timeStamp) {
        const messageObject = {
            type: "message", // could be used for server / socket routing
            messageText: messageText,
            username: username,
            timeStamp: timeStamp
            
        };
        return messageObject;
    }*/
    
    // Function to show message to chat history
    //function showMessage(messageText, username, timeStamp) {
    //window.showMessage = function(messageText, username, timeStamp) {
    window.showMessage = function(message) {
        // Format construct message to embed into DOM
        const messageElement = document.createElement("div"); // create element for the message 
        messageElement.classList.add("chatMessage"); // base class for css styling
        
        // Additional styling if user is the owner of the message or part of a team
        if (message.sender == window.user.username) {
            messageElement.classList.add('messageOwner');
        }
        if (message.team) {
            messageElement.classList.add(`messageTeam-${message.team}`);
        }
        
        // Construct element
        messageElement.innerHTML = `
            <span class="timeStamp">${message.timeStamp}</span>
            <strong>${message.sender}:</strong>
            <span class="text">${message.text}</span>
        `;
        
        // append message element as child to chatHistory container
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = history.scrollHeight; // auto-scroll to bottom so messge visible
            
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
        const text = chatInput.value.trim();
        //const timeStamp = getTimeStamp();
    
        if (text !== "") { // prevent empty message

            // Create Message Object
            //const messageJSON = createMessageJSON(messageText, username, timeStamp);
            //const messageJSON = createMessageJSON(messageText, window.user.username, timeStamp);
            const message = new window.message(text);

            // Display message in chat history
            //showMessage(messageText, username, timeStamp);
            //showMessage(messageText, window.user.username, timeStamp);
            showMessage(message);


            // Send message object to server
            //sendJSON(messageJSON);
            window.sendPacket("messaage", message);

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
        if (name != "") {
            //username = name;
            window.user.username = name;
            //localStorage.setItem("savedUsername", username);
            localStorage.setItem("savedUsername", name);
            updateDisplayName();

            //alert("Username set to: " + username); // optionally alert for user
            document.getElementById("usernameInput").style.display = 'none'; // optionally hide username input once saved
            document.getElementById("saveUsernameButton").style.display = 'none'; // optionally hide username save button once saved
            
            console.log("Username saved as:", window.user.username);
        }
    }

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
            const displayName = document.getElementById("usernameDisplay");
            //displayName.textContent = username;
            displayName.textContent = window.user.username;
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