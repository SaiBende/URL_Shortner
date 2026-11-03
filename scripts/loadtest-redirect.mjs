import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import autocannon from "autocannon";
import { DB_NAME } from "../src/constants.js";
import { URL as ShortURL } from "../src/models/url.model.js";
import { Visit } from "../src/models/visit.model.js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};
const hasFlag = (name) => args.includes(`--${name}`);

const numberOption = (name, fallback) => {
    const raw = option(name, String(fallback));
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        console.error(`Invalid --${name}: ${raw}`);
        process.exit(1);
    }
    return value;
};

const baseUrl = String(option("url", "http://localhost:8000")).replace(
    /\/+$/,
    ""
);
const connections = numberOption("connections", 50);
const duration = numberOption("duration", 15);
const pipelining = numberOption("pipelining", 1);

try {
    new URL(baseUrl);
} catch {
    console.error(`Invalid --url: ${baseUrl}`);
    process.exit(1);
}

const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl);
if (!isLocal && !hasFlag("yes")) {
    console.error(
        "Refusing to load-test a remote target without --yes.\n" +
            `Target: ${baseUrl}\n` +
            "The run creates one temporary link and removes it afterward, but it " +
            "still produces real traffic. Re-run with --yes to confirm."
    );
    process.exit(1);
}

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
    console.error("MONGODB_URL is required to seed and clean up the test link.");
    process.exit(1);
}

const shortDomain = String(process.env.SHORT_DOMAIN || "go.saibende.in")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const targetHost = new URL(baseUrl).hostname.toLowerCase();
// The dedicated short host answers on "/" via the host branch. Everywhere
// else (localhost, the Vercel backend alias) needs the explicit "/r" route.
const redirectPrefix = targetHost === shortDomain ? "" : "/r";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shortId = `load-${Date.now().toString(36)}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)}`;
const targetUrl = `${baseUrl}${redirectPrefix}/${shortId}?utm_source=loadtest`;
let seeded = false;

const cleanup = async () => {
    if (!seeded) return;

    // Delete the link first: a late analytics write then sees no URL and
    // removes its own orphan Visit.
    const link = await ShortURL.deleteOne({ shortId }).catch((error) => {
        console.error("[loadtest] URL cleanup failed:", error.message);
        return { deletedCount: 0 };
    });
    await sleep(3000);
    const visits = await Visit.deleteMany({ shortId }).catch((error) => {
        console.error("[loadtest] Visit cleanup failed:", error.message);
        return { deletedCount: 0 };
    });

    console.error(
        `[loadtest] cleaned up ${link.deletedCount} link and ${visits.deletedCount} visits for ${shortId}`
    );
};

try {
    await mongoose.connect(`${mongoUrl}/${DB_NAME}`, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 15000,
    });

    await ShortURL.create({
        shortId,
        redirectURL: "https://example.com/sggs-loadtest",
        createdBy: new mongoose.Types.ObjectId(),
    });
    seeded = true;

    console.error(
        `[loadtest] seeded ${shortId} in ${mongoose.connection.name}; ` +
            `count=${await ShortURL.countDocuments({ shortId })}`
    );

    console.error(`[loadtest] probing ${targetUrl}`);
    const probe = await fetch(targetUrl, { redirect: "manual" });
    const probeBody = await probe.text();

    if (probe.status !== 302) {
        throw new Error(
            `Seed link did not redirect (status ${probe.status}) for ${targetUrl}. ` +
                `Body starts with: ${probeBody.slice(0, 120)}`
        );
    }

    console.error(
        `[loadtest] warm-up 302 OK · ${connections} connections · ${duration}s · pipelining ${pipelining}`
    );
    console.error(`[loadtest] target ${targetUrl}`);

    const result = await autocannon({
        url: targetUrl,
        connections,
        duration,
        pipelining,
    });

    // Give the post-response analytics writes a moment, then report what the
    // server itself measured for the database lookup (not client round-trip).
    await sleep(1500);
    const recordedVisits = await Visit.find({ shortId })
        .select("lookupMs -_id")
        .lean();
    const lookups = recordedVisits
        .map((visit) => visit.lookupMs)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const percentile = (value) =>
        lookups[
            Math.min(
                lookups.length - 1,
                Math.floor((value / 100) * lookups.length)
            )
        ];

    const statuses = result.statusCodeStats || {};
    const redirectCount = statuses["302"]?.count || 0;
    const unexpectedStatuses = Object.fromEntries(
        Object.entries(statuses).filter(([code]) => code !== "302")
    );

    console.log(
        JSON.stringify(
            {
                target: baseUrl,
                shortId,
                connections,
                durationSeconds: duration,
                pipelining,
                requests: {
                    total: result.requests.total,
                    averagePerSecond: result.requests.average,
                    sent: result.requests.sent,
                },
                latencyMs: {
                    p50: result.latency.p50,
                    p90: result.latency.p90,
                    p99: result.latency.p99,
                    max: result.latency.max,
                },
                serverLookupMs: {
                    recordedVisits: lookups.length,
                    p50: percentile(50),
                    p95: percentile(95),
                    max: lookups[lookups.length - 1] ?? null,
                },
                throughputMBps:
                    Math.round((result.throughput.average / 1024 / 1024) * 100) /
                    100,
                redirects: redirectCount,
                unexpectedStatuses,
                errors: result.errors,
                timeouts: result.timeouts,
            },
            null,
            2
        )
    );
} catch (error) {
    console.error(`[loadtest] failed: ${error.message}`);
    process.exitCode = 1;
} finally {
    await cleanup();
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
}
