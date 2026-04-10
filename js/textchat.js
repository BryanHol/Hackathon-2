/*
Author: David Caudron
Team Members: Peter Ursem, Bryan Holl, Andrea Restrepo
Purpose: Basic text chat functionality
Instructor: FUCK YOU KIDNEY!
Filename: textchat.js
*/

//import {sendJSON} from './sockets.js'; - requires modules which requires server hosting of html

// Listener wrapper to ensure page is loaded before trying to find content
document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("sendButton");
    const chatHistory = document.getElementById("chatHistory");
    const chatInput = document.getElementById("chatInput");
    const usernameInput = document.getElementById("usernameInput");
    const saveUsernameButton = document.getElementById("saveUsernameButton");
    const savedUsername = sessionStorage.getItem("savedUsername");
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
            <span class="sender">${message.sender}:</span>
            <span class="text">${message.text}</span>
        `;
        
        // append message element as child to chatHistory container
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = history.scrollHeight; // auto-scroll to bottom so messge visible
            
    }

    // Message handling function
    function sendMessage() {
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
            window.sendPacket("message", message);

            chatInput.value = ""; // clear input box after send
        }
    }

    // Function to save username
    function saveUsername() {
        const name = usernameInput.value.trim();
        if (name != "") {
            //username = name;
            window.user.username = name;
            //sessionStorage.setItem("savedUsername", username);
            sessionStorage.setItem("savedUsername", name);
            updateDisplayName();

            //alert("Username set to: " + username); // optionally alert for user
            document.getElementById("usernameInput").style.display = 'none'; // optionally hide username input once saved
            document.getElementById("saveUsernameButton").style.display = 'none'; // optionally hide username save button once saved
            
            console.log("Username saved as:", window.user.username);
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
            //displayName.textContent = username;
            displayName.textContent = window.user.username;
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