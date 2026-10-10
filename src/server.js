
require("dotenv").config();

const express = require("express");
const meterRoutes = require("./routes/meter.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health-check endpoint.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Flock Energy API is running",
  });
});

// Register API routes before error handling.
app.use("/api/v1/meters", meterRoutes);

// Handle unknown endpoints.
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Always register error middleware last.
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Flock Energy API running on port ${PORT}`);
});
