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