const express = require("express");
const { chromium } = require("playwright");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const app = express();
const PORT = 3000;
const rooms = new Map();

app.use(express.json());
app.use(express.static("public"));
app.get("/test", function (request, response) {
    response.send("You are running the correct server.js!");
});

// Convert timestamp into seconds
function timestampToSeconds(timestamp) {
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
            headless: false
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

        const hostId = Math.random().toString(36).substring(2,12);
        // Create a room 
        rooms.set(gameCode, {
            hostId: hostId,
            players: [
                {
                    id: hostId,
                    name: hostName.trim(),
                    isHost: true
                }
            ],
            movies: movieList.movies,
            currentMovieIndex: 0,
            status: "waiting"
        });

        // Send game code to frontend
        response.json({
            success: true,
            message: "Game room generated successfully!",
            gameCode: gameCode,
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


app.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});