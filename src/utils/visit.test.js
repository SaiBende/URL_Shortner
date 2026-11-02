import test from "node:test";
import assert from "node:assert/strict";
import {
    appendQuery,
    classifyChannel,
    ensureAnalyticsCookies,
    extractUtm,
    getAnalyticsIds,
    getReferrerHost,
    getRequestHost,
    hashIp,
    isPrefetchRequest,
    isQrRequest,
} from "./visit.js";

const request = (headers = {}) => ({ headers });

test("getRequestHost prefers x-forwarded-host and strips ports", () => {
    assert.equal(
        getRequestHost(
            request({
                "x-forwarded-host": "go.saibende.in",
                host: "10s.vercel.app",
            })
        ),
        "go.saibende.in"
    );
    assert.equal(
        getRequestHost(request({ host: "localhost:8000" })),
        "localhost"
    );
});

test("appendQuery preserves destination params and drops internal flags", () => {
    const result = appendQuery("https://example.com/a?x=1", {
        utm_source: "newsletter",
        qr: "1",
        src: "qr",
    });
    const url = new URL(result);

    assert.equal(url.searchParams.get("x"), "1");
    assert.equal(url.searchParams.get("utm_source"), "newsletter");
    assert.equal(url.searchParams.has("qr"), false);
    assert.equal(url.searchParams.has("src"), false);
});

test("appendQuery handles repeated params and rejects non-http targets", () => {
    const result = appendQuery("https://example.com", { tag: ["a", "b"] });
    assert.deepEqual(new URL(result).searchParams.getAll("tag"), ["a", "b"]);

    assert.throws(() =>
        appendQuery("javascript:alert(1)", {})
    );
});

test("extractUtm only keeps known params", () => {
    const utm = extractUtm({
        utm_source: "google",
        utm_campaign: "launch",
        other: "ignored",
    });

    assert.deepEqual(utm, {
        source: "google",
        medium: null,
        campaign: "launch",
        term: null,
        content: null,
    });
});

test("classifyChannel covers the common acquisition buckets", () => {
    assert.equal(classifyChannel({}), "direct");
    assert.equal(
        classifyChannel({ referrerHost: "www.google.com" }),
        "search"
    );
    assert.equal(
        classifyChannel({ referrerHost: "www.google.co.in" }),
        "search"
    );
    assert.equal(
        classifyChannel({ referrerHost: "instagram.com" }),
        "social"
    );
    assert.equal(
        classifyChannel({ referrerHost: "microsoft.com" }),
        "referral"
    );
    assert.equal(
        classifyChannel({ referrerHost: "sggs.saibende.in" }),
        "internal"
    );
    assert.equal(
        classifyChannel({
            referrerHost: "sggs.saibende.in",
            requestHost: "go.saibende.in",
        }),
        "internal"
    );
    assert.equal(classifyChannel({ isQr: true }), "qr");
    assert.equal(
        classifyChannel({
            utm: { medium: "email" },
            referrerHost: "mail.example.com",
        }),
        "email"
    );
    assert.equal(
        classifyChannel({
            utm: { medium: "cpc" },
            referrerHost: "google.com",
        }),
        "paid"
    );
});

test("isQrRequest accepts qr, src, and utm_medium markers", () => {
    assert.equal(isQrRequest({ query: { qr: "1" } }), true);
    assert.equal(isQrRequest({ query: { src: "qr" } }), true);
    assert.equal(isQrRequest({ query: { utm_medium: "QR" } }), true);
    assert.equal(isQrRequest({ query: {} }), false);
});

test("isPrefetchRequest recognises browser prefetch headers", () => {
    assert.equal(
        isPrefetchRequest(request({ "sec-purpose": "prefetch;prerender" })),
        true
    );
    assert.equal(
        isPrefetchRequest(request({ purpose: "prefetch" })),
        true
    );
    assert.equal(isPrefetchRequest(request({})), false);
});

test("hashIp is stable and never returns the raw address", () => {
    const first = hashIp("203.0.113.10");
    const second = hashIp("203.0.113.10");

    assert.equal(first, second);
    assert.notEqual(first, "203.0.113.10");
    assert.equal(first.length, 32);
});

test("getReferrerHost handles invalid input", () => {
    assert.equal(getReferrerHost("https://example.com/a"), "example.com");
    assert.equal(getReferrerHost("not a url"), null);
});

test("getAnalyticsIds reads first-party cookies", () => {
    const ids = getAnalyticsIds(
        request({ cookie: "sggs_vid=visitor-1; sggs_sid=session-1" })
    );

    assert.deepEqual(ids, {
        visitorId: "visitor-1",
        sessionId: "session-1",
    });
});

test("ensureAnalyticsCookies sets cookies but respects GPC", () => {
    const cookies = [];
    const res = {
        cookie(name, value) {
            cookies.push({ name, value });
        },
    };

    const ids = ensureAnalyticsCookies(request({}), res);
    assert.ok(ids.visitorId);
    assert.ok(ids.sessionId);
    assert.deepEqual(
        cookies.map((cookie) => cookie.name),
        ["sggs_vid", "sggs_sid"]
    );

    const skipped = ensureAnalyticsCookies(
        request({ "sec-gpc": "1" }),
        res
    );
    assert.deepEqual(skipped, { visitorId: null, sessionId: null });

    const dnt = ensureAnalyticsCookies(request({ dnt: "1" }), res);
    assert.deepEqual(dnt, { visitorId: null, sessionId: null });
});
