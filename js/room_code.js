
window.addEventListener('load', () => {
    document.getElementById('roomForm').addEventListener('submit', function (e) {
        e.preventDefault(); // Stop normal form submission

            const code = document.getElementById('roomCode').value.trim();

        if (code) {
            const targetURL = `./main_page.html?room=${encodeURIComponent(code)}`;
            window.location.href = targetURL;
            } else {
                alert("Please enter a valid room code.");
            }
    });
});