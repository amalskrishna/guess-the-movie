const express = require("express");

const app = express();

const PORT = 3000;

// Allow Express to understand JSON sent by the frontend
app.use(express.json());

// Serve the frontend
app.use(express.static("public"));

// Our first API endpoint
app.post("/api/capture", function (request, response) {
    const { query, timestamp } = request.body;

    console.log("Received query:", query);
    console.log("Received timestamp:", timestamp);

    response.json({
        message: "Request received successfully!",
        query: query,
        timestamp: timestamp
    });
});

app.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});