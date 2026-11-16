const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

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

app.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});