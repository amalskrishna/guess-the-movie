const { chromium } = require("playwright");

async function main() {
    const browser = await chromium.launch({
        channel: "chrome",
        headless: false
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    context.on("page", async popup => {
        console.log("Popup detected:", popup.url());

        await popup.close().catch(() => {});

        console.log("Popup closed!");
    });

    await page.goto("https://cinejoy.pk/", {
        waitUntil: "domcontentloaded"
    });

    console.log("CineJoy opened!");

    await page.waitForTimeout(2000);

    console.log("Current URL:", page.url());
    console.log("Page title:", await page.title());

    const close = page.locator(
        'button[aria-label="Close"]'
    ).first();
    await close.click();

    
//=============================================================
const searchButton = page.locator('button[aria-label*="search" i]');

await searchButton.first().click();

await page.waitForTimeout(2000);

console.log("Inputs after clicking search:", await page.locator("input").evaluateAll(inputs =>
    inputs.map(input => ({
        placeholder: input.placeholder,
        type: input.type,
        ariaLabel: input.getAttribute("aria-label")
    }))
));


const searchInput = page.locator('input[placeholder="Search keywords..."]');

await searchInput.fill("Interstellar");

await page.waitForTimeout(2000);

const movieCard = page.locator('a[aria-label="Interstellar"]');
console.log("movie card count: ", await movieCard.count());
await movieCard.locator("img").click();
await page.waitForTimeout(2000);
console.log("Current URL:", page.url());
console.log("Page title:", await page.title());


const playButton = page.getByRole("button", {
    name: "Play",
    exact: true
});

console.log("Play button count:", await playButton.count());

await playButton.click();

await page.waitForTimeout(2000);

//=============================================================
const video = page.locator("video");

await video.evaluate(video => {
    video.currentTime = 1625;
});
await page.mouse.move(10,10);
await page.waitForTimeout(5000);

await video.screenshot({
    path: "screenshots/cinejoy-interstellar-frame.png"
});

console.log("Screenshot saved!");
//=============================================================

    await page.waitForTimeout(10000);

    await browser.close();
}

main().catch(error => {
    console.error("Automation failed:", error);
});