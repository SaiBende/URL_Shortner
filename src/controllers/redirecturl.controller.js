import { URL as ShortURL } from "../models/url.model.js";
import {
    appendQuery,
    ensureAnalyticsCookies,
    getAnalyticsIds,
    recordVisit,
} from "../utils/visit.js";

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Link not found - SGGS</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f7f7fb; color: #0b0b10;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
    main { width: min(92vw, 420px); padding: 40px 32px; text-align: center;
      background: #fff; border: 1px solid rgba(11,11,16,.08);
      border-radius: 24px; box-shadow: 0 24px 60px rgba(11,11,16,.08); }
    .dot { width: 44px; height: 44px; margin: 0 auto 18px; border-radius: 14px;
      display: grid; place-items: center; background: #f1efff; color: #6d5ef6;
      font-size: 20px; font-weight: 700; }
    h1 { margin: 0; font-size: 22px; letter-spacing: -0.03em; }
    p { margin: 10px 0 0; color: #6b6b76; font-size: 13px; line-height: 1.6; }
    a { display: inline-block; margin-top: 22px; padding: 11px 18px;
      border-radius: 12px; background: #0b0b10; color: #fff;
      text-decoration: none; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <div class="dot">?</div>
    <h1>This link has gone missing</h1>
    <p>The short link does not exist, was deleted, or its address changed.</p>
    <a href="https://sggs.saibende.in">Back to SGGS</a>
  </main>
</body>
</html>`;

const SERVER_ERROR_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Link unavailable - SGGS</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f7f7fb; color: #0b0b10;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
    main { width: min(92vw, 420px); padding: 40px 32px; text-align: center;
      background: #fff; border: 1px solid rgba(11,11,16,.08);
      border-radius: 24px; box-shadow: 0 24px 60px rgba(11,11,16,.08); }
    h1 { margin: 0; font-size: 22px; letter-spacing: -0.03em; }
    p { margin: 10px 0 0; color: #6b6b76; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>This link is unavailable</h1>
    <p>The destination is not configured correctly. Please try again later.</p>
  </main>
</body>
</html>`;

const findEntry = (shortId) =>
    ShortURL.findOne({ shortId })
        .select({ redirectURL: 1, createdBy: 1 })
        .maxTimeMS(2000)
        .lean();

const isHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const handleRedirect = async (req, res) => {
    const shortId = req.params.shortId;
    const startedAt = Date.now();

    try {
        const entry = await findEntry(shortId);
        if (!entry) {
            return res.status(404).send("URL not found");
        }

        res.set({
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
        });

        // This route stays JSON-only for the current SPA. It reads a cookie if
        // one already exists but never sets one on a cross-origin fetch.
        const { visitorId, sessionId } = getAnalyticsIds(req);

        recordVisit({
            req,
            entry,
            shortId,
            status: 200,
            mode: "json",
            lookupMs: Date.now() - startedAt,
            visitorId,
            sessionId,
        });

        return res.status(200).json({ redirectURL: entry.redirectURL });
    } catch (error) {
        console.error("Error resolving short URL:", error);
        return res.status(500).send("Server error");
    }
};

const handleRedirect302 = async (req, res) => {
    const shortId = req.params.shortId;
    const startedAt = Date.now();

    try {
        const entry = await findEntry(shortId);
        if (!entry) {
            res.set({
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex",
            });
            return res.status(404).type("html").send(NOT_FOUND_HTML);
        }

        if (!isHttpUrl(entry.redirectURL)) {
            console.error(
                "[redirect] Refusing non-HTTP destination for",
                shortId
            );
            res.set({
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex",
            });
            return res.status(500).type("html").send(SERVER_ERROR_HTML);
        }

        // Cookies are set before the response is sent. They identify repeat
        // visitors on this short domain without storing a raw IP.
        const { visitorId, sessionId } = ensureAnalyticsCookies(req, res);

        recordVisit({
            req,
            entry,
            shortId,
            status: 302,
            mode: "redirect",
            lookupMs: Date.now() - startedAt,
            visitorId,
            sessionId,
        });

        const target = appendQuery(entry.redirectURL, req.query);

        res.set({
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
        });

        return res.redirect(302, target);
    } catch (error) {
        console.error("Error redirecting short URL:", error);
        if (res.headersSent) return res.end();
        res.set({
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
        });
        return res.status(500).type("html").send(SERVER_ERROR_HTML);
    }
};

export { handleRedirect, handleRedirect302 };
