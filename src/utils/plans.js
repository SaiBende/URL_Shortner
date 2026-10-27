// Central plan configuration - the single source of truth for quotas and for
// mapping Clerk Billing plan slugs onto local entitlements.
//
// Clerk plan slugs must match the keys below. If a slug in the Clerk Dashboard
// is different, add an alias here instead of hard-coding it elsewhere.

export const PLAN_CATALOG = {
    free: { slug: "free", name: "Free", category: "basic", limit: 10 },
    basic: { slug: "basic", name: "Basic", category: "basic", limit: 10 },
    standard: {
        slug: "standard",
        name: "Standard",
        category: "standard",
        limit: 30,
    },
    premium: {
        slug: "premium",
        name: "Premium",
        category: "premium",
        limit: Infinity,
    },
};

export const URL_LIMITS = {
    basic: 10,
    standard: 30,
    premium: Infinity, // No limit for premium users
};

const toTime = (value) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
};

export const normalizePlanSlug = (value) =>
    String(value || "")
        .trim()
        .toLowerCase();

export const planForSlug = (slug) => {
    const normalized = normalizePlanSlug(slug);
    if (!normalized) return null;
    if (PLAN_CATALOG[normalized]) return PLAN_CATALOG[normalized];

    // Accept common suffixed variants such as `standard-monthly`.
    const base = normalized.replace(
        /[-_](month|monthly|year|yearly|annual|annually)$/i,
        ""
    );
    return PLAN_CATALOG[base] || null;
};

// Clerk statuses: active | past_due | canceled | ended | abandoned | incomplete
// `canceled` still gets access until the paid period actually ends.
export const isSubscriptionActive = (subscription, now = Date.now()) => {
    if (!subscription) return false;

    if (
        subscription.status === "active" ||
        subscription.status === "past_due"
    ) {
        return true;
    }

    if (subscription.status === "canceled") {
        return toTime(subscription.currentPeriodEnd) > now;
    }

    return false;
};

// Existing one-time Stripe purchases keep working until their paid period ends.
// New Clerk subscriptions are layered on top without touching `category` or
// `planExpiresAt`, so the two models never overwrite each other.
const hasLegacyPlan = (user) => {
    if (!user || user.category === "basic") return false;
    if (!user.planExpiresAt) return true;
    return toTime(user.planExpiresAt) > Date.now();
};

// Returns the paid Clerk plan, ignoring the default Free plan so it never
// masks a still-active legacy purchase.
const paidClerkPlan = (user) => {
    if (!user || !isSubscriptionActive(user.subscription)) return null;
    const plan = planForSlug(user.subscription.planSlug);
    return plan && plan.slug !== "free" ? plan : null;
};

// Effective category considering both legacy expiry and Clerk subscriptions.
export const resolveCategory = (user) => {
    if (!user) return "basic";

    const clerkPlan = paidClerkPlan(user);
    if (clerkPlan) return clerkPlan.category;

    if (hasLegacyPlan(user)) {
        return user.category;
    }

    return "basic";
};

// Full plan snapshot used by the dashboard/API responses.
export const resolvePlan = (user) => {
    const clerkPlan = user ? paidClerkPlan(user) : null;

    if (clerkPlan) {
        return {
            slug: clerkPlan.slug,
            name: user.subscription.planName || clerkPlan.name,
            category: clerkPlan.category,
            limit: clerkPlan.limit,
            unlimited: clerkPlan.limit === Infinity,
            period: user.subscription.planPeriod || null,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd || null,
            cancelAtPeriodEnd: Boolean(user.subscription.cancelAtPeriodEnd),
            source: "clerk",
        };
    }

    if (user && hasLegacyPlan(user)) {
        const category = user.category;
        const limit = URL_LIMITS[category] ?? URL_LIMITS.basic;
        const catalog =
            Object.values(PLAN_CATALOG).find((plan) => plan.slug === category) ||
            PLAN_CATALOG.basic;

        return {
            slug: category,
            name: catalog.name,
            category,
            limit,
            unlimited: limit === Infinity,
            period: null,
            status: "legacy",
            currentPeriodEnd: user.planExpiresAt || null,
            cancelAtPeriodEnd: false,
            source: "legacy",
        };
    }

    return {
        slug: PLAN_CATALOG.free.slug,
        name: PLAN_CATALOG.free.name,
        category: PLAN_CATALOG.free.category,
        limit: PLAN_CATALOG.free.limit,
        unlimited: false,
        period: null,
        status: "inactive",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        source: "free",
    };
};

// ---------------------------------------------------------------------------
// Legacy Stripe configuration. Only used by `src/legacy/stripe/*`.
// ---------------------------------------------------------------------------

export const PLAN_PRICES = {
    Basic: 29,
    Standard: 99,
    Premium: 499,
}; // INR

export const PLAN_CATEGORY = {
    Basic: "basic",
    Standard: "standard",
    Premium: "premium",
};

// How long a one-time payment keeps the plan active (in days).
export const PLAN_DURATION_DAYS = {
    basic: 180,
    standard: 730,
    premium: 1095,
};
