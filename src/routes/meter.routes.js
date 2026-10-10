
const express = require("express");

const {
  getMeters,
  getMeterDetails,
  getMeterConsumption,
} = require("../clients/urja.client");

const router = express.Router();

// Validate meter IDs such as J100000.
function isValidMeterId(meterId) {
  return /^J\d{6}$/.test(meterId);
}

// GET /api/v1/meters?q=&page=1
// List and search meters with pagination.
router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const pageValue = req.query.page ?? "1";

    // Ensure page is a positive integer.
    if (!/^\d+$/.test(String(pageValue))) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "page must be a positive integer",
      });
    }

    const page = Number(pageValue);

    if (!Number.isSafeInteger(page) || page < 1) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "page must be a positive integer",
      });
    }

    // Limit search query length.
    if (q.length > 100) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "q must not exceed 100 characters",
      });
    }

    const result = await getMeters({ q, page });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/meters/:id/consumption
// Retrieve normalized energy consumption history.
router.get("/:id/consumption", async (req, res, next) => {
  try {
    const meterId = req.params.id.trim();

    if (!isValidMeterId(meterId)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid meter ID format. Expected format: J100000",
      });
    }

    const result = await getMeterConsumption(meterId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/meters/:id
// Retrieve meter details, location, and hierarchy.
router.get("/:id", async (req, res, next) => {
  try {
    const meterId = req.params.id.trim();

    if (!isValidMeterId(meterId)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid meter ID format. Expected format: J100000",
      });
    }

    const result = await getMeterDetails(meterId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
