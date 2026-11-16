const form = document.getElementById("capture-form");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const searchQuery = document.getElementById("search-query").value;
    const timestamp = document.getElementById("timestamp").value;

    const response = await fetch("/api/capture", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            query: searchQuery,
            timestamp: timestamp
        })
    });

    const result = await response.json();

    console.log(result);
});