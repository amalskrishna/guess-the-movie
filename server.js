const express = require("express");

const app = express();

const PORT = 3000;

app.get("/", function (request, response) {
    response.send("Video Frame Capture backend is working!");
});

app.listen(PORT, function () {
    console.log(`Server running at http://localhost:${PORT}`);
});