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

    if(event.data.type == "message"){
        // Place message into DOM
        const messageText = event.data.messageText;
        const username = event.data.username;
        const time = event.data.timeStamp;
        addMessage(messageText, username, timeStamp);
    } else if (event.data.type == "drawing"){
        canvasArtist.queueAction(to_pos);
    } else if (event.data.type == "tool_change"){
        canvasArtist.tool(tool);
    }

});

function sendBlob(blob) {
    socket.send(blob);
}

const canvasArtist = new Artist();