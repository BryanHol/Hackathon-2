/*

    Sockets.js

    Peter Ursem & David Caudron

    Handle live IO from the server and pass data to the chat and canvas handlers.

*/

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
    socket.send(packet);
};

// Send JSON object to server
//export function sendJSON(jsonObj) { - requires modules which requires server hosting of html
window.sendJSON = function(jsonObj) {
    // Send JSON as a string
    socket.send(JSON.stringify(jsonObj));
}

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
    } 
    else if (data.type == "draw_clear")
        window.canvasClear();
    else if (data.type == "draw_colour") 
        window.canvasColour(data.colour);
    else if (data.type == "draw_width")
        window.canvasWidth(data.width);
    else if (data.type == "drawing")
        window.canvasAction(data.x, data.y);
    else if (data.type == "draw_start")
        window.canvasStart(data.x, data.y);
    else if (data.type == "draw_end")
        window.canvasEnd();

});