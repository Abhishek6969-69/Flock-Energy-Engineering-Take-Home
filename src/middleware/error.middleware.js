function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Log diagnostic details on the server, not in the API response.
  console.error("API Error:", {
    message: err.message,
    status: err.statusCode,
    method: req.method,
    path: req.originalUrl,
  });

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    const isTimeout =
      err.code === "ECONNABORTED" ||
      err.code === "ETIMEDOUT";

    return res.status(isTimeout ? 504 : statusCode).json({
      error: isTimeout ? "UPSTREAM_TIMEOUT" : "INTERNAL_SERVER_ERROR",
      message: isTimeout
        ? "The upstream service took too long to respond"
        : "An unexpected error occurred",
    });
  }

  return res.status(statusCode).json({
    error: err.code || "REQUEST_ERROR",
    message: err.message,
  });
}

module.exports = errorHandler;