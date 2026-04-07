/*

    Sockets.js

    Peter Ursem & David Caudron

    Handle live IO from the server and pass data to the chat and canvas handlers.

*/

window.getCollabRoomName = function () {
    return new URLSearchParams(window.location.search).get("room") || "main";
};

window.getCollabSessionId = function () {
    let sessionId = sessionStorage.getItem("collabSessionId");

    if (!sessionId) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            sessionId = window.crypto.randomUUID();
        } else {
            sessionId = "session-" + Date.now() + "-" + Math.random().toString(16).slice(2);
        }

        sessionStorage.setItem("collabSessionId", sessionId);
    }

    return sessionId;
};

window.ensureCollabSocket = function () {
    if (
        !window.collabSocket ||
        window.collabSocket.readyState === WebSocket.CLOSED ||
        window.collabSocket.readyState === WebSocket.CLOSING
    ) {
        window.collabSocket = new WebSocket("ws://127.0.0.1:8765");

        window.collabSocket.addEventListener("open", () => {
            window.collabSocket.send(JSON.stringify({
                type: "join_room",
                room: window.getCollabRoomName(),
                client_id: localStorage.getItem("clientId") || "",
                username: sessionStorage.getItem("savedUsername") || "Anonymous"
            }));
        });
    }

    return window.collabSocket;
};

window.sendCollabMessage = function (jsonObj) {
    const socket = window.ensureCollabSocket();

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(jsonObj));
    } else {
        console.log("WebSocket is not open yet.");
const socket = new WebSocket('ws://localhost:8000');

// Connection opened
socket.addEventListener("open", (event) => {
    
});

// Construct and send JSON packet to server
window.sendPacket = function(type, data) {
    // Construct packet    
    const packet = JSON.stringify({
        header: {
            type: type, // packet type (string) for routing and parsing by server
            sender: window.user.username, // should this be sessionId instead?
            team: window.user.team,
            time: Date.now() // packet timestamp
        },
        payload: data
    });
    // Send packet
    window.sendCollabMessage(packet);
};

// Send JSON object to server
//export function sendJSON(jsonObj) { - requires modules which requires server hosting of html
window.sendJSON = window.sendCollabMessage;

// Listen for messages
socket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);

    // Turn string from socket into a JSON object
    const data = JSON.parse(event.data);

    if(data.type == "message"){
        // Place message into DOM
        const messageText = data.messageText;
        const username = data.username;
        const timeStamp = data.timeStamp;
        window.showMessage(messageText, username, timeStamp);
    } else if (data.type == "tool_change"){
        // Perform tool change
        const tool = data.tool;
        const width = data.width;
        const colour = data.colour;
        window.canvasTool(tool, width, colour);
    }
};