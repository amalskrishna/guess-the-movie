const express = require("express");
const { chromium } = require("playwright");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY_TEST
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;
const rooms = new Map();

app.use(express.json());
app.use(express.static("public"));
app.get("/test", function (request, response) {
    response.send("You are running the correct server.js!");
});

// Convert timestamp into seconds
function timestampToSeconds(timestamp) {
    if(typeof timestamp === "number"){
        return timestamp;
    }
    const parts = timestamp.split(":").map(Number);

    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    throw new Error("Invalid timestamp format");
}

// Reusable function to capture a movie frame
async function captureMovieFrame(query, year, timestamp) {
    let browser;

    try {
        const seconds = timestampToSeconds(timestamp);

        browser = await chromium.launch({
            channel: "chrome",
            headless: true
        });

        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto("https://cinejoy.pk/", {
            waitUntil: "domcontentloaded"
        });

        await page.waitForTimeout(2000);

        // Close popup if one appears
        const closeButton = page.locator('button[aria-label="Close"]').first();
        console.log(closeButton.count());
        //if (await closeButton.count() > 0) {
            await closeButton.click();
        //}
        await page.waitForTimeout(1000);

        // Open search
        const searchButton = page.locator(
            'button[aria-label*="search" i]'
        );

        await searchButton.first().click();
        await page.waitForTimeout(1000);

        // Search movie
        const searchBox = page.locator(
            'input[placeholder="Search keywords..."]'
        );

        await searchBox.fill(query);
        await page.waitForTimeout(2000);

        // Find movie using title and year
        const movieCard = page.locator("a[aria-label]")
            .filter({ hasText: query })
            .filter({ hasText: String(year) })
            .first();

        if (await movieCard.count() === 0) {
            throw new Error(`Movie not found: ${query} (${year})`);
        }

        await movieCard.locator("img").click();
        await page.waitForTimeout(2000);

        // Click Play
        const playButton = page.getByRole("button", {
            name: "Play",
            exact: true
        });

        await playButton.click();
        await page.waitForTimeout(2000);

        // Get video
        const videoPlayer = page.locator("video");

        await videoPlayer.waitFor({
            state: "visible"
        });

        // Seek to timestamp
        await videoPlayer.evaluate((video, time) => {
            video.currentTime = time;
        }, seconds);

        console.log(`Video jumped to ${timestamp}!`);

        await page.waitForTimeout(2000);

        // Hide player controls
        await page.mouse.move(10, 10);
        await page.waitForTimeout(3000);

        // Capture frame
        await videoPlayer.screenshot({
            path: "public/captured-frame.png"
        });

        console.log("Screenshot captured!");

        return "/captured-frame.png";
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}

function rotateTimestampSelector(room) {

    // Move to the next player
    room.currentSelectorIndex =
        (room.currentSelectorIndex + 1) % room.players.length;

    // Store the next selector's ID
    room.currentSelectorId =
        room.players[room.currentSelectorIndex].id;

}


// API endpoint
app.post("/api/capture", async function (request, response) {
    const { query, year, timestamp } = request.body;

    try {
        const imageUrl = await captureMovieFrame(
            query,
            year,
            timestamp
        );

        response.json({
            message: "Frame captured successfully!",
            query,
            year,
            timestamp,
            imageUrl
        });
    }
    catch (error) {
        console.error("Automation error:", error);

        response.status(500).json({
            error: error.message
        });
    }
});

app.get("/api/test-gemini", async function (request, response) {
    try {
        const result = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: "Reply with exactly: Gemini API is working!"
        });

        response.json({
            success: true,
            message: result.text
        });

    } catch (error) {
        console.error("Gemini error:", error);

        response.status(500).json({
            success: false,
            error: error.message
        });
    }
});


app.post("/api/generate-movies", async function (request, response) {
    try {
        const { hostName, prompt, count } = request.body;
        const strategies = [
            "Explore lesser-known but highly relevant movies.",
            "Prioritize movies from different decades.",
            "Focus on critically acclaimed movies.",
            "Include more international cinema where relevant.",
            "Explore different directors and subgenres.",
            "Balance popular hits with hidden gems.",
            "Choose a fresh mix rather than the obvious choices."
        ];

        const variationStrategy = strategies[
            Math.floor(Math.random() * strategies.length)
        ];
        if (!Number.isInteger(count) || count < 1 || count > 30) {
            return response.status(400).json({
                error: "Movie count must be between 1 and 30."
            });
        }

        const result = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            
            contents: `
                Selection strategy for this generation:
                ${variationStrategy}
                Follow this strategy while keeping every movie relevant to the request.
                Generate exactly ${count} movies based on this request:
                "${prompt}"

                MOVIE RULES:
                1. Include only real, officially released theatrical movies.
                2. Do not include TV shows, web series, documentaries, or unreleased movies.
                3. Do not include duplicate movies.
                4. Use the original theatrical release year.
                5. Ensure every movie genuinely matches the requested genre or collection.
                6. For collections such as MCU or DCU, include only movies belonging to that collection.
                7. If the request is broad, select movies from different eras, directors, and subgenres.
                8. If the request is specific, prioritize relevance over variety.
                
                VARIETY RULES:
                1. Make each generation somewhat different from previous generations.
                2. Avoid repeatedly choosing only the most famous or obvious movies.
                3. Include a mix of popular and less commonly suggested movies when appropriate.
                4. Vary the selection while keeping every movie relevant to the request.
                5. Do not deliberately choose obscure or unrelated movies just to create variety.

                OUTPUT RULES:
                Return exactly ${count} movies.
                Return ONLY valid JSON in this format:
                {
                    "movies": [
                        {
                            "title": "Interstellar",
                            "year": 2014
                        }
                    ]
                }
                Do not include explanations, comments, or Markdown.
            `

        });

        const movieList = JSON.parse(result.text);

        // Check that the movies property is an array
        if (!movieList.movies || !Array.isArray(movieList.movies)) {
            throw new Error("Invalid movie list format.");
        }

        // Check the requested number of movies
        if (movieList.movies.length !== count) {
            throw new Error(`Expected ${count} movies, but received ${movieList.movies.length}.`);
        }

        // Check each movie's title and release year
        for (const movie of movieList.movies) {
            if (
                typeof movie.title !== "string" ||
                movie.title.trim() === "" ||
                !Number.isInteger(movie.year) ||
                movie.year < 1888 ||
                movie.year > new Date().getFullYear() + 1
            ) {
                throw new Error("A movie has an invalid title or release year.");
            }
        }

        // Check for duplicate movie titles
        const titles = movieList.movies.map(movie =>
            movie.title.trim().toLowerCase()
        );

        if (new Set(titles).size !== titles.length) {
            throw new Error("Gemini returned duplicate movies.");
        }


        // Generate a unique ID for this movie list
        let gameCode;
        do{
            gameCode = Math.random().toString(36).substring(2,8).toUpperCase(); 
        }
        while (rooms.has(gameCode));

        const hostId = crypto.randomUUID();
        const hostToken = crypto.randomBytes(32).toString("hex");
        // Create a room 
        rooms.set(gameCode, {
            hostId: hostId,
            hostToken: hostToken,
            players: [
                {
                    id: hostId,
                    name: hostName.trim(),
                    isHost: true
                }
            ],
            movies: movieList.movies,
            guesses: [],
            currentMovieIndex: 0,
            currentSelectorIndex: 0,
            status: "waiting"
        });

        // Send game code to frontend
        response.json({
            success: true,
            message: "Game room generated successfully!",
            gameCode: gameCode,
            hostId: hostId,
            hostToken: hostToken,
            totalMovies: movieList.movies.length
        });

    } catch (error) {
        console.error("Movie generation error:", error);

        response.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Join an existing room
app.post("/api/rooms/:gameCode/join", function (request, response) {
    const gameCode = request.params.gameCode.toUpperCase();
    const { playerName } = request.body;

    // Check player name
    if (!playerName || playerName.trim() === "") {
        return response.status(400).json({
            error: "Player name is required."
        });
    }

    // Find the room
    const room = rooms.get(gameCode);

    if (!room) {
        return response.status(404).json({
            error: "Room not found."
        });
    }

    // Only allow joining while waiting
    if (room.status !== "waiting") {
        return response.status(400).json({
            error: "This game has already started."
        });
    }

    // Create a unique player ID
    const playerId = crypto.randomUUID();

    // Add player to the room
    room.players.push({
        id: playerId,
        name: playerName.trim(),
        isHost: false
    });
    io.to(gameCode).emit("lobby-updated");

    // Send safe room information to the player
    response.json({
        success: true,
        message: "Joined room successfully!",
        gameCode: gameCode,
        playerId: playerId,
        players: room.players.map(player => ({
            id: player.id,
            name: player.name,
            isHost: player.isHost
        }))
    });
});

// Player leaves a room
app.post("/api/rooms/:gameCode/leave", (req, res) => {
    const gameCode = req.params.gameCode.toUpperCase();
    const { playerId } = req.body;

    const room = rooms.get(gameCode);

    if (!room) {
        return res.status(404).json({
            error: "Room not found."
        });
    }

    if (room.status !== "waiting") {
        return res.status(400).json({
            error: "Cannot leave after the game has started."
        });
    }

    if (playerId === room.hostId) {
        return res.status(400).json({
            error: "The host must delete the room instead."
        });
    }

    const playerIndex = room.players.findIndex(
        player => player.id === playerId
    );

    if (playerIndex === -1) {
        return res.status(404).json({
            error: "Player not found in this room."
        });
    }

    room.players.splice(playerIndex, 1);
    io.to(gameCode).emit("lobby-updated");

    res.json({
        success: true,
        message: "You have left the room."
    });
});

// Get room information
app.get("/api/rooms/:gameCode", function (request, response) {
    const gameCode = request.params.gameCode.toUpperCase();

    // Find the room
    const room = rooms.get(gameCode);

    // Check whether the room exists
    if (!room) {
        return response.status(404).json({
            error: "Room not found."
        });
    }

    // Send room information without revealing the movies
    response.json({
        success: true,
        gameCode: gameCode,
        status: room.status,
        currentRound: room.currentMovieIndex+1,
        totalRounds: room.movies.length,
        currentSelectorId: room.currentSelectorId,
        currentSelectorName: room.players.find(
            player => player.id === room.currentSelectorId
        )?.name || null,
        players: room.players.map(player => ({
            id: player.id,
            name: player.name,
            isHost: player.isHost
        }))
    });
});


// Start a game
app.post("/api/rooms/:gameCode/start", function (request, response) {
    const gameCode = request.params.gameCode.toUpperCase();
    const authorization = request.headers.authorization;
    const providedToken = authorization
        ? authorization.replace("Bearer ", "")
        : null;
    // Find the room
    const room = rooms.get(gameCode);

    if (!room) {
        return response.status(404).json({
            error: "Room not found."
        });
    }

    // Check whether the requester is the host
    if (providedToken !== room.hostToken) {
        return response.status(403).json({
            error: "Only the host can start the game."
        });
    }
    // Check room status
    if (room.status !== "waiting") {
        return response.status(400).json({
            error: "Game has already started."
        });
    }

    // Require at least 2 players
    if (room.players.length < 2) {
        return response.status(400).json({
            error: "At least 2 players are required."
        });
    }

    // Start the game
    room.status = "playing";
    room.currentMovieIndex = 0;
    room.currentSelectorIndex = 0;
    room.currentSelectorId = room.players[0].id;
    io.to(gameCode).emit("game-started");

    response.json({
        success: true,
        message: "Game started successfully!",
        status: room.status
    });
});

// Host deletes the room
app.delete("/api/rooms/:gameCode", (req, res) => {
    const gameCode = req.params.gameCode.toUpperCase();
    const authorization = req.headers.authorization;

    const room = rooms.get(gameCode);

    if (!room) {
        return res.status(404).json({
            error: "Room not found."
        });
    }

    const token = authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : null;

    if (token !== room.hostToken) {
        return res.status(403).json({
            error: "Only the host can delete this room."
        });
    }
    io.to(gameCode).emit("room-deleted");
    rooms.delete(gameCode);

    res.json({
        success: true,
        message: "Room deleted successfully."
    });
});

app.post("/api/rooms/:gameCode/submit-timestamp", async function (request, response) {
    const gameCode = request.params.gameCode.toUpperCase();
    const room = rooms.get(gameCode);

    if (!room) {
        return response.status(404).json({
            error: "Room not found."
        });
    }

    if (room.status !== "playing") {
        return response.status(400).json({
            error: "The game is not currently playing."
        });
    }

    const { playerId, timestamp } = request.body;

    if (playerId !== room.currentSelectorId) {
        return response.status(403).json({
            error: "You are not the current timestamp selector."
        });
    }

    if (!Number.isFinite(timestamp) || timestamp < 0) {
        return response.status(400).json({
            error: "Invalid timestamp."
        });
    }
    const currentMovie = room.movies[room.currentMovieIndex];
    console.log("Current movie:", currentMovie.title, currentMovie.year);
    const framePath = await captureMovieFrame(
        currentMovie.title,
        currentMovie.year,
        timestamp
    );
    room.selectedTimestamp = timestamp;
    io.to(gameCode).emit("timestamp-submitted", {
        timestamp: timestamp,
        framePath: framePath
    });

    response.json({
        success: true,
        message: "Timestamp submitted."
    });
});

app.post("/api/rooms/:gameCode/submit-guess", function (request, response) {
    const gameCode = request.params.gameCode.toUpperCase();
    const room = rooms.get(gameCode);

    if (!room) {
        return response.status(404).json({ error: "Room not found." });
    }

    if (room.status !== "playing") {
        return response.status(400).json({ error: "The game is not currently playing." });
    }

    const { playerId, guess } = request.body;

    const player = room.players.find(p => p.id === playerId);

    if (!player) {
        return response.status(403).json({ error: "You are not in this room." });
    }

    if (!guess || !guess.trim()) {
        return response.status(400).json({ error: "Please enter a movie guess." });
    }

    if (room.guesses.some(g => g.playerId === playerId)) {
        return response.status(400).json({ error: "You have already submitted your guess." });
    }

    room.guesses.push({
        playerId: playerId,
        guess: guess.trim()
    });

    response.json({
        success: true,
        message: "Guess submitted successfully."
    });
});

// Move to the next round
app.post("/api/rooms/:gameCode/next-round", function (request, response) {

    const gameCode = request.params.gameCode.toUpperCase();

    // Find the room
    const room = rooms.get(gameCode);

    if (!room) {
        return response.status(404).json({
            error: "Room not found."
        });
    }

    // Make sure the game has started
    if (room.status !== "playing") {
        return response.status(400).json({
            error: "The game is not currently running."
        });
    }

    // Check whether there are more movies
    if (room.currentMovieIndex >= room.movies.length - 1) {
        room.status = "finished";

        return response.json({
            success: true,
            message: "Game finished!",
            status: room.status
        });
    }

    // Move to the next movie
    room.currentMovieIndex++;

    // Rotate the timestamp selector
    rotateTimestampSelector(room);

    response.json({
        success: true,
        message: "Next round started!",
        round: room.currentMovieIndex + 1,
        selectorId: room.currentSelectorId
    });

});

// Handle Socket.IO connections
io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Player joins a game room
    socket.on("join-game-room", (gameCode) => {
        socket.join(gameCode);

        console.log(
            `Socket ${socket.id} joined game room ${gameCode}`
        );
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);
    });
});

server.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});