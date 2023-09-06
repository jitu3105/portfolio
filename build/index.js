const express = require("express");
const path = require("path");
const app = express();
app.use(express.static("./static"));
app.get("*", (req, res) => {
  console.log(path.resolve(__dirname, "static", "index.html"));
  res.sendFile(path.resolve(__dirname, "static", "index.html"));
});
app.listen(5173, () => {
  console.log("frontendrunning on 5173");
});
