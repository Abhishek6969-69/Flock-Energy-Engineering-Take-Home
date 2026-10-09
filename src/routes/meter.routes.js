
const express = require("express");
const { getMeters } = require("../clients/urja.client");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const page = Number(req.query.page || 1);

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        error: "page must be a positive integer",
      });
    }

    const data = await getMeters({ q, page });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
