// JSON 404 for unknown routes (registered after all routers)
const notFound = (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Central error handler — keeps API responses JSON instead of HTML stack traces
// (4 arguments required by Express to recognize it as an error handler)
const errorHandler = (err, req, res, next) => {
    console.error("Unhandled error:", err);

    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Internal Server Error" });
};

export { notFound, errorHandler };
