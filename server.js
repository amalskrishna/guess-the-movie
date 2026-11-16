const express = require("express");
const { chromium } = require("playwright");

const app = express();

const PORT = 3000;

// Allow Express to understand JSON sent by the frontend
app.use(express.json());

// Serve the frontend
app.use(express.static("public"));

function timestampToSeconds(timestamp){
    const parts = timestamp.split(":").map(Number);
    if(parts.length === 2){
        return parts[0]*60+parts[1];
    }
    if(parts.length === 3){
        return parts[0]*3600 + parts[1]*60 + parts[2];
    }
    throw new Error("Invalid timestamp format");
}

// Our first API endpoint
app.post("/api/capture", async function (request, response) {
    const { query, timestamp } = request.body;

    let browser;
    try{
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
        const close = page.locator(
            'button[aria-label="Close"]'
            ).first();
        await close.click();

        // Open search
        const searchButton = page.locator('button[aria-label*="search" i]');
        await searchButton.first().click();

        await page.waitForTimeout(1000);

        // Search movie
        const searchBox = page.locator(
            'input[placeholder="Search keywords..."]'
        );

        await searchBox.fill(query);

        await page.waitForTimeout(2000);

        // Click movie card
        const movieCard = page.locator(`a[aria-label="${query}"]`).first();

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

        console.log(`video jumped to ${timestamp}!`);

        await page.waitForTimeout(2000);

        // Hide controls
        await page.mouse.move(10, 10);
        await page.waitForTimeout(3000);

        // Capture frame
        await videoPlayer.screenshot({
            path: "public/captured-frame.png"
        });

        console.log("screenshot captured...");

        response.json({
            message: "video successfully opened and timestamp reached!",
            query: query,
            timestamp: timestamp,
            imageUrl: "/captured-frame.png"
        });
    }
    catch (error){
        console.error("Automation error: ", error);
        response.status(500).json({
            error: "something went wring during video automation."
        });
    }
    finally{
        if(browser){
            await browser.close();
        }
    }
});

app.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});