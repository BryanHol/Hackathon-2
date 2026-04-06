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
    }
};