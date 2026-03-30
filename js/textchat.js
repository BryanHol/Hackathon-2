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
    const savedUsername = localStorage.getItem("savedUsername");
    let username;

    if (savedUsername) {
        username = savedUsername;
        updateDisplayName();
    } 
    

    // Message handling function
    function sendMessage() {
        const messageText = chatInput.value.trim();
        const timeStamp = getTimeStamp();
    
        if (messageText !=="") { // prevent empty message
            const newMessage = document.createElement("div"); // create element for the message 
            newMessage.className = "chatMessage"; // optional class for css styling
            
            // Separated message with tags for separate styling
            newMessage.innerHTML = `
                <span class="timeStamp">${timeStamp}</span>
                <strong>${username}:</strong>
                <span class="text">${messageText}</span>
            `;
            //newMessage.textContent = `${username}: ${messageText}`; // set text content - ** Need backtick not quotes for variable syntax like this! **
            chatHistory.appendChild(newMessage); // append message as child to chatHistory container
            
            chatHistory.scrollTop = history.scrollHeight; // auto-scroll to bottom so messge visible
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

            //alert("Username set to: " + username); // optionally alert for user
            document.getElementById("usernameInput").style.display = 'none'; // optionally hide username input once saved
            document.getElementById("saveUsernameButton").style.display = 'none'; // optionally hide username save button once saved
      
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
            displayName.textContent = username;
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