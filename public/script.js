const socket = io();
let gameCode = null;
let hostId = null;
let currentPlayerId = null;
let hostToken = null;
let currentSelectorId = null;
const urlParams = new URLSearchParams(window.location.search);
const roomCodeFromUrl = urlParams.get("room");
const playerIdFromUrl = urlParams.get("player");
if(playerIdFromUrl){
    currentPlayerId=playerIdFromUrl;
}
if(roomCodeFromUrl){
    gameCode = roomCodeFromUrl;
}
if (gameCode && document.getElementById("game-round")) {
    socket.emit("join-game-room", gameCode);
    loadGameState();
}

socket.on("lobby-updated", ()=>{
    if (gameCode) {
        loadRoomLobby(gameCode);
    }
});
socket.on("game-started", () => {
    window.location.href = `/game.html?room=${gameCode}&player=${currentPlayerId}`;
});
socket.on("room-deleted", () => {
    alert("The host has deleted this room.");
    window.location.href = "/";
});
socket.on("timestamp-submitted", (data) => {
    console.log("Timestamp selected:", data.timestamp);
    const movieFrame = document.getElementById("movie-frame");
    if(movieFrame){
        movieFrame.src=data.framePath;
    }
    const timestampSection = document.getElementById("timestamp-section");
    const guessSection = document.getElementById("guess-section");

    if (timestampSection) {
        timestampSection.classList.add("hidden");
    }

    if (guessSection) {
        guessSection.classList.remove("hidden");
    }
});

const form = document.getElementById("capture-form");

if (form) {
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
}

const movieForm = document.getElementById("movie-form");
if (movieForm){
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
        hostToken = data.hostToken;
        socket.emit("join-game-room", gameCode);
        loadRoomLobby(gameCode);

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
}

const joinForm = document.getElementById("join-form");
if(joinForm){
joinForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const playerName = document.getElementById("join-player-name").value.trim();
    gameCode = document.getElementById("join-game-code").value.trim();

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
        socket.emit("join-game-room", gameCode);
        joinForm.classList.add("hidden");
        document.getElementById("join-lobby").classList.remove("hidden");
        loadRoomLobby(gameCode);

    } catch (error) {
        results.textContent = "Error: " + error.message;

    } finally {
        button.disabled = false;
        button.textContent = "Join Game";
    }
});
}

async function loadGameState() {
    try {
        const response = await fetch(`/api/rooms/${gameCode}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load game.");
        }

        currentSelectorId = data.currentSelectorId;
        const gamePlayerList = document.getElementById("game-player-list");

        gamePlayerList.innerHTML = "";

        data.players.forEach(player => {
            const li = document.createElement("li");
            li.textContent = player.name;

            if (player.id === data.currentSelectorId) {
                li.textContent += " (Selecting)";
            }

            gamePlayerList.appendChild(li);
        });
        document.getElementById("game-round").textContent =
            `Round ${data.currentRound} of ${data.totalRounds}`;
        const selectorElement = document.getElementById("timestamp-section");
        if (data.currentSelectorId === currentPlayerId) {
            selectorElement.classList.remove("hidden");
        } else {
            selectorElement.classList.add("hidden");
        }

        const selectorMessage = document.getElementById("selector-message");
        if (data.currentSelectorId === currentPlayerId) {
            selectorMessage.textContent = "You are selecting the timestamp!";
        } else {
            selectorMessage.textContent =
                `Waiting for ${data.currentSelectorName} to select a timestamp...`;
        }

        const timestampSlider = document.getElementById("timestamp-slider");
        const selectedTimestamp = document.getElementById("selected-timestamp");

        if (timestampSlider && selectedTimestamp) {
            timestampSlider.addEventListener("input", function () {
                const totalSeconds = Number(timestampSlider.value);

                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;

                selectedTimestamp.textContent =
                    `${String(hours).padStart(2, "0")}:` +
                    `${String(minutes).padStart(2, "0")}:` +
                    `${String(seconds).padStart(2, "0")}`;
            });
        }
    } catch (error) {
        console.error("Game loading error:", error);
        alert(error.message);
    }
}

const submitTimestampButton = document.getElementById("submit-timestamp-button");
if (submitTimestampButton) {
    submitTimestampButton.addEventListener("click", async function () {
        const timestampSlider = document.getElementById("timestamp-slider");
        const timestamp = Number(timestampSlider.value);

        console.log("Selected timestamp:", timestamp);

    try {
        const response = await fetch(
            `/api/rooms/${gameCode}/submit-timestamp`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playerId: currentPlayerId,
                    timestamp: timestamp
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to submit timestamp.");
        }

        console.log("Timestamp submitted successfully.");

    } catch (error) {
        console.error("Timestamp submission error:", error);
        alert(error.message);
    }
    });
}

const submitGuessButton = document.getElementById("submit-guess-button");
if (submitGuessButton) {
    submitGuessButton.addEventListener("click", async function () {
        const guess = document.getElementById("movie-guess").value.trim();

        try {
            const response = await fetch(
                `/api/rooms/${gameCode}/submit-guess`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        playerId: currentPlayerId,
                        guess: guess
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Unable to submit guess.");
            }

            alert("Guess submitted successfully!");

            submitGuessButton.disabled = true;

        } catch (error) {
            alert(error.message);
        }
    });
}

async function loadRoomLobby(gameCode) {
    try {
        const response = await fetch(`/api/rooms/${gameCode}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load room.");
        }

        // Show the lobby
        // Show the correct lobby
        const isHost = currentPlayerId === hostId && hostId !== null;

        const lobbyElement = document.getElementById(
            isHost ? "host-lobby" : "join-lobby"
        );

        lobbyElement.classList.remove("hidden");

        // Display game code and status
        const gameCodeElement = document.getElementById(
            isHost ? "lobby-game-code" : "join-lobby-game-code"
        );
        gameCodeElement.textContent = data.gameCode;

        const statusElement = document.getElementById(
            isHost ? "lobby-status" : "join-lobby-status"
        );
        statusElement.textContent = `Status: ${data.status}`;

        // Display current round
        if(isHost){
        document.getElementById("lobby-round").textContent =
            data.status === "waiting"
                ? "Round: Waiting to start"
                : `Round: ${data.currentRound}`;
        }

        // Find the timestamp selector
        const selector = data.players.find(function (player) {
            return player.id === data.currentSelectorId;
        });

        // Display selector name
        if(isHost){
        document.getElementById("lobby-selector").textContent =
            selector
                ? `Timestamp Selector: ${selector.name}`
                : "Timestamp Selector: Not assigned";
        }

        // Get the player list element
        const playerList = document.getElementById(
            isHost? "player-list" : "join-player-list"
        );

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

        if (startButton) {
            if (isHost) {
                startButton.classList.remove("hidden");
                startButton.disabled = data.players.length < 2;
            } else {
                startButton.classList.add("hidden");
            }
        }

        } catch (error) {
            console.error("Lobby error:", error);

            if (error.message === "Unable to load room." ||
                error.message === "Room not found.") {

                alert("The room has been closed by the host.");
                window.location.href = "/";
                return;
            }

            alert(error.message);
        }
}

const startGameButton = document.getElementById("start-game-button");
if(startGameButton){
startGameButton.addEventListener("click", async function () {

    try {
        const response = await fetch(`/api/rooms/${gameCode}/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${hostToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to start game.");
        }

        // Refresh the lobby
        loadRoomLobby(gameCode);

    } catch (error) {
        alert(error.message);
    }
});
}

const nextRoundButton = document.getElementById("next-round-button");
if(nextRoundButton){
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
}

const exitRoomButton = document.getElementById("exit-room-button");
if (exitRoomButton) {
    exitRoomButton.addEventListener("click", async function () {
        try {
            const response = await fetch(`/api/rooms/${gameCode}/leave`, {
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
                throw new Error(data.error || "Unable to leave room.");
            }

            // Reset player information
            currentPlayerId = null;
            gameCode = null;

            // Return to the join form
            document.getElementById("join-lobby").classList.add("hidden");
            joinForm.classList.remove("hidden");

            alert("You have left the room.");

        } catch (error) {
            alert(error.message);
        }
    });
}

const deleteRoomButton = document.getElementById("delete-room-button");
if (deleteRoomButton) {
    deleteRoomButton.addEventListener("click", async function () {

        const confirmed = confirm(
            "Are you sure you want to delete this room?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${gameCode}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${hostToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to delete room."
                );
            }

            alert("Room deleted successfully.");

            window.location.href = "/";

        } catch (error) {
            alert(error.message);
        }
    });
}


const copyCodeButton = document.getElementById("copy-code-button");
if (copyCodeButton) {
    copyCodeButton.addEventListener("click", async function () {
        try {
            const roomCode = document.getElementById("lobby-game-code").textContent;

            await navigator.clipboard.writeText(roomCode);

            copyCodeButton.textContent = "Copied!";

            setTimeout(() => {
                copyCodeButton.textContent = "Copy Code";
            }, 2000);

        } catch (error) {
            alert("Unable to copy room code.");
        }
    });
}