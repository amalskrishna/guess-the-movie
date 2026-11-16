const { chromium } = require("playwright");

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

async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    await page.goto("https://www.youtube.com");

    console.log("YouTube opened!");

    const searchBox = page.locator('input[name="search_query"]');

    await searchBox.fill("minecraft");

    await searchBox.press("Enter");

    const firstVideo = page.locator("ytd-video-renderer").first();

    const videoLink = firstVideo.locator("a#video-title");

    await videoLink.waitFor({
        state: "visible"
    });

    await videoLink.click();

    console.log("First video opened.");

    const videoPlayer = page.locator("#movie_player video");

    await videoPlayer.waitFor({
        state : "visible"
    });

    console.log("video player detected!");

    const timestamp = "02:35";
    const seconds = timestampToSeconds(timestamp);

    await videoPlayer.evaluate((video, time) => {
        video.currentTime = time;
    }, seconds);

    console.log(`Video jumped to ${timestamp}!`);


    await page.waitForTimeout(5000);

    await browser.close();
}

main();