/*
Author: David Caudron
Team Members: Peter Ursem, Bryan Holl, Andrea Restrepo
Purpose: Objects and functions to store user information required for app functionality
Instructor: FUCK YOU KIDNEY!
Filename: user.js
*/

// User object - Eventually should perform init on server and have it send back user obj for security
window.user = {
    username: "Guest_" + Math.floor(Math.random() * 1000), // init to saved name or generate random temp name
    team: null,
    sessionId: null,
    isArtist: false
};