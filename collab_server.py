"""
Filename: collab_server.py
Author: Bryan Holl
Team Members: David Caudron, Peter Ursem, and Andrea Restrepo

Purpose: 
Refactoring of collab server to restore proper dependencites on js scripts.
The new server code also attempts to remove the latency issue found in the code.
"""

# Necessary imports
import asyncio          # contains APIs for asynchronous connections
from websockets.asyncio.server import serve       # contains websocket server and client APIs
import json             # needed for saving session data in json format
import time             # needed for timeouts
from pathlib import Path # needed for file handling; due to MacOS file system
                        # inconsistencies.
import uuid             # needed for generating unique user IDs
import os

def current_timestamp():
    """
    No parameters. Returns the current timestamp in human-readable format.
    """
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

class AppModel:
    #########################################################################
    # Important Model Set-Up Functions
    #########################################################################
    """
    Store all shared application data.

    This object is the server's in-memory model of the application.
    """

    def __init__(self) -> None:
        """
        Initialize the AppModel with a .json save file to store model data.
        No parameters.
        """

        self.save_file = "app_model.json" # File to save model data to and load model data from

        self.users = {} # Dictionary to store user data, keyed by user ID;
                        # Values are string for user ID and inner dict for
                        # user data/records

        self.rooms = {} # Dictionary for storing room data, keyed by room ID;
                        # Values are string for room ID and inner dict for
                        # the room data/records, where each record is a dict
                        # of the event ID and event data for that event, which
                        # is also a dict of the event attribute and values.

        # ID counters for generating unique IDs for every message sent, every
        # event created, and every action on the canvas. Useful for tracking
        # the current state of the model.
        self.event_id = 1
        self.message_id = 1
        self.stroke_id = 1

        self.load_model() # Loads model data from save file; initially, it is empty

        self.game_state = "lobby" # Changes to game if triggered

    def create_room(self, room_id: str) -> dict:
        """
        Creates a new room with the given room ID.

        :param room_id: The ID of the room to create. This can be anything
        from a random string to a user-specified name, but it must be unique.
        """
        # Guard against creating a room with an ID that already exists
        if room_id not in self.rooms:
            self.rooms[room_id] = {
            "messages": [],
            "strokes": [],
            "events": [],
        }
        if "messages" not in self.rooms[room_id]:
            self.rooms[room_id]["messages"] = []
        if "strokes" not in self.rooms[room_id]:
            self.rooms[room_id]["strokes"] = []
        if "events" not in self.rooms[room_id]:
            self.rooms[room_id]["events"] = []
            
        return self.rooms[room_id]
        
    def load_model(self) -> None:
        """
        Loads model data from the save file.

        No params.
        """
        path = Path(self.save_file)
        if not path.is_file():
            return # If the file doesn't exist, return; the model is empty
        
        with path.open("r") as file:
            data = json.load(file)
        
        self.users = data.get("users", {})
        self.rooms = data.get("rooms", {})

        # If no room has yet been created, creates a default room named
        # "main"; occurs if the ...?room=<name> is not used when connecting to
        # the server.
        if not self.rooms:
            self.rooms["main"] = {
                "messages": data.get("messages", []),
                "strokes": data.get("strokes", []),
                "events": data.get("events", []),
            }

        self.event_id = data.get("event_id", 1)
        self.message_id = data.get("message_id", 1)
        self.stroke_id = data.get("stroke_id", 1)

    def save_model(self) -> None:
        """
        Saves model data to the .json save file.

        No params.
        """
        data = {
            "users": self.users,
            "rooms": self.rooms,
            "event_id": self.event_id,
            "message_id": self.message_id,
            "stroke_id": self.stroke_id,
        }

        path = Path(self.save_file)
        with path.open("w") as file:
            json.dump(data, file)
        
    #########################################################################
    # Event Handling Functions
    #########################################################################
    def add_event(self, data: dict):
        """
        Adds an event to the model's event log.
    
        :param data: A dictionary containing the event data, such as the message text or stroke coordinates.

        Returns a dictionary containing the event data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room_state = self.create_room(header["room"])
        event = {
            "event_id": self.event_id, # Only used for record keeping; not used by client
            "header": header,
            "payload": payload
        }
        self.event_id += 1 # Increments event ID so every event has a unique ID
        room_state["events"].append(event)
        return event

    def add_user(self, data: dict):
        """
        Adds a user to the model's user list. Either creates a new user
        or updates an existing user.

        :param payload: A dictionary containing the user data, such as the user ID and username.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        user_id = header.get("sender")
        username = payload.get("username", payload.get("sender", "Anonymous"))

        if user_id and user_id in self.users:
            self.users[user_id]["username"] = username
            self.users[user_id]["last_seen"] = current_timestamp()
            user = dict(self.users[user_id])
        
        else:
            if not user_id:
                user_id = str(uuid.uuid4()) # Generates a unique user ID using uuid4
            user = {
                "user_id": user_id,
                "username": username,
                "last_seen": current_timestamp(),
            }
            self.users[user_id] = user

        room = payload.get("room", "main")
        if room is None or str(room).strip() == "":
            room = "main"
        room = str(room).strip()
        self.save_model()
        return dict(user)
    
    def get_user(self, data: dict):
        """
        Retrieves a user's data from the model. Also updates the user's last seen timestamp
        and updates username in model if needed. If the user does not exist, creates a new
        user.

        :param data: A dictionary containing the user data.

        Returns a dictionary containing the user's data, or None if the user does not exist.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        user_id = header.get("sender")
        if user_id and user_id in self.users:
            self.users[user_id]["last_seen"] = current_timestamp()
            if "username" in payload:
                self.users[user_id]["username"] = payload["username"]
            if "sender" in payload:
                self.users[user_id]["username"] = payload["sender"]
            self.save_model()
            return dict(self.users[user_id])
        return self.add_user(data)

    # Functions for the text chat
    def add_message(self, data: dict):
        """
        Adds a message to the model's message list for a given room.
        
        :param data: A dictionary containing the message data, such as the room ID, user ID, and message text.
        
        Returns a dictionary containing the message data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = header.get("room", "main")
        if room is None or str(room).strip() == "":
            room = "main"
        room = str(room).strip()
        room_state = self.create_room(room)
        message = {
            "sender": payload.get("sender", payload.get("username", "Anonymous")),
            "text": payload.get("text", payload.get("messageText", "")),
            "team": payload.get("team", header.get("team")),
            "timeStamp": payload.get("timeStamp", current_timestamp())
        }
        self.message_id += 1
        room_state["messages"].append(message)
        data["payload"] = dict(message)
        self.add_event(data)
        self.save_model()
        return dict(message)

    # Functions for the canvas
    def draw_clear(self, data: dict):
        """
        Remove all strokes.

        :param data: A dictionary containing the room data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = header.get("room", "main")
        if room is None or str(room).strip() == "":
            room = "main"
        room = str(room).strip()
        room_state = self.create_room(room)
        user = self.add_user(data)
        room_state["strokes"] = []
        clear_info = {
            "room": room,
            "user_id": user["user_id"],
            "cleared_by": user["username"],
            "time": current_timestamp(),
        }
        data["payload"] = {}
        self.add_event(data)
        self.save_model()
        return dict(clear_info)
    
    def add_stroke(self, data: dict):
        """
        Adds a stroke to the model's stroke list for a given room.

        :param data: A dictionary containing the data for the stroke.

        Returns a dictionary containing the stroke data.
        """
        header = data.get("header", {})
        payload = data.get("payload", {})

        room = header.get("room", "main")
        if room is None or str(room).strip() == "":
            room = "main"
        room = str(room).strip()
        room_state = self.create_room(room)
        user = self.add_user(data)
        stroke = {
            "stroke_id": self.stroke_id,
            "client_id": user["user_id"],
            "username": user["username"],
            "color": payload.get("colour", payload.get("color", "#000000")),
            "thickness": payload.get("width", 1),
            "tool": payload.get("tool", 0),
            "time": current_timestamp(),
            "x": payload.get("x", 0),
            "y": payload.get("y", 0),
        }
        self.stroke_id += 1
        room_state["strokes"].append(stroke)
        data["payload"] = {
            "x": stroke["x"],
            "y": stroke["y"],
            "width": stroke["thickness"],
            "y": stroke["tool"],
            "colour": stroke["color"]
        }
        self.add_event(data)
        self.save_model()
        return dict(stroke)
    
    def get_room_state(self, room: str):
        """
        Return the full shared model for one room.

        :param room: The ID of the room to get the state for.

        Returns a dictionary containing the users, messages, strokes, and latest event ID for the room.
        """
        room_state = self.create_room(room)
        return {
            "users": dict(self.users),
            "messages": list(room_state["messages"]),
            "strokes": list(room_state["strokes"]),
            "latest_event_id": self.event_id - 1,
            "gamestate": self.game_state,
        }

class WebSocketServer:
    """
    WebSocket server for handling client connections and communication.
    This server uses the AppModel to manage the shared state of the application and
    respond to client events.
    """

    #########################################################################
    # Important Server Set-Up Functions
    #########################################################################

    def __init__(self):
        """
        Initializes the WebSocket server with an instance of the AppModel and sets up
        the server's host, port, and connections dictionary.
        """
        self.model = AppModel() # The server's in-memory model of the application
        self.host = "localhost"
        self.port = 8000 # Default port, though can be changed if needed
        self.connections = {}
        self.active_drawings = {} # Dictionary to track active drawings for each room, keyed by room ID
        self.sessions = {}


    def get_room_connections(self, room: str):
        """
        Returns a set of all connections for a given room. If the room does
        not exist, it creates a new empty set for that room and returns it.

        :param room: The ID of the room to get the connections for.
        """
        if room is None or str(room).strip() == "":
            room = "main"
        room = str(room).strip()
        if room not in self.connections:
            self.connections[room] = set() # Initialize a set to store connections for the room
        return self.connections[room]

    #########################################################################
    # Event Handling
    #########################################################################
    async def handle_event(self, websocket):
        """
        Main websocket event handler. Listens for incoming messages, and sends
        back responses. Note all try and except guards are removed in order to 
        (attempt to) reduce latency. In the future, it can be restored if
        error handling is needed.

        :param websocket: The websocket connection to handle events for.

        Note: ALL EVENTS ARE ASSUMED TO BE SENT WITH THE FOLLOWING FORMAT
        AS A JSON PACKET:
        {
            "header": {
                "type": <event_type>,
                "sender": <user_id>,
                "room": <room_id>,
                "team": <team_id>,
                "time": <timestamp>
            },
            "payload": {
                ...event-specific data...
            }
        }
        """
        room = "main" # Default room is "main"; if the client doesn't specify a room, they will be placed in the main room
        try:
            wait = await websocket.recv() # Waits for the first message from the client, which should contain the room information
            data = json.loads(wait)

            header = data.get("header", {}) # Header should contain type, sender, room, team, and time
            payload = data.get("payload", {})

            room = header.get("room", "main")
            if room is None or str(room).strip() == "":
                room = "main"
            room = str(room).strip()
            self.get_room_connections(room).add(websocket) # Add the websocket connection to the set of connections for the room

            username = payload.get("username", payload.get("sender", header.get("sender", "Anonymous")))
            session = {
                "user_id": str(uuid.uuid4()),
                "username": username,
                "team": header.get("team", payload.get("requestedTeam")),
            }
            self.sessions[websocket] = session
            header["sender"] = session["user_id"]
            header["room"] = room
            header["team"] = session["team"]
            payload["sender"] = session["username"]
            payload["username"] = session["username"]
            data["header"] = header
            data["payload"] = payload
            
            user = self.model.get_user(data) # Get user data from the sender
            self.get_room_connections(room).add(websocket) # Add the websocket connection to the set of connections for the room

            # Registers the user and sends message over websocket
            await websocket.send(json.dumps({
                "type": "user_registered",
                "user": user
            }))

            # Constructs the initial state of the room and sends it over the websocket
            await websocket.send(json.dumps({
                "type": "initial_state",
                "room": room,
                "state": self.model.get_room_state(room)
            }))
            room_state = self.model.create_room(room)
            for event in room_state["events"]:
                await websocket.send(json.dumps({
                    "header": {
                        "type": event["header"].get("type"),
                        "room": room,
                    },
                    "payload": dict(event.get("payload", {}))
                }))

            while True: # Listens for incoming messages from the client
                header = data.get("header", {}) # Header should contain type, sender, room, team, and time
                payload = data.get("payload", {})

                if header.get("room") is not None and str(header.get("room")).strip() != "":
                    if str(header.get("room")).strip() != room:
                        self.get_room_connections(room).discard(websocket)
                        room = str(header.get("room")).strip()
                        self.get_room_connections(room).add(websocket)
                header["room"] = room # Ensure the room is included in the data for event handling

                if payload.get("sender") is not None and str(payload.get("sender")).strip() != "":
                    session["username"] = payload.get("sender")
                elif payload.get("username") is not None and str(payload.get("username")).strip() != "":
                    session["username"] = payload.get("username")
                header["sender"] = session["user_id"]
                header["team"] = session["team"]
                payload["sender"] = session["username"]
                payload["username"] = session["username"]
                data["header"] = header
                data["payload"] = payload
                self.model.get_user(data)

                # Begin event handling based on the type of event received from the client
                event_type = header.get("type", "none")

                # Text Chat Events
                # (1) Username is saved into the top box
                # Note: NOT CURRENTLY USED IN THE CLIENT CODE, but it can be restored in the future if needed for user registration and updates.
                # if event_type == "save_user":
                #     user = self.model.add_user(data)
                #     await websocket.send(json.dumps({
                #         "type": "user_updated",
                #         "user": user
                #     }))

                # (2) Message is added to the chat and sent to all clients in the room
                if event_type == "message":
                    message = self.model.add_message(data)
                    for connection in self.get_room_connections(room):
                        if connection != websocket:
                            await connection.send(json.dumps({
                                "header": {
                                    "type": "message",
                                    "room": room,
                                    "team": session["team"],
                                },
                                "payload": {
                                "sender": message["sender"],
                                "text": message["text"],
                                "team": message["team"],
                                "timeStamp": message["timeStamp"]
                                }
                            }))

                # Canvas Events
                # (1) Drawing is cleared; doesn't send any payload back
                elif event_type == "draw_clear":
                    self.model.draw_clear(data)
                    for connection in self.get_room_connections(room):
                        if connection != websocket:
                            await connection.send(json.dumps({
                                "header": {
                                    "type": "draw_clear",
                                    "room": room,
                                },
                                "payload": {}
                            }))

                # (2) Drawing on the canvas 
                elif event_type == "draw_start":
                    data["payload"] = {
                        "x": payload.get("x", 0),
                        "y": payload.get("y", 0)
                    }
                    self.model.add_event(data)
                    self.model.save_model()
                    for connection in self.get_room_connections(room):
                        if connection != websocket:
                            await connection.send(json.dumps({
                                "header": {
                                    "type": "draw_start",
                                    "room": room,
                                },
                                "payload": {
                                "x": payload.get("x", 0),
                                "y": payload.get("y", 0)
                                }
                            }))

                elif event_type == "drawing":
                    stroke_info = self.model.add_stroke(data)
                    for connection in self.get_room_connections(room):
                        if connection != websocket:
                            await connection.send(json.dumps({
                                "header": {
                                    "type": "drawing",
                                    "room": room,
                                },
                                "payload": {
                                "x": stroke_info["x"],
                                "y": stroke_info["y"],
                                "width": stroke_info["thickness"],
                                "tool": stroke_info["tool"],
                                "colour": stroke_info["color"]
                                }
                            }))

                elif event_type == "draw_end":
                    data["payload"] = {}
                    self.model.add_event(data)
                    self.model.save_model()
                    for connection in self.get_room_connections(room):
                        if connection != websocket:
                            await connection.send(json.dumps({
                                "header": {
                                    "type": "draw_end",
                                    "room": room,
                                },
                                "payload": {}
                            }))
                
                elif event_type == "join_team":
                    session["team"] = payload.get("requestedTeam")
                    header["team"] = session["team"]
                    data["header"] = header
                    self.model.get_user(data)

                else:
                    # Not sure if error handling is accepted client-side
                    await websocket.send(json.dumps({
                        "header": {"type": "error"},
                        "payload": {
                            "message": f"Unknown event type: {event_type}"
                        }
                    }))

                wait = await websocket.recv()
                data = json.loads(wait)

            # Remove open websockets when the connection is closed
        finally:
            self.get_room_connections(room).discard(websocket)
            self.sessions.pop(websocket, None)
            if len(self.sessions) == 0:
                os.remove(self.model.save_file) # Remove the save file if there are no active sessions, so the model is reset for the next time the server is run
                self.model = AppModel() # Reset the model in memory as well
        
    async def serve_forever(self) -> None:
        async with serve(self.handle_event, self.host, self.port):
            print(f"WebSocket server running on ws://{self.host}:{self.port}")
            print("Use Ctrl+C to stop the server.")
            await asyncio.Future()

            
def main() -> None:
    server = WebSocketServer()

    try:
        asyncio.run(server.serve_forever())
    except KeyboardInterrupt:
        print("\nServer stopping...")

if __name__ == "__main__":
    main()
