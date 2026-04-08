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