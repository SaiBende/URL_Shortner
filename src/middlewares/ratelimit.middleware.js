import rateLimit from "express-rate-limit";

// General API limiter — generous, protects against obvious abuse.
// Brute-force protection for credentials is handled by Clerk.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 300, // per IP
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
});

// Availability checks are debounced in the UI, but keep a tighter ceiling so
// the endpoint cannot be used to enumerate names quickly.
const identityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 90,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many name checks. Please wait a moment and try again.",
    },
});

export { apiLimiter, identityLimiter };
