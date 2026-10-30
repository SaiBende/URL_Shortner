import { User } from "../models/user.model.js";

// Phase 1 only serves platform subdomains, e.g. handle.sggs.saibende.in.
// Customer-owned domains will reuse the same host parsing later.
const DEFAULT_PLATFORM_DOMAIN = "sggs.saibende.in";

// Names that must never become a platform subdomain. Keep this list in sync
// with the frontend's tenant-host detection and the short-link reserved paths.
export const RESERVED_HANDLES = new Set([
    "about",
    "abuse",
    "acme-challenge",
    "admin",
    "api",
    "app",
    "assets",
    "auth",
    "autoconfig",
    "autodiscover",
    "beta",
    "billing",
    "blog",
    "cdn",
    "clerk",
    "dashboard",
    "demo",
    "dev",
    "dns",
    "docs",
    "email",
    "forgot-password",
    "ftp",
    "help",
    "images",
    "imap",
    "img",
    "internal",
    "legal",
    "linktree",
    "localhost",
    "login",
    "mail",
    "media",
    "ns1",
    "ns2",
    "ns3",
    "payment",
    "pop",
    "pricing",
    "privacy",
    "qrgenerate",
    "register",
    "robots",
    "root",
    "saibende",
    "security",
    "services",
    "sggs",
    "shortenlink",
    "signup",
    "sitemap",
    "smtp",
    "staging",
    "static",
    "status",
    "support",
    "system",
    "terms",
    "test",
    "u",
    "vercel",
    "video",
    "webmail",
    "well-known",
    "www",
]);

export const getPlatformDomain = () =>
    String(process.env.PLATFORM_DOMAIN || DEFAULT_PLATFORM_DOMAIN)
        .trim()
        .toLowerCase()
        .replace(/^\.+|\.+$/g, "");

// Accepts a Host header value, a hostname, or a URL host. Returns a bare
// lowercase host or an empty string when the value cannot be a hostname.
export const normalizeHost = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";

    const withoutPort = raw.replace(/:\d+$/, "").replace(/\.$/, "");
    if (!withoutPort || withoutPort.length > 253) return "";
    if (!/^[a-z0-9.-]+$/.test(withoutPort)) return "";
    if (withoutPort.includes("..")) return "";

    return withoutPort;
};

export const sanitizeHandle = (value) => {
    const cleaned = String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30)
        .replace(/-+$/g, "");

    return cleaned;
};

export const isValidHandle = (value) => {
    const handle = String(value || "");
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(handle)) return false;
    if (/^\d+$/.test(handle)) return false;
    return !RESERVED_HANDLES.has(handle);
};

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

export const generateUniqueHandle = async (base) => {
    const clean = sanitizeHandle(base) || `user-${randomSuffix()}`;

    if (isValidHandle(clean) && !(await User.exists({ handle: clean }))) {
        return clean;
    }

    for (let index = 2; index <= 20; index += 1) {
        const candidate = `${clean.slice(0, 27)}-${index}`;
        if (isValidHandle(candidate) && !(await User.exists({ handle: candidate }))) {
            return candidate;
        }
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = `${clean.slice(0, 22)}-${randomSuffix()}`;
        if (isValidHandle(candidate) && !(await User.exists({ handle: candidate }))) {
            return candidate;
        }
    }

    throw new Error("Could not generate a unique handle.");
};

// Existing accounts created before Phase 1 have no handle. This is called on
// the first authenticated request, and by the backfill script for everyone.
export const ensureUserHandle = async (user) => {
    if (!user) return user;
    if (user.handle && isValidHandle(user.handle)) return user;

    const base =
        user.username || String(user.email || "").split("@")[0] || "user";

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = await generateUniqueHandle(
            attempt === 0 ? base : `${base}-${attempt + 1}`
        );

        try {
            user.handle = candidate;
            await user.save();
            return user;
        } catch (error) {
            if (error?.code !== 11000) throw error;
        }
    }

    throw new Error("Could not assign a platform handle.");
};

// Returns the handle for a platform host, or null for the main app and any
// host that is not a single, valid platform label.
export const extractHandleFromHost = (value) => {
    const host = normalizeHost(value);
    if (!host) return null;

    const domains = [getPlatformDomain()];
    if (process.env.NODE_ENV !== "production") domains.push("localhost");

    for (const domain of domains) {
        if (!domain || host === domain) continue;
        if (!host.endsWith(`.${domain}`)) continue;

        const label = host.slice(0, -(domain.length + 1));
        if (!label || label.includes(".")) return null;

        return isValidHandle(label) ? label : null;
    }

    return null;
};

export const platformHostFor = (handle) => `${handle}.${getPlatformDomain()}`;
