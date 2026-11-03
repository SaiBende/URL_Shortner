import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { URL as ShortURL } from "../src/models/url.model.js";
import { Visit } from "../src/models/visit.model.js";

// Seeds a throwaway database with realistic users, links and visits, then
// reports storage per document and indexed query latency. The Atlas Free tier
// limit is 0.5 GB including indexes, so bytes/doc is what drives capacity.
//
// Usage:
//   npm run capacity
//   npm run capacity -- --users 1000 --links-per-user 10 --visits 5000
//   npm run capacity -- --keep     # leave the test database for inspection

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};
const hasFlag = (name) => args.includes(`--${name}`);

const positiveInt = (name, fallback) => {
    const raw = option(name, String(fallback));
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        console.error(`Invalid --${name}: ${raw}`);
        process.exit(1);
    }
    return value;
};

const userCount = positiveInt("users", 1000);
const linksPerUser = positiveInt("links-per-user", 10);
const visitCount = positiveInt("visits", 5000);
const batchSize = positiveInt("batch", 500);
// WiredTiger only refreshes index sizes at checkpoint time (60 s by default),
// so a probe that reads collStats immediately reports near-zero index bytes.
const settleSeconds = positiveInt("settle-seconds", 70);
const keep = hasFlag("keep");

const mongoBase = process.env.MONGODB_URL;
if (!mongoBase) {
    console.error("MONGODB_URL is required to run the capacity probe.");
    process.exit(1);
}

const dbName = `sggs_capacity_${Date.now().toString(36)}_${randomUUID()
    .replace(/-/g, "")
    .slice(0, 6)}`;
if (!/^sggs_capacity_[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsafe capacity database name: ${dbName}`);
}

const STORAGE_LIMIT_BYTES = 500 * 1000 * 1000; // Atlas Free cluster: 0.5 GB
const METADATA_RESERVE = 0.3; // keep 30% for users/links, leave 70% for visits

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = Date.now();
const suffix = randomUUID().replace(/-/g, "").slice(0, 8);

const percentile = (values, p) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const time = async (fn, iterations = 200) => {
    for (let index = 0; index < 20; index += 1) await fn();

    const samples = [];
    for (let index = 0; index < iterations; index += 1) {
        const started = performance.now();
        await fn();
        samples.push(performance.now() - started);
    }

    return {
        p50: Math.round(percentile(samples, 50) * 10) / 10,
        p95: Math.round(percentile(samples, 95) * 10) / 10,
        max: Math.round(Math.max(...samples) * 10) / 10,
    };
};

const insertAll = async (label, collection, docs) => {
    const started = performance.now();
    for (let index = 0; index < docs.length; index += batchSize) {
        const batch = docs.slice(index, index + batchSize);
        await collection.insertMany(batch, { ordered: false });
        const done = Math.min(index + batch.length, docs.length);
        if (done % 5000 === 0 || done === docs.length) {
            console.error(`[capacity] ${label}: ${done}/${docs.length}`);
        }
    }
    return Math.round((performance.now() - started) / 100) / 10;
};

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return "n/a";
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${Math.round(bytes)} B`;
};

const compact = (value) => Math.round(value).toLocaleString("en-US");

await mongoose.connect(mongoBase, {
    dbName,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
});
const db = mongoose.connection.db;

console.error(
    `[capacity] database ${dbName}: ${userCount} users, ${
        userCount * linksPerUser
    } links, ${visitCount} visits`
);

try {
    // Build indexes before inserting so the measured storage includes them from
    // the start and query plans use the same indexes as production.
    await Promise.all([User.init(), ShortURL.init(), Visit.init()]);

    const users = [];
    const links = [];
    const visits = [];

    for (let userIndex = 0; userIndex < userCount; userIndex += 1) {
        const unique = `${suffix}${userIndex.toString(36)}`;
        const handle = `u${unique}`.slice(0, 30);
        const userId = new mongoose.Types.ObjectId();
        const createdAt = new Date(now - userIndex * 60_000);

        users.push({
            _id: userId,
            clerkId: `clerk_capacity_${unique}`,
            username: `Capacity User ${userIndex}`,
            handle,
            identityKey: handle,
            email: `capacity-${unique}@example.test`,
            profilephoto:
                "https://cdn.pixabay.com/photo/2013/07/13/12/33/man-159847_1280.png",
            category: "basic",
            planExpiresAt: null,
            plan: "free",
            subscription: {
                provider: "clerk",
                id: null,
                status: "inactive",
                planSlug: null,
                planName: null,
                planPeriod: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                lastSyncedAt: null,
            },
            urlCount: linksPerUser,
            socialMediaLinks: {},
            description: "Welcome to my page!",
            createdAt,
            updatedAt: createdAt,
        });

        for (let linkIndex = 0; linkIndex < linksPerUser; linkIndex += 1) {
            const shortId = `c${unique}${linkIndex.toString(36)}`.slice(0, 40);
            const linkId = new mongoose.Types.ObjectId();
            const linkCreatedAt = new Date(
                createdAt.getTime() + linkIndex * 60_000
            );

            links.push({
                _id: linkId,
                shortId,
                redirectURL: `https://example.com/capacity/${userIndex}/${linkIndex}`,
                createdBy: userId,
                visitHistory: [],
                visitCount: 0,
                lastVisitAt: null,
                createdAt: linkCreatedAt,
                updatedAt: linkCreatedAt,
            });

            if (visitCount > 0) {
                const visitsForLink =
                    links.length <= visitCount
                        ? Math.floor(visitCount / (userCount * linksPerUser)) +
                          (links.length <= visitCount % (userCount * linksPerUser)
                              ? 1
                              : 0)
                        : 0;

                for (let visitIndex = 0; visitIndex < visitsForLink; visitIndex += 1) {
                    const clickedAt = new Date(
                        now - (visits.length + 1) * 30_000
                    );
                    visits.push({
                        _id: new mongoose.Types.ObjectId(),
                        urlId: linkId,
                        ownerId: userId,
                        shortId,
                        domain: "go.saibende.in",
                        destination: `https://example.com/capacity/${userIndex}/${linkIndex}`,
                        clickedAt,
                        ipHash: "a".repeat(32),
                        ipVersion: 4,
                        continent: "AS",
                        country: "IN",
                        region: "Maharashtra",
                        city: "Pune",
                        timezone: "Asia/Kolkata",
                        latitude: 18.52,
                        longitude: 73.86,
                        userAgent:
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                        browser: "Chrome",
                        browserVersion: "126.0.0.0",
                        os: "Windows",
                        osVersion: "10",
                        deviceType: "desktop",
                        isBot: false,
                        botName: null,
                        language: "en-US",
                        referrer: null,
                        referrerHost: null,
                        channel: "direct",
                        utm: {
                            source: null,
                            medium: null,
                            campaign: null,
                            term: null,
                            content: null,
                        },
                        isQr: false,
                        visitorId: randomUUID(),
                        sessionId: randomUUID(),
                        status: 302,
                        lookupMs: 3,
                        isPrefetch: false,
                        cacheHit: false,
                        requestId: "bom1::bom1::capacity-probe",
                        mode: "redirect",
                    });
                }
            }
        }
    }

    const userSeconds = await insertAll("users", User.collection, users);
    const linkSeconds = await insertAll("links", ShortURL.collection, links);
    const visitSeconds =
        visits.length > 0
            ? await insertAll("visits", Visit.collection, visits)
            : 0;

    if (settleSeconds > 0) {
        console.error(
            `[capacity] waiting ${settleSeconds}s for a WiredTiger checkpoint so index sizes are accurate`
        );
        await sleep(settleSeconds * 1000);
    }

    const stats = {};
    for (const [label, name] of [
        ["users", "users"],
        ["links", "urls"],
        ["visits", "visits"],
    ]) {
        const raw = await db.command({ collStats: name });
        stats[label] = {
            count: raw.count,
            dataBytes: raw.size,
            indexBytes: raw.totalIndexSize,
            totalBytes: raw.size + raw.totalIndexSize,
            avgDocBytes: raw.avgObjSize || 0,
            indexes: raw.nindexes,
        };
    }

    const sampleUsers = users
        .slice(0, Math.min(200, users.length))
        .map((user) => user.identityKey);
    const sampleLinks = links
        .slice(0, Math.min(500, links.length))
        .map((link) => link.shortId);
    const sampleOwners = users
        .slice(0, Math.min(50, users.length))
        .map((user) => user._id);

    let cursor = 0;
    const nextUser = () => sampleUsers[cursor++ % sampleUsers.length];
    const nextLink = () => sampleLinks[cursor++ % sampleLinks.length];
    const nextOwner = () => sampleOwners[cursor++ % sampleOwners.length];

    const handleLatency = await time(() =>
        db.collection("users").findOne({ identityKey: nextUser() })
    );
    const redirectLatency = await time(() =>
        db
            .collection("urls")
            .findOne(
                { shortId: nextLink() },
                { projection: { redirectURL: 1, createdBy: 1 } }
            )
    );
    const dashboardLatency = await time(
        () =>
            db
                .collection("urls")
                .aggregate([
                    { $match: { createdBy: nextOwner() } },
                    {
                        $addFields: {
                            legacyVisitCount: {
                                $size: { $ifNull: ["$visitHistory", []] },
                            },
                        },
                    },
                    { $project: { visitHistory: 0 } },
                ])
                .toArray(),
        30
    );

    const handleExplain = await db
        .collection("users")
        .find({ identityKey: nextUser() })
        .explain("executionStats");
    const redirectExplain = await db
        .collection("urls")
        .find({ shortId: nextLink() })
        .explain("executionStats");

    const winningPlan = (explain) =>
        JSON.stringify(explain.queryPlanner?.winningPlan || {});
    const executionStats = (explain) => explain.executionStats || {};

    const userBytes = stats.users.totalBytes / stats.users.count;
    const linkBytes = stats.links.totalBytes / stats.links.count;
    const visitBytes = stats.visits.count
        ? stats.visits.totalBytes / stats.visits.count
        : 0;

    const perUser = (links) => userBytes + links * linkBytes;
    const maxUsers = (links, reserve = 1) =>
        Math.floor((STORAGE_LIMIT_BYTES * reserve) / perUser(links));
    // Worst case: every account is on the highest limited plan (30 links) and
    // every link has at least one stored visit.
    const worstPerUser = (links, visitsPerLink) =>
        userBytes + links * linkBytes + links * visitsPerLink * visitBytes;
    const maxWorstUsers = (links, visitsPerLink) =>
        Math.floor(STORAGE_LIMIT_BYTES / worstPerUser(links, visitsPerLink));
    const maxVisits = visitBytes
        ? Math.floor(STORAGE_LIMIT_BYTES / visitBytes)
        : null;

    const worstUsersAtOneVisit = maxWorstUsers(30, 1);
    const worstUsersAtTenVisits = maxWorstUsers(30, 10);
    const reservedVisitBytes = STORAGE_LIMIT_BYTES * (1 - METADATA_RESERVE);
    const reservedVisits = visitBytes
        ? Math.floor(reservedVisitBytes / visitBytes)
        : null;

    const report = {
        database: dbName,
        seeded: {
            users: users.length,
            links: links.length,
            visits: visits.length,
            insertSeconds: {
                users: userSeconds,
                links: linkSeconds,
                visits: visitSeconds,
            },
        },
        storageBytes: {
            limit: STORAGE_LIMIT_BYTES,
            users: stats.users,
            links: stats.links,
            visits: stats.visits,
            perUser: Math.round(userBytes),
            perLink: Math.round(linkBytes),
            perVisit: Math.round(visitBytes),
        },
        queryMs: {
            handleLookup: handleLatency,
            redirectLookup: redirectLatency,
            dashboardAggregate: dashboardLatency,
        },
        queryPlans: {
            handleLookup: {
                usesIndex: winningPlan(handleExplain).includes("IXSCAN"),
                docsExamined: executionStats(handleExplain).totalDocsExamined,
                keysExamined: executionStats(handleExplain).totalKeysExamined,
                executionTimeMillis:
                    executionStats(handleExplain).executionTimeMillis,
            },
            redirectLookup: {
                usesIndex: winningPlan(redirectExplain).includes("IXSCAN"),
                docsExamined: executionStats(redirectExplain).totalDocsExamined,
                keysExamined: executionStats(redirectExplain).totalKeysExamined,
                executionTimeMillis:
                    executionStats(redirectExplain).executionTimeMillis,
            },
        },
        capacity: {
            bestUsersAt10Links: maxUsers(10),
            optimalUsersAt10Links: maxUsers(10, METADATA_RESERVE),
            bestUsersAt20Links: maxUsers(20),
            optimalUsersAt20Links: maxUsers(20, METADATA_RESERVE),
            bestUsersAt30Links: maxUsers(30),
            optimalUsersAt30Links: maxUsers(30, METADATA_RESERVE),
            worstUsersAt30Links1Visit: worstUsersAtOneVisit,
            worstLinksAt30Links1Visit: worstUsersAtOneVisit * 30,
            worstVisitsAt30Links1Visit: worstUsersAtOneVisit * 30,
            worstUsersAt30Links10Visits: worstUsersAtTenVisits,
            worstLinksAt30Links10Visits: worstUsersAtTenVisits * 30,
            worstVisitsAt30Links10Visits: worstUsersAtTenVisits * 30 * 10,
            maxVisits,
            reservedVisits,
            daysAt10kVisitsPerDay: maxVisits
                ? Math.floor(maxVisits / 10_000)
                : null,
            daysAt50kVisitsPerDay: maxVisits
                ? Math.floor(maxVisits / 50_000)
                : null,
            reservedDaysAt10kVisitsPerDay: reservedVisits
                ? Math.floor(reservedVisits / 10_000)
                : null,
            reservedDaysAt50kVisitsPerDay: reservedVisits
                ? Math.floor(reservedVisits / 50_000)
                : null,
        },
    };

    console.log(JSON.stringify(report, null, 2));

    console.log("\n### Capacity probe summary\n");
    console.log(
        `Seeded **${compact(users.length)} users**, **${compact(
            links.length
        )} links**, **${compact(
            visits.length
        )} visits** in an isolated Atlas database.\n`
    );
    console.log(
        "| Collection | Docs | Avg doc | Data | Indexes | Total | Bytes/doc |"
    );
    console.log("|---|---:|---:|---:|---:|---:|---:|");
    for (const [label, value] of Object.entries(stats)) {
        console.log(
            `| ${label} | ${compact(value.count)} | ${formatBytes(
                value.avgDocBytes
            )} | ${formatBytes(value.dataBytes)} | ${formatBytes(
                value.indexBytes
            )} | ${formatBytes(value.totalBytes)} | ${compact(
                value.totalBytes / value.count
            )} B |`
        );
    }

    console.log("\n| Query | p50 | p95 | max | Plan |");
    console.log("|---|---:|---:|---:|---|");
    console.log(
        `| Handle availability (\`identityKey\`) | ${handleLatency.p50} ms | ${handleLatency.p95} ms | ${handleLatency.max} ms | ${
            report.queryPlans.handleLookup.usesIndex ? "IXSCAN" : "NO INDEX"
        } |`
    );
    console.log(
        `| Redirect lookup (\`shortId\`) | ${redirectLatency.p50} ms | ${redirectLatency.p95} ms | ${redirectLatency.max} ms | ${
            report.queryPlans.redirectLookup.usesIndex ? "IXSCAN" : "NO INDEX"
        } |`
    );
    console.log(
        `| Dashboard aggregate | ${dashboardLatency.p50} ms | ${dashboardLatency.p95} ms | ${dashboardLatency.max} ms | — |`
    );

    console.log("\n| Scenario (Atlas 0.5 GB) | Users/handles | Links |");
    console.log("|---|---:|---:|");
    for (const links of [10, 20, 30]) {
        const best = maxUsers(links);
        const optimal = maxUsers(links, METADATA_RESERVE);
        console.log(
            `| Best: metadata only, ${links} links/user | ${compact(
                best
            )} | ${compact(best * links)} |`
        );
        console.log(
            `| Optimal: 30% metadata, ${links} links/user | ${compact(
                optimal
            )} | ${compact(optimal * links)} |`
        );
    }
    console.log(
        `| Worst: 30 links/user + 1 visit/link | ${compact(
            worstUsersAtOneVisit
        )} | ${compact(worstUsersAtOneVisit * 30)} |`
    );
    console.log(
        `| Worst: 30 links/user + 10 visits/link | ${compact(
            worstUsersAtTenVisits
        )} | ${compact(worstUsersAtTenVisits * 30)} |`
    );
    if (maxVisits) {
        console.log(
            `| Visits only (no links/users) | — | ${compact(
                maxVisits
            )} visits |`
        );
    }

    console.log(
        `\nPer user: **${compact(userBytes)} B**, per link: **${compact(
            linkBytes
        )} B**, per visit: **${compact(
            visitBytes
        )} B** (documents + indexes).`
    );
    console.log(
        `At 10k visits/day the free cluster holds **${compact(
            report.capacity.daysAt10kVisitsPerDay
        )} days**; at 50k/day, **${compact(
            report.capacity.daysAt50kVisitsPerDay
        )} days** (no TTL/rollups).`
    );
    if (reservedVisits) {
        console.log(
            `With the 30% metadata / 70% visit split, the visit budget is **${compact(
                reservedVisits
            )} visits** (${compact(
                report.capacity.reservedDaysAt10kVisitsPerDay
            )} days at 10k/day, ${compact(
                report.capacity.reservedDaysAt50kVisitsPerDay
            )} days at 50k/day).`
        );
    }
} finally {
    if (keep) {
        console.error(`[capacity] keeping ${dbName}`);
    } else {
        try {
            const collections = await db
                .listCollections({}, { nameOnly: true })
                .toArray();
            for (const collection of collections) {
                await db
                    .dropCollection(collection.name)
                    .catch((error) => {
                        if (error?.codeName !== "NamespaceNotFound") throw error;
                    });
            }
            console.error(`[capacity] cleaned up ${dbName}`);
        } catch (error) {
            console.error(`[capacity] cleanup failed: ${error.message}`);
        }
    }

    await mongoose.connection.close();
    await sleep(0);
}
