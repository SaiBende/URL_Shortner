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

export { apiLimiter };
