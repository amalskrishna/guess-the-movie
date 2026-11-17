let gameCode = null;
let hostId = null;
let currentPlayerId = null;
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
        currentPlayerId = hostId;
        loadRoomLobby(gameCode);
        startLobbyPolling(gameCode);

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


const joinForm = document.getElementById("join-form");
joinForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const playerName = document.getElementById("join-player-name").value.trim();
    let gameCode = document.getElementById("join-game-code").value.trim();

    const results = document.getElementById("join-results");
    const button = joinForm.querySelector("button");

    button.disabled = true;
    button.textContent = "Joining...";

    try {
        const response = await fetch(`/api/rooms/${gameCode}/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                playerName: playerName
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to join game.");
        }

        results.textContent =
            `Successfully joined game ${data.gameCode}! Welcome, ${playerName}.`;

        console.log("Joined room:", data);
        gameCode = data.gameCode;
        currentPlayerId = data.playerId;
        loadRoomLobby(gameCode);
        startLobbyPolling(gameCode);

    } catch (error) {
        results.textContent = "Error: " + error.message;

    } finally {
        button.disabled = false;
        button.textContent = "Join Game";
    }
});


async function loadRoomLobby(gameCode) {
    try {
        const response = await fetch(`/api/rooms/${gameCode}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load room.");
        }

        // Show the lobby
        document.getElementById("room-lobby")
            .classList.remove("hidden");

        // Display game code and status
        document.getElementById("lobby-game-code").textContent =
            data.gameCode;

        document.getElementById("lobby-status").textContent =
            `Status: ${data.status}`;

        // Display current round
        document.getElementById("lobby-round").textContent =
            data.status === "waiting"
                ? "Round: Waiting to start"
                : `Round: ${data.currentRound}`;

        // Find the timestamp selector
        const selector = data.players.find(function (player) {
            return player.id === data.currentSelectorId;
        });

        // Display selector name
        document.getElementById("lobby-selector").textContent =
            selector
                ? `Timestamp Selector: ${selector.name}`
                : "Timestamp Selector: Not assigned";
                
        // Get the player list element
        const playerList = document.getElementById("player-list");

        // Clear the previous player list
        playerList.innerHTML = "";

        // Display every player
        data.players.forEach(function (player) {
            const listItem = document.createElement("li");

            listItem.textContent = player.name +
                (player.isHost ? " (Host)" : "");

            playerList.appendChild(listItem);
        });

        // Show Start Game button only to the host
        const startButton =
            document.getElementById("start-game-button");

        if (currentPlayerId === hostId && hostId !== null) {
            startButton.classList.remove("hidden");
        } else {
            startButton.classList.add("hidden");
        }

        // Show Next Round button only to the host during a game
        const nextRoundButton =
            document.getElementById("next-round-button");

        if (currentPlayerId === hostId && hostId !== null &&
            data.status === "playing") {

            nextRoundButton.classList.remove("hidden");

        } else {

            nextRoundButton.classList.add("hidden");

        }

    } catch (error) {
        console.error("Lobby error:", error);
        alert(error.message);
    }
}

let lobbyInterval = null;
function startLobbyPolling(gameCode) {

    // Stop any previous polling
    if (lobbyInterval !== null) {
        clearInterval(lobbyInterval);
    }

    // Refresh the lobby every 2 seconds
    lobbyInterval = setInterval(function () {
        loadRoomLobby(gameCode);
    }, 2000);
}

const startGameButton = document.getElementById("start-game-button");

startGameButton.addEventListener("click", async function () {

    try {
        const response = await fetch(`/api/rooms/${gameCode}/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                playerId: currentPlayerId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to start game.");
        }

        alert("Game started successfully!");

        // Refresh the lobby
        loadRoomLobby(gameCode);

    } catch (error) {
        alert(error.message);
    }
});


const nextRoundButton = document.getElementById("next-round-button");

nextRoundButton.addEventListener("click", async function () {

    try {
        nextRoundButton.disabled = true;
        nextRoundButton.textContent = "Loading...";

        const response = await fetch(`/api/rooms/${gameCode}/next-round`, {
            method: "POST"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to advance round.");
        }

        console.log("Next round:", data);

        // Refresh the lobby
        await loadRoomLobby(gameCode);

    } catch (error) {

        alert(error.message);

    } finally {

        nextRoundButton.disabled = false;
        nextRoundButton.textContent = "Next Round";

    }

});
