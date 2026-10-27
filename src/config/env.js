import dotenv from "dotenv";

// Load .env exactly once, before any module that reads process.env at load time
// (e.g. the Stripe client). Existing environment variables (Vercel dashboard,
// CI) are NOT overridden by dotenv.
dotenv.config({ path: "./.env" });
