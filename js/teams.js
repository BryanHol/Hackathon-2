/*
Author: David Caudron
Team Members: Peter Ursem, Bryan Holl, Andrea Restrepo
Purpose: Logic to handle team play
Instructor: FUCK YOU KIDNEY!
Filename: teams.js
*/

// Listener wrapper to ensure page is loaded before trying to find content
document.addEventListener("DOMContentLoaded", () => {
    window.joinTeam = function(teamName) {
        // Update user's team status - Move to server side validation for security later
        window.user.team = teamName;
        
        // Construct data
        const joinData = {
            requestedTeam: teamName
        };
        
        // Send join request to server
        sendPacket("join_team", joinData);

        // Hide buttons once team joined
        const buttons = document.getElementsByClassName("teamButton"); 
        for (let button of buttons) {
            button.style.display = 'none';
        };
        
        window.displayTeamName(teamName);

        console.log("Sent request to join ${teamName}");
    };

    window.displayTeamName = function(teamName) {
        const teamNameDisplay = document.getElementById("teamNameDisplay");
        teamNameDisplay.textContent = teamName;
    };
});