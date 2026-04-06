
window.addEventListener('load', () => {
    document.getElementById('roomForm').addEventListener('submit', function (e) {
        e.preventDefault(); // Stop normal form submission

            const code = document.getElementById('roomCode').value.trim();

        if (code) {
            // const path = "./main_page.html"; 
            const path = "http://127.0.0.1:5000/main_page.html";
            const targetURL = `${path}?room=${encodeURIComponent(code)}`;
            window.location.href = targetURL;
            } else {
                alert("Please enter a valid room code.");
            }
    });
});