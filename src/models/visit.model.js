import mongoose from "mongoose";

// One document per resolved short link. Kept out of the URL document so the
// redirect hot path never reads or rewrites an ever-growing array.
const utmSchema = new mongoose.Schema(
    {
        source: { type: String, default: null },
        medium: { type: String, default: null },
        campaign: { type: String, default: null },
        term: { type: String, default: null },
        content: { type: String, default: null },
    },
    { _id: false }
);

const visitSchema = new mongoose.Schema(
    {
        // Link context. `shortId` and `destination` are snapshots so reports
        // still make sense after a rename, edit, or delete.
        urlId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "URL",
            required: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        shortId: { type: String, required: true },
        domain: { type: String, required: true },
        destination: { type: String, required: true, maxlength: 2048 },
        clickedAt: { type: Date, default: Date.now, required: true },

        // Network and coarse location. The raw IP is never stored.
        ipHash: { type: String, default: null },
        ipVersion: { type: Number, default: null },
        continent: { type: String, default: null },
        country: { type: String, default: null },
        region: { type: String, default: null },
        city: { type: String, default: null },
        timezone: { type: String, default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },

        // Client details. The raw user agent is kept for re-parsing later.
        userAgent: { type: String, default: null, maxlength: 512 },
        browser: { type: String, default: null },
        browserVersion: { type: String, default: null },
        os: { type: String, default: null },
        osVersion: { type: String, default: null },
        deviceType: { type: String, default: null },
        isBot: { type: Boolean, default: false },
        botName: { type: String, default: null },
        language: { type: String, default: null },

        // Acquisition.
        referrer: { type: String, default: null, maxlength: 1024 },
        referrerHost: { type: String, default: null },
        channel: { type: String, default: "direct" },
        utm: { type: utmSchema, default: () => ({}) },
        isQr: { type: Boolean, default: false },

        // Pseudonymous visitor identity (first-party cookie, not a fingerprint).
        visitorId: { type: String, default: null },
        sessionId: { type: String, default: null },

        // Request quality and operations.
        status: { type: Number, default: 302 },
        lookupMs: { type: Number, default: null },
        isPrefetch: { type: Boolean, default: false },
        cacheHit: { type: Boolean, default: false },
        requestId: { type: String, default: null },
        mode: {
            type: String,
            enum: ["redirect", "json"],
            default: "redirect",
        },
    },
    { timestamps: false, versionKey: false }
);

// Dashboard and reporting queries.
visitSchema.index({ urlId: 1, clickedAt: -1 });
visitSchema.index({ ownerId: 1, clickedAt: -1 });
visitSchema.index({ shortId: 1, clickedAt: -1 });
visitSchema.index({ domain: 1, clickedAt: -1 });
visitSchema.index({ urlId: 1, visitorId: 1, clickedAt: -1 });

// Retention is intentionally not enforced yet. Add a TTL index once the
// product's privacy/retention policy is final (for example 90 days on
// clickedAt), and keep daily rollups for long-term reporting.

const Visit = mongoose.model("Visit", visitSchema);

export { Visit };
