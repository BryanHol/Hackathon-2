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
import websockets       # contains websocket server and client APIs
import json             # needed for saving session data in json format
import time             # needed for timeouts
from pathlib import Path # needed for file handling; due to MacOS file system
                        # inconsistencies.
import uuid             # needed for generating unique user IDs

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

        self.next_event_id = data.get("next_event_id", 1)
        self.next_message_id = data.get("next_message_id", 1)
        self.next_stroke_id = data.get("next_stroke_id", 1)

    def save_model(self) -> None:
        """
        Saves model data to the .json save file.

        No params.
        """
        data = {
            "users": self.users,
            "rooms": self.rooms,
            "event_id": self.next_event_id,
            "message_id": self.next_message_id,
            "stroke_id": self.next_stroke_id,
        }

        path = Path(self.save_file)
        with path.open("w") as file:
            json.dump(data, file)
        
    #########################################################################
    # Event Handling Functions
    #########################################################################
    def add_event(self, room: str, event_type: str, data: dict):
        """
        Adds an event to the model's event log.
        
        :param room: The ID of the room the event occurred in.
        :param event_type: The type of the event, such as "message" or "stroke".
        :param data: A dictionary containing the event data, such as the message text or stroke coordinates.

        Returns a dictionary containing the event data.
        """
        room_state = self.create_room(room)
        event = {
            "event_id": self.next_event_id,
            "room": room,
            "type": event_type,
            "time": current_timestamp(),
            "data": data,
        }
        self.next_event_id += 1 # Increments event ID so every event has a unique ID
        room_state["events"].append(event)
        return event

    def add_user(self, user_data: dict):
        """
        Adds a user to the model's user list. Either creates a new user
        or updates an existing user.

        :param user_data: A dictionary containing the user data, such as the user ID and username.
        """
        user_id = user_data.get("user_id")
        username = user_data.get("username", "Anonymous")

        if user_id and user_id in self.users:
            self.users[user_id]["username"] = username
            self.users[user_id]["last_seen"] = current_timestamp()
            user = dict(self.users[user_id])
        
        else:
            user_id = str(uuid.uuid4()) # Generates a unique user ID using uuid4
            user = {
                "user_id": user_id,
                "username": username,
                "last_seen": current_timestamp(),
            }
            self.users[user_id] = user

        room = str(user_data.get("room", "main")).strip()
        self.add_event(room, "user_updated", user)
        self.save_model()
        return dict(user)
    
    def get_user(self, user_data):
        """
        Retrieves a user's data from the model. Also updates the user's last seen timestamp
        and updates username in model if needed. If the user does not exist, creates a new
        user.

        :param user_id: The ID of the user to retrieve.

        Returns a dictionary containing the user's data, or None if the user does not exist.
        """
        user_id = user_data.get("client_id")
        if user_id and user_id in self.users:
            self.users[user_id]["last_seen"] = current_timestamp()
            if "username" in user_data:
                self.users[user_id]["username"] = user_data["username"]
            self.save_model()
            return dict(self.users[user_id])
        return self.add_user(user_data)
    
    # Functions for the text chat
    def add_message(self, msg_data: dict):
        """
        Adds a message to the model's message list for a given room.
        
        :param room_data: A dictionary containing the message data, such as the room ID, user ID, and message text.
        
        Returns a dictionary containing the message data.
        """
        room = str(msg_data.get("room", "main")).strip()
        room_state = self.create_room(room)
        message = {
            "messageText": msg_data.get("messageText", ""),
            "username": msg_data.get("username", "Anonymous"),
            "timeStamp": current_timestamp()
        }
        self.message_id += 1
        room_state["messages"].append(message)
        self.add_event(room, "chat_message", message)
        self.save_model()
        return dict(message)

    # Functions for the canvas
    def draw_clear(self, room_data):
        """
        Remove all strokes.

        :param room_data: A dictionary containing the room data.
        """
        room = str(room_data.get("room", "main")).strip() or "main"
        room_state = self.create_room(room)
        user = self.add_user(room_data)
        room_state["strokes"] = []
        clear_info = {
            "room": room,
            "user_id": user["user_id"],
            "cleared_by": user["username"],
            "time": current_timestamp(),
        }
        self.add_event(room, "canvas_cleared", clear_info)
        self.save_model()
        return dict(clear_info)
    
    def add_stroke(self, data):
        """
        Adds a stroke to the model's stroke list for a given room.

        :param data: A dictionary containing the data for the stroke.

        Returns a dictionary containing the stroke data.
        """
        room = str(data.get("room", "main")).strip() or "main"
        room_state = self.create_room(room)
        user = self.add_user(data)
        stroke = {
            "stroke_id": self.stroke_id,
            "client_id": user["client_id"],
            "username": user["username"],
            "color": data.get("color", "#000000"),
            "thickness": data.get("thickness", 1),
            "time": current_timestamp(),
        }
        self.stroke_id += 1
        room_state["strokes"].append(stroke)
        self.add_event(room, "stroke_added", stroke)
        self.save_model()
        return dict(stroke)
    
    def get_room_state(self, room: str):
        """Return the full shared model for one room."""
        room_state = self.create_room(room)
        return {
            "users": dict(self.users),
            "messages": list(room_state["messages"]),
            "strokes": list(room_state["strokes"]),
            "latest_event_id": self.next_event_id - 1,
        }


