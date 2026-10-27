// Short IDs that can never resolve as links.
//
// Two things shadow a short link before it is looked up:
// 1. Named API mounts under /api (registered before the `/:shortId` router).
// 2. Static frontend pages and path prefixes (resolved before `/:shortId`).
//
// Express routing is case-insensitive, so the check must be too.

export const RESERVED_SHORT_IDS = new Set([
    // API mounts under /api
    "billing",
    "user",
    "u",
    // Frontend pages
    "about",
    "dashboard",
    "forgot-password",
    "linktree",
    "login",
    "payment",
    "pricing",
    "qrgenerate",
    "register",
    "services",
    "shortenlink",
]);

export const isReservedShortId = (value) =>
    RESERVED_SHORT_IDS.has(String(value ?? "").trim().toLowerCase());
