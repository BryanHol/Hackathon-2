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
        const buttons = document.getElementsByClassName("team-button"); 
        for (let button of buttons) {
            button.style.display = 'none';
        };
        
        window.updateTeamName(teamName);

        console.log("Sent request to join ${teamName}");
    };

    window.updateTeamName = function(teamName) {
        //const teamNameDisplay = document.getElementById("current-team-display");
        const teamNameDisplay = document.querySelector("#current-team-display");
        //teamNameDisplay.textContent = teamName;
        teamNameDisplay.textContent = teamName;
        //teamNameDisplay.style.color = (teamName.toLowerCase() === 'red') ? '#ba1818' : '#1857ba';
        
        // Remove other team classes and add the correct class based on the team
        teamNameDisplay.classList.remove('no-team', 'red-active', 'blue-active');
        const team = teamName.toLowerCase();
        if (team === 'red') {
            teamNameDisplay.classList.add('red-active');
        } else if (team === 'blue') {
            teamNameDisplay.classList.add('blue-active');
        } else {
            teamNameDisplay.classList.add('no-team');
        }
    };
});