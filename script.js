const form = document.getElementById("capture-form");

form.addEventListener("submit", function (event) {

    event.preventDefault();

    const searchQuery = document.getElementById("search-query").value;
    const timestamp = document.getElementById("timestamp").value;

    console.log("Search query:", searchQuery);
    console.log("Timestamp:", timestamp);

});