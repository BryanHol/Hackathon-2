/*

    Sockets.js

    Peter Ursem

    Handle live IO from the server and pass data to the chat and canvas handlers.

*/

const socket = new WebSocket('ws://localhost:8000');

// Connection opened
socket.addEventListener("open", (event) => {
    socket.send("Hello Server!");
});

// Listen for messages
socket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);



});

function sendBlob(blob) {
    socket.send(blob);
}