
const BASE_URL = "http://localhost:3000";

async function testNextRound() {

    // Create a game room
    const createResponse = await fetch(`${BASE_URL}/api/generate-movies`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            hostName: "Alex",
            prompt: "Science fiction movies",
            count: 3
        })
    });

    const game = await createResponse.json();

    if (!createResponse.ok) {
        throw new Error(game.error || "Room creation failed.");
    }

    const gameCode = game.gameCode;
    const hostId = game.hostId;

    console.log("Game created:", gameCode);

    // Join a second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${gameCode}/join`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            playerName: "Sam"
        })
    });

    const joined = await joinResponse.json();

    if (!joinResponse.ok) {
        throw new Error(joined.error || "Joining failed.");
    }

    console.log("Sam joined:", joined.playerId);

    // Start the game
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${gameCode}/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            playerId: hostId
        })
    });

    const started = await startResponse.json();

    if (!startResponse.ok) {
        throw new Error(started.error || "Starting game failed.");
    }

    console.log("Game started:", started);

    // Move to the next round
    const nextResponse = await fetch(`${BASE_URL}/api/rooms/${gameCode}/next-round`, {
        method: "POST"
    });

    const next = await nextResponse.json();

    if (!nextResponse.ok) {
        throw new Error(next.error || "Next round failed.");
    }

    console.log("Next round:", next);
}

testNextRound().catch(console.error);
