const { chromium } = require("playwright");
const fs =require("fs");
fs.mkdirSync("screenshots", {recursive: true});

async function main() {
    const browser = await chromium.launch({
        channel: "chrome",
        headless: false
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Detect and close unwanted advertisement popups
    context.on("page", async popup => {

        //await popup.close().catch(() => {});

        console.log("Popup closed!");
    });

    // Open Movy
    await page.goto("https://www.movy.sx/", {
        waitUntil: "domcontentloaded"
    });

    console.log("Movy opened!");

    await page.waitForTimeout(3000);

    // Locate the main search button
    const searchButton = page.locator(
        'button[aria-label="Search"]'
    ).first();

    // First click: trigger the unwanted popup
    await searchButton.click();

    await page.waitForTimeout(1500);

    // Second click: open the search interface
    await searchButton.click();

    console.log("Search button clicked again!");

    // Find the search input
    const searchInput = page.locator(
        'input[placeholder="Search movies, shows, and anime"]'
    );

    await searchInput.waitFor({ state: "visible" });

    // Enter movie title
    await searchInput.fill("Interstellar");

    console.log("Interstellar entered!");

    // Wait for the Interstellar search result
    const movieResult = page.getByRole("button", {
        name: /Interstellar/
    }).first();

    await movieResult.waitFor({ state: "visible" });

    // Click the movie
    await movieResult.click();

    console.log("Interstellar selected!");

/*========================
console.log("Iframes:", await page.locator("iframe").count());

const iframeInfo = await page.locator("iframe").evaluateAll(iframes =>
    iframes.map(frame => ({
        src: frame.src,
        width: frame.getBoundingClientRect().width,
        height: frame.getBoundingClientRect().height,
        visible: !!(
            frame.offsetWidth ||
            frame.offsetHeight ||
            frame.getClientRects().length
        )
    }))
);

console.log("Iframe info:", iframeInfo);
//===============*/

    // Find and click the Play button
    const playButton = page.getByRole("link", {
        name: "Play",
        exact: true
    });

    await playButton.waitFor({ state: "visible" });
    await playButton.click();

await page.waitForTimeout(3000);


//=========================================================

const video = page.locator("video");

// Seek to 10 minutes and 25 seconds
await video.evaluate(v => {
    v.currentTime = 1625;
});

// Wait for the video to update
await page.waitForTimeout(8000);

// Check the new playback position
const currentTime = await video.evaluate(v => v.currentTime);

console.log("Current video time:", currentTime);

//============================================================
// Pause the video at the current frame
//await video.evaluate(v => v.pause());

// Capture the video element
await video.screenshot({
    path: "screenshots/interstellar-frame.png"
});

console.log("Screenshot captured!");


    // Keep browser open so we can inspect the results
    await page.waitForTimeout(360000);

    await browser.close();
}

main().catch(error => {
    console.error("Automation failed:", error);
});
