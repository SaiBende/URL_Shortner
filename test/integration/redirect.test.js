import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";

// Load .env first, then override anything that would start Clerk or reuse the
// development database. dotenv does not overwrite keys that already exist.
await import("../../src/config/env.js");

process.env.NODE_ENV = "test";
process.env.CLERK_PUBLISHABLE_KEY = "";
process.env.CLERK_SECRET_KEY = "";
process.env.ANALYTICS_HASH_SECRET = "sggs-integration-test-secret";
process.env.SHORT_DOMAIN = "go.saibende.in";

const mongoBase = process.env.MONGODB_URL;
if (!mongoBase) {
    throw new Error(
        "MONGODB_URL is required for integration tests. Use the same Atlas URL as the app; the suite creates and drops an isolated sggs_test_* database."
    );
}

// A uniquely named throwaway database. The name is validated again before the
// drop in `after` so a misconfiguration can never touch the real database.
const dbName = `sggs_test_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
if (!/^sggs_test_[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Refusing to use unsafe test database name: ${dbName}`);
}

const mongoose = (await import("mongoose")).default;
const { app } = await import("../../src/app.js");
const { URL: ShortURL } = await import("../../src/models/url.model.js");
const { Visit } = await import("../../src/models/visit.model.js");
const { User } = await import("../../src/models/user.model.js");
const { dashboard } = await import(
    "../../src/controllers/dashboard.controller.js"
);
const { handleURLStatus } = await import(
    "../../src/controllers/urlstatus.controller.js"
);
const { handleDeleteURL } = await import(
    "../../src/controllers/deleteurl.controller.js"
);

let server;
let port;
let sequence = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uniqueShortId = (prefix) => {
    sequence += 1;
    return `${prefix}${Date.now().toString(36)}${sequence.toString(36)}${randomUUID()
        .replace(/-/g, "")
        .slice(0, 4)}`;
};

const request = (path, { method = "GET", headers = {} } = {}) =>
    new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path,
                method,
                headers,
            },
            (res) => {
                const chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: Buffer.concat(chunks).toString("utf8"),
                    });
                });
            }
        );

        req.on("error", reject);
        req.end();
    });

const waitFor = async (read, predicate, label) => {
    const deadline = Date.now() + 8000;
    let last;

    while (Date.now() < deadline) {
        last = await read();
        if (predicate(last)) return last;
        await sleep(50);
    }

    throw new Error(
        `Timed out waiting for ${label}. Last value: ${JSON.stringify(last)}`
    );
};

const waitForVisit = (shortId) =>
    waitFor(
        () => Visit.findOne({ shortId }).lean(),
        (visit) => Boolean(visit),
        `a Visit for ${shortId}`
    );

const createLink = async ({ ownerId, ...overrides } = {}) =>
    ShortURL.create({
        shortId: uniqueShortId("it"),
        redirectURL: "https://example.com/landing",
        createdBy: ownerId || new mongoose.Types.ObjectId(),
        ...overrides,
    });

const createUser = async () => {
    const suffix = uniqueShortId("user");
    return User.create({
        username: suffix,
        email: `${suffix}@example.test`,
    });
};

const invoke = async (controller, req) => {
    let statusCode = 200;
    let payload;

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            payload = body;
            return this;
        },
    };

    await controller(req, res);
    return { statusCode, payload };
};

const cookieHeader = (response) =>
    []
        .concat(response.headers["set-cookie"] || [])
        .join("; ");

before(async () => {
    await mongoose.connect(mongoBase, {
        dbName,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 15000,
    });

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    port = server.address().port;
});

after(async () => {
    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }

        if (mongoose.connection.readyState === 1) {
            if (!/^sggs_test_[a-z0-9_]+$/.test(dbName)) {
                throw new Error(`Refusing to clean unsafe database: ${dbName}`);
            }

            // The Atlas application user can drop collections but not the
            // database itself. Dropping every collection leaves no data behind.
            const collections = await mongoose.connection.db
                .listCollections({}, { nameOnly: true })
                .toArray();

            for (const collection of collections) {
                await mongoose.connection.db
                    .dropCollection(collection.name)
                    .catch((error) => {
                        if (error?.codeName !== "NamespaceNotFound") throw error;
                    });
            }
        }
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    }
});

test("GET /r/:shortId returns a 302, forwards UTM params and records one Visit", async () => {
    const shortId = uniqueShortId("redirect");
    const link = await createLink({
        shortId,
        redirectURL: "https://example.com/landing?existing=1",
    });

    const response = await request(
        `/r/${shortId}?utm_source=newsletter&utm_medium=email&utm_campaign=launch&qr=1&src=qr&tag=a&tag=b`,
        {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
                "x-vercel-ip-country": "IN",
                "x-vercel-ip-city": "Pune",
                referer: "https://www.google.com/search?q=sggs",
            },
        }
    );

    assert.equal(response.status, 302);
    assert.match(
        String(response.headers["cache-control"]),
        /no-store/
    );
    assert.equal(response.headers["x-robots-tag"], "noindex");

    const location = new URL(response.headers.location);
    assert.equal(location.origin, "https://example.com");
    assert.equal(location.pathname, "/landing");
    assert.equal(location.searchParams.get("existing"), "1");
    assert.equal(location.searchParams.get("utm_source"), "newsletter");
    assert.equal(location.searchParams.get("utm_medium"), "email");
    assert.equal(location.searchParams.get("utm_campaign"), "launch");
    assert.equal(location.searchParams.get("qr"), null);
    assert.equal(location.searchParams.get("src"), null);
    assert.deepEqual(location.searchParams.getAll("tag"), ["a", "b"]);

    const cookies = cookieHeader(response);
    assert.match(cookies, /sggs_vid=/);
    assert.match(cookies, /sggs_sid=/);
    assert.match(cookies, /HttpOnly/);
    assert.match(cookies, /SameSite=Lax/);

    const visit = await waitForVisit(shortId);
    assert.equal(visit.urlId.toString(), link._id.toString());
    assert.equal(visit.ownerId.toString(), link.createdBy.toString());
    assert.equal(visit.mode, "redirect");
    assert.equal(visit.status, 302);
    assert.equal(visit.domain, "127.0.0.1");
    assert.equal(visit.destination, "https://example.com/landing?existing=1");
    assert.equal(visit.channel, "qr");
    assert.equal(visit.isQr, true);
    assert.equal(visit.utm.source, "newsletter");
    assert.equal(visit.utm.medium, "email");
    assert.equal(visit.utm.campaign, "launch");
    assert.equal(visit.country, "IN");
    assert.equal(visit.city, "Pune");
    assert.equal(visit.referrerHost, "www.google.com");
    assert.match(visit.ipHash, /^[a-f0-9]{32}$/);
    assert.equal(visit.ipVersion, 4);
    assert.ok(visit.visitorId);
    assert.ok(visit.sessionId);
    assert.equal(visit.isBot, false);
    assert.ok(Number.isFinite(visit.lookupMs));

    const updated = await waitFor(
        () => ShortURL.findOne({ shortId }).lean(),
        (url) => url?.visitCount === 1,
        "visitCount to reach 1"
    );
    assert.ok(updated.lastVisitAt instanceof Date);
});

test("the SHORT_DOMAIN host branch serves the same 302 redirect", async () => {
    const shortId = uniqueShortId("host");
    await createLink({ shortId });

    const response = await request(`/${shortId}?utm_source=go-host`, {
        headers: {
            host: "go.saibende.in",
            "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
        },
    });

    assert.equal(response.status, 302);
    assert.match(String(response.headers.location), /utm_source=go-host/);
    assert.match(cookieHeader(response), /sggs_vid=/);

    const visit = await waitForVisit(shortId);
    assert.equal(visit.domain, "go.saibende.in");
    assert.equal(visit.mode, "redirect");
    assert.equal(visit.status, 302);
});

test("unknown short IDs return HTML 404 and never write a Visit", async () => {
    const shortId = uniqueShortId("missing");

    const response = await request(`/r/${shortId}`);

    assert.equal(response.status, 404);
    assert.match(String(response.headers["content-type"]), /text\/html/);
    assert.match(String(response.headers["cache-control"]), /no-store/);
    assert.match(response.body, /This link has gone missing/);
    assert.equal(response.headers["set-cookie"], undefined);

    await sleep(250);
    assert.equal(await Visit.countDocuments({ shortId }), 0);
});

test("non-HTTP destinations are rejected without recording a click", async () => {
    const shortId = uniqueShortId("unsafe");
    await createLink({ shortId, redirectURL: "javascript:alert(1)" });

    const response = await request(`/r/${shortId}`);

    assert.equal(response.status, 500);
    assert.equal(response.headers.location, undefined);
    assert.match(response.body, /This link is unavailable/);
    assert.match(String(response.headers["cache-control"]), /no-store/);

    await sleep(250);
    assert.equal(await Visit.countDocuments({ shortId }), 0);
    const link = await ShortURL.findOne({ shortId }).lean();
    assert.equal(link.visitCount, 0);
});

test("GPC requests receive no cookies but still produce an anonymous Visit", async () => {
    const shortId = uniqueShortId("gpc");
    await createLink({ shortId });

    const response = await request(`/r/${shortId}`, {
        headers: {
            "sec-gpc": "1",
            "user-agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
        },
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers["set-cookie"], undefined);

    const visit = await waitForVisit(shortId);
    assert.equal(visit.visitorId, null);
    assert.equal(visit.sessionId, null);
    assert.equal(visit.mode, "redirect");
});

test("the legacy JSON route still redirects and records mode=json", async () => {
    const shortId = uniqueShortId("legacy");
    await createLink({
        shortId,
        redirectURL: "https://example.org/legacy",
    });

    const response = await request(`/api/${shortId}?utm_source=legacy`);

    assert.equal(response.status, 200);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.match(String(response.headers["cache-control"]), /no-store/);
    assert.deepEqual(JSON.parse(response.body), {
        redirectURL: "https://example.org/legacy",
    });

    const visit = await waitForVisit(shortId);
    assert.equal(visit.mode, "json");
    assert.equal(visit.status, 200);
    assert.equal(visit.domain, "127.0.0.1");

    const updated = await waitFor(
        () => ShortURL.findOne({ shortId }).lean(),
        (url) => url?.visitCount === 1,
        "legacy visitCount to reach 1"
    );
    assert.ok(updated.lastVisitAt instanceof Date);
});

test("dashboard reports legacy + Visit click totals and hides visitHistory", async () => {
    const user = await createUser();
    const shortId = uniqueShortId("dash");
    const link = await createLink({
        shortId,
        ownerId: user._id,
        visitCount: 3,
        visitHistory: [{ timestamp: 1700000000000 }, { timestamp: 1700000001000 }],
    });

    await User.updateOne({ _id: user._id }, { $set: { urlCount: 1 } });

    const { statusCode, payload } = await invoke(dashboard, {
        user: { user_id: String(user._id) },
        query: {},
        body: {},
    });

    assert.equal(statusCode, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.user.username, user.username);

    const row = payload.urls.find((url) => url.shortId === shortId);
    assert.ok(row, "dashboard must include the seeded link");
    assert.equal(row.clicks, 5);
    assert.equal(row.visitHistory, undefined);
    assert.equal(row.visitCount, 3);
    assert.equal(row._id.toString(), link._id.toString());
});

test("URL status merges legacy timestamps with Visit rows and enforces ownership", async () => {
    const user = await createUser();
    const link = await createLink({
        ownerId: user._id,
        visitHistory: [{ timestamp: 1000 }],
    });

    await Visit.create([
        {
            urlId: link._id,
            ownerId: user._id,
            shortId: link.shortId,
            domain: "go.saibende.in",
            destination: link.redirectURL,
            clickedAt: new Date(3000),
        },
        {
            urlId: link._id,
            ownerId: user._id,
            shortId: link.shortId,
            domain: "go.saibende.in",
            destination: link.redirectURL,
            clickedAt: new Date(4000),
        },
    ]);

    const ownerResponse = await invoke(handleURLStatus, {
        params: { shortId: link.shortId },
        user: { user_id: String(user._id) },
    });

    assert.equal(ownerResponse.statusCode, 200);
    assert.deepEqual(
        ownerResponse.payload.visitHistory.map((visit) => visit.timestamp),
        [1000, 3000, 4000]
    );
    assert.equal(ownerResponse.payload.visitHistoryLength, 3);
    assert.equal(ownerResponse.payload.visitCount, 3);
    assert.equal(ownerResponse.payload.shortId, link.shortId);

    const strangerResponse = await invoke(handleURLStatus, {
        params: { shortId: link.shortId },
        user: { user_id: String(new mongoose.Types.ObjectId()) },
    });

    assert.equal(strangerResponse.statusCode, 403);
});

test("deleting a link removes its Visits and decrements the user's URL count", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { $set: { urlCount: 2 } });

    const link = await createLink({ ownerId: user._id });
    await Visit.create([
        {
            urlId: link._id,
            ownerId: user._id,
            shortId: link.shortId,
            domain: "go.saibende.in",
            destination: link.redirectURL,
        },
        {
            urlId: link._id,
            ownerId: user._id,
            shortId: link.shortId,
            domain: "go.saibende.in",
            destination: link.redirectURL,
        },
    ]);

    const denied = await invoke(handleDeleteURL, {
        params: { shortId: link.shortId },
        user: { user_id: String(new mongoose.Types.ObjectId()) },
    });

    assert.equal(denied.statusCode, 404);
    assert.ok(await ShortURL.exists({ shortId: link.shortId }));
    assert.equal(await Visit.countDocuments({ urlId: link._id }), 2);

    const deleted = await invoke(handleDeleteURL, {
        params: { shortId: link.shortId },
        user: { user_id: String(user._id) },
    });

    assert.equal(deleted.statusCode, 200);
    assert.equal(deleted.payload.success, true);
    assert.equal(await ShortURL.exists({ shortId: link.shortId }), null);
    assert.equal(await Visit.countDocuments({ urlId: link._id }), 0);

    const updatedUser = await User.findById(user._id).lean();
    assert.equal(updatedUser.urlCount, 1);
});
