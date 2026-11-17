let gameCode = null;
let hostId = null;
const form = document.getElementById("capture-form");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const searchQuery = document.getElementById("search-query").value;
    const timestamp = document.getElementById("timestamp").value;
    const year = document.getElementById("movie-year").value;

    try {
        const response = await fetch("/api/capture", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: searchQuery,
                year: year,
                timestamp: timestamp
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        // Display the captured screenshot
        const screenshot = document.getElementById("screenshot");

        screenshot.src = result.imageUrl + "?t=" + Date.now();

        document.getElementById("result").classList.remove("hidden");

        console.log(result);

    } catch (error) {
        console.error("Error:", error);
        alert(error.message);
    }
});


const movieForm = document.getElementById("movie-form");
movieForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const hostName = document.getElementById("host-name").value.trim();
    const prompt = document.getElementById("movie-prompt").value;
    const count = Number(document.getElementById("movie-count").value);

    const results = document.getElementById("movie-results");
    const button = movieForm.querySelector("button");

    button.disabled = true;
    button.textContent = "Generating...";
    results.textContent = "Asking Gemini to generate movies...";

    try {
        const response = await fetch("/api/generate-movies", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                hostName: hostName,
                prompt: prompt,
                count: count
            })
        });

        const data = await response.json();
        console.log(data);
        gameCode = data.gameCode;
        hostId = data.hostId;

        if (!response.ok) {
            throw new Error(data.error || "Movie generation failed.");
        }

        results.textContent =
            `Game created successfully! Game code: ${gameCode}. ${data.totalMovies} rounds are ready.`;

    } catch (error) {
        results.textContent = "Error: " + error.message;
    } finally {
        button.disabled = false;
        button.textContent = "Generate Movies";
    }
});
