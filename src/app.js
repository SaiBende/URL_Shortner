import "./config/env.js"; // must be the first import so process.env is populated
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { clerkMiddleware } from "@clerk/express";
import { router } from "./routes/url.router.js";
import { authroute } from "./routes/auth.route.js";
import { publicprofileroute } from "./routes/publicprofile.route.js";
import { publicsiteRoute } from "./routes/publicsite.route.js";
import { billingRoute } from "./routes/billing.route.js";
import { apiLimiter } from "./middlewares/ratelimit.middleware.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// Trust the first proxy hop (Vercel) so rate limiting sees the real client IP
app.set("trust proxy", 1);

const STATIC_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://sggs.saibende.in", // current frontend
    "https://sggs-kappa.vercel.app", // legacy Vercel alias
];

// FRONTEND_URL may contain one or more comma-separated origins
const getAllowedOrigins = () =>
    [
        ...STATIC_ALLOWED_ORIGINS,
        ...(process.env.FRONTEND_URL || "")
            .split(",")
            .map((origin) => origin.trim().replace(/\/+$/, ""))
            .filter(Boolean),
    ];

// Public tenant pages call the API from handle.sggs.saibende.in. Those origins
// are not known ahead of time, so allow the platform suffix (and *.localhost
// while developing). This only grants CORS, not authentication.
const platformDomain = String(
    process.env.PLATFORM_DOMAIN || "sggs.saibende.in"
)
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");

const isPlatformOrigin = (origin) => {
    try {
        const url = new URL(origin);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;

        const host = url.hostname.toLowerCase();
        if (host.endsWith(`.${platformDomain}`)) return true;
        if (process.env.NODE_ENV !== "production" && host.endsWith(".localhost")) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

// Clerk must run before all other middleware. It verifies bearer session
// tokens and attaches the auth state consumed by `getAuth(req)`.
const clerkConfigured = Boolean(
    process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

if (clerkConfigured) {
    app.use(
        clerkMiddleware({
            // Reject session tokens minted for an origin we don't serve.
            authorizedParties: getAllowedOrigins(),
        })
    );
} else {
    console.warn(
        "[clerk] CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY are missing. " +
            "Protected API routes will return 503 until they are configured."
    );
}

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests without an Origin header (curl, server-to-server)
        if (!origin) return callback(null, true);

        const normalized = origin.replace(/\/+$/, "");
        if (getAllowedOrigins().includes(normalized) || isPlatformOrigin(normalized)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// General rate limit for the whole API
app.use("/api", apiLimiter);

// Named API routes must be registered before the short-link router. Its
// `GET /:shortId` catch-all would otherwise treat `/api/billing` as the short
// ID "billing" and return 404 instead of the billing payload.
app.use("/api/billing", billingRoute);
app.use("/api/user", authroute);
app.use("/api/u", publicprofileroute);
app.use("/api/public", publicsiteRoute);
app.use("/api", router);

// 404 + global error handler (must be registered last)
app.use(notFound);
app.use(errorHandler);

export { app };
