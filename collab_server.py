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

def current_timestamp():
    """
    No parameters. Returns the current timestamp in human-readable format.
    """
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

class AppModel:
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
        
        



