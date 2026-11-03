import crypto from "node:crypto";
import { URL as ShortURL } from "../models/url.model.js";
import { Visit } from "../models/visit.model.js";

const VISITOR_COOKIE = "sggs_vid";
const SESSION_COOKIE = "sggs_sid";
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE = 30 * 60 * 1000;
const INTERNAL_QUERY_PARAMS = new Set(["qr", "src"]);
const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

const PLATFORM_DOMAIN = String(
    process.env.PLATFORM_DOMAIN || "sggs.saibende.in"
)
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");

if (
    process.env.NODE_ENV === "production" &&
    !process.env.ANALYTICS_HASH_SECRET
) {
    console.warn(
        "[analytics] ANALYTICS_HASH_SECRET is not set; using CLERK_SECRET_KEY or a development fallback for IP hashing."
    );
}

const SEARCH_HOSTS = [
    "bing.com",
    "duckduckgo.com",
    "search.yahoo.com",
    "yahoo.com",
    "baidu.com",
    "ecosia.org",
];

const SOCIAL_HOSTS = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "t.co",
    "linkedin.com",
    "tiktok.com",
    "reddit.com",
    "whatsapp.com",
    "wa.me",
    "telegram.org",
    "t.me",
    "discord.com",
    "youtube.com",
    "youtu.be",
    "pinterest.com",
    "threads.net",
];

const matchesDomain = (host, domains) =>
    domains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
    );

const isSearchHost = (host) =>
    /(^|\.)google\.[a-z.]+$/.test(host) ||
    /(^|\.)yandex\.[a-z.]+$/.test(host) ||
    matchesDomain(host, SEARCH_HOSTS);

const isSocialHost = (host) => matchesDomain(host, SOCIAL_HOSTS);

const BOT_PATTERNS = [
    [/googlebot/i, "Googlebot"],
    [/bingbot/i, "Bingbot"],
    [/slackbot/i, "Slackbot"],
    [/discordbot/i, "Discordbot"],
    [/twitterbot/i, "Twitterbot"],
    [/facebookexternalhit/i, "Facebook"],
    [/whatsapp/i, "WhatsApp"],
    [/telegrambot/i, "Telegram"],
    [/linkedinbot/i, "LinkedIn"],
    [/applebot/i, "Applebot"],
    [/bot\b|crawler|spider|preview/i, "Other bot"],
];

const asString = (value, max = 512) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, max) : null;
};

const decodeHeader = (value, max = 160) => {
    const text = asString(value, max);
    if (!text) return null;
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
};

const toNumber = (value) => {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const roundCoordinate = (value) =>
    value == null ? null : Math.round(value * 100) / 100;

const readCookie = (req, name) => {
    const header = req.headers?.cookie;
    if (!header) return null;

    for (const part of String(header).split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;

        const key = part.slice(0, separator).trim();
        if (key !== name) continue;

        const value = part.slice(separator + 1).trim();
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    return null;
};

export function getRequestHost(req) {
    const raw = req.headers?.["x-forwarded-host"] || req.headers?.host || "";
    const first = String(raw).split(",")[0].trim();
    if (!first) return null;

    try {
        return new URL(`http://${first}`).hostname.toLowerCase();
    } catch {
        return first.split(":")[0].toLowerCase() || null;
    }
}

const getRequestIp = (req) => {
    const raw =
        req.ip ||
        req.headers?.["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "";
    return String(raw).split(",")[0].trim();
};

export function hashIp(ip) {
    if (!ip) return null;

    const secret =
        process.env.ANALYTICS_HASH_SECRET ||
        process.env.CLERK_SECRET_KEY ||
        "sggs-local-development";

    return crypto
        .createHmac("sha256", secret)
        .update(String(ip))
        .digest("hex")
        .slice(0, 32);
}

export function getReferrerHost(referrer) {
    if (!referrer) return null;
    try {
        return new URL(referrer).hostname.toLowerCase();
    } catch {
        return null;
    }
}

export function extractUtm(query = {}) {
    return {
        source: asString(query.utm_source, 120),
        medium: asString(query.utm_medium, 120),
        campaign: asString(query.utm_campaign, 120),
        term: asString(query.utm_term, 120),
        content: asString(query.utm_content, 120),
    };
}

export function isQrRequest(req) {
    const qr = String(req.query?.qr || "").toLowerCase();
    const src = String(req.query?.src || "").toLowerCase();
    const medium = String(req.query?.utm_medium || "").toLowerCase();

    return qr === "1" || qr === "true" || src === "qr" || medium === "qr";
}

export function classifyChannel({
    referrerHost,
    isQr = false,
    utm = {},
    requestHost,
} = {}) {
    if (isQr) return "qr";

    const medium = String(utm.medium || "").toLowerCase();
    if (medium === "email") return "email";
    if (medium === "qr") return "qr";
    if (["social", "social-media"].includes(medium)) return "social";
    if (["cpc", "ppc", "paid", "display", "ads"].includes(medium)) {
        return "paid";
    }

    const host = String(referrerHost || "").toLowerCase();
    if (!host) return "direct";

    if (
        host === String(requestHost || "").toLowerCase() ||
        host === PLATFORM_DOMAIN ||
        host.endsWith(`.${PLATFORM_DOMAIN}`)
    ) {
        return "internal";
    }

    if (isSearchHost(host)) return "search";
    if (isSocialHost(host)) return "social";

    return "referral";
}

export function isPrefetchRequest(req) {
    const values = [
        req.headers?.["sec-purpose"],
        req.headers?.purpose,
        req.headers?.["x-purpose"],
        req.headers?.["x-moz"],
    ].map((value) => String(value || "").toLowerCase());

    return values.some(
        (value) =>
            value.includes("prefetch") ||
            value.includes("prerender") ||
            value === "preview"
    );
}

const detectBotName = (userAgent) => {
    if (!userAgent) return null;

    for (const [pattern, name] of BOT_PATTERNS) {
        if (pattern.test(userAgent)) return name;
    }

    return null;
};

// Warm serverless instances see the same handful of user agents over and over.
// Cache the parsed result so a click only pays for the UA parser once per
// distinct agent, not once per click. The map is bounded to keep memory flat.
const UA_CACHE_LIMIT = 500;
const uaCache = new Map();

const cacheUserAgent = (userAgent, result) => {
    if (uaCache.size >= UA_CACHE_LIMIT) {
        uaCache.delete(uaCache.keys().next().value);
    }
    uaCache.set(userAgent, result);
    return result;
};

const parseUserAgent = async (userAgent) => {
    if (!userAgent) {
        return {
            browser: null,
            browserVersion: null,
            os: null,
            osVersion: null,
            deviceType: "unknown",
            isBot: false,
            botName: null,
        };
    }

    const cached = uaCache.get(userAgent);
    if (cached) return cached;

    try {
        const [uaModule, botModule] = await Promise.all([
            import("ua-parser-js"),
            import("isbot"),
        ]);

        const UAParser = uaModule.UAParser || uaModule.default;
        const parsed = new UAParser(userAgent).getResult();
        const botName = detectBotName(userAgent);
        const isBot =
            typeof botModule.isbot === "function"
                ? botModule.isbot(userAgent)
                : Boolean(botName);

        return cacheUserAgent(userAgent, {
            browser: asString(parsed.browser?.name, 80),
            browserVersion: asString(parsed.browser?.version, 40),
            os: asString(parsed.os?.name, 80),
            osVersion: asString(parsed.os?.version, 40),
            deviceType: isBot
                ? "bot"
                : asString(parsed.device?.type, 40) || "desktop",
            isBot,
            botName,
        });
    } catch (error) {
        console.warn(
            "[analytics] Could not parse user agent:",
            error?.message || error
        );

        const botName = detectBotName(userAgent);
        return cacheUserAgent(userAgent, {
            browser: null,
            browserVersion: null,
            os: null,
            osVersion: null,
            deviceType: botName ? "bot" : "unknown",
            isBot: Boolean(botName),
            botName,
        });
    }
};

export function getAnalyticsIds(req) {
    return {
        visitorId: asString(readCookie(req, VISITOR_COOKIE), 64),
        sessionId: asString(readCookie(req, SESSION_COOKIE), 64),
    };
}

export function ensureAnalyticsCookies(req, res) {
    const ids = getAnalyticsIds(req);
    const userAgent = String(req.headers?.["user-agent"] || "");
    const skip =
        String(req.headers?.["sec-gpc"] || "") === "1" ||
        String(req.headers?.dnt || "") === "1" ||
        isPrefetchRequest(req) ||
        /bot|crawler|spider|preview/i.test(userAgent);

    if (skip) {
        return { visitorId: null, sessionId: null };
    }

    const visitorId = ids.visitorId || crypto.randomUUID();
    const sessionId = ids.sessionId || crypto.randomUUID();
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    };

    if (!ids.visitorId) {
        res.cookie(VISITOR_COOKIE, visitorId, {
            ...cookieOptions,
            maxAge: VISITOR_MAX_AGE,
        });
    }

    // Sliding session: refreshed on every click.
    res.cookie(SESSION_COOKIE, sessionId, {
        ...cookieOptions,
        maxAge: SESSION_MAX_AGE,
    });

    return { visitorId, sessionId };
}

export function appendQuery(destination, query = {}) {
    const target = new URL(destination);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new Error("Unsupported destination protocol");
    }

    for (const [key, value] of Object.entries(query || {})) {
        if (INTERNAL_QUERY_PARAMS.has(key)) continue;

        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === "string") {
                    target.searchParams.append(key, item);
                }
            }
            continue;
        }

        if (typeof value === "string") {
            target.searchParams.set(key, value);
        }
    }

    return target.toString();
}

const buildVisit = ({
    req,
    entry,
    shortId,
    status,
    mode,
    lookupMs,
    visitorId,
    sessionId,
}) => {
    const requestHost = getRequestHost(req);
    const ip = getRequestIp(req);
    const referrer = asString(req.headers?.referer, 1024);
    const referrerHost = getReferrerHost(referrer);
    const utm = extractUtm(req.query);
    const qr = isQrRequest(req);
    const cookieIds = getAnalyticsIds(req);

    return {
        urlId: entry._id,
        ownerId: entry.createdBy,
        shortId,
        domain: requestHost || "unknown",
        destination: asString(entry.redirectURL, 2048),
        clickedAt: new Date(),

        ipHash: hashIp(ip),
        ipVersion: ip ? (ip.includes(":") ? 6 : 4) : null,
        continent: asString(req.headers?.["x-vercel-ip-continent"], 8),
        country: asString(req.headers?.["x-vercel-ip-country"], 8),
        region: decodeHeader(req.headers?.["x-vercel-ip-country-region"]),
        city: decodeHeader(req.headers?.["x-vercel-ip-city"]),
        timezone: asString(req.headers?.["x-vercel-ip-timezone"], 80),
        latitude: roundCoordinate(
            toNumber(req.headers?.["x-vercel-ip-latitude"])
        ),
        longitude: roundCoordinate(
            toNumber(req.headers?.["x-vercel-ip-longitude"])
        ),

        userAgent: asString(req.headers?.["user-agent"], 512),
        language: asString(
            String(req.headers?.["accept-language"] || "").split(",")[0],
            35
        ),

        referrer,
        referrerHost,
        channel: classifyChannel({
            referrerHost,
            isQr: qr,
            utm,
            requestHost,
        }),
        utm,
        isQr: qr,

        visitorId: visitorId ?? cookieIds.visitorId ?? null,
        sessionId: sessionId ?? cookieIds.sessionId ?? null,

        status,
        lookupMs,
        isPrefetch: isPrefetchRequest(req),
        cacheHit: false,
        requestId: asString(
            req.headers?.["x-vercel-id"] || req.headers?.["x-request-id"],
            120
        ),
        mode,
    };
};

export function recordVisit(options) {
    const visit = buildVisit(options);

    const task = (async () => {
        const client = await parseUserAgent(visit.userAgent);

        // Insert first, then bump the counter. If the insert fails we must not
        // report a click that has no Visit row.
        const created = await Visit.create({ ...visit, ...client });
        const result = await ShortURL.updateOne(
            { _id: visit.urlId },
            {
                $inc: { visitCount: 1 },
                $set: { lastVisitAt: visit.clickedAt },
            }
        );

        // The link may have been deleted between the lookup and this write.
        // Do not leave an orphan visit behind.
        if (result.matchedCount === 0) {
            await Visit.deleteOne({ _id: created._id });
        }
    })().catch((error) => {
        console.error(
            "[analytics] Could not record visit:",
            error?.message || error
        );
    });

    try {
        // Vercel sets this symbol for every invocation. Outside Vercel the
        // promise still runs while the Node process keeps the event loop alive.
        const context = globalThis[REQUEST_CONTEXT_SYMBOL]?.get?.();
        context?.waitUntil?.(task);
    } catch {
        // A missing or expired request context must never break the redirect.
    }

    return task;
}
