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
            headless : false
        });
        const page = await browser.newPage();
        await page.goto("https://www.youtube.com");
        const searchBox = page.locator('input[name = "search_query"]');
        await searchBox.fill(query);
        await searchBox.press("Enter");

        const firstVideo = page.locator("ytd-video-renderer").first();
        const videoLink = firstVideo.locator("a#video-title");
        await videoLink.waitFor({
            state: "visible"
        });
        await videoLink.click();

        const videoPlayer = page.locator("#movie_player video");
        await videoPlayer.waitFor({
            status: "visible"
        });

        await videoPlayer.evaluate((video,time) => {
            video.currentTime = time;
        }, seconds);
        console.log(`video jumped to ${timestamp}!`);
        await page.waitForTimeout(10000);

        response.json({
            message: "video successfully opened and timestamp reached!",
            query: query,
            timestamp: timestamp
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