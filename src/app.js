
require("dotenv").config();

const express = require("express");
const meterRoutes = require("./routes/meter.routes");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/meters", meterRoutes);

app.use((err, req, res, next) => {
  console.error("Request failed:", err.message);

  res.status(502).json({
    error: "Unable to retrieve data from the meter portal",
  });
});

module.exports = app;
