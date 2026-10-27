// Central plan configuration — single source of truth for prices, quotas and durations.

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

// How long a one-time payment keeps the plan active (in days)
// (aligned with the support/update windows shown on the pricing page — edit freely)
export const PLAN_DURATION_DAYS = {
    basic: 180,
    standard: 730,
    premium: 1095,
};

export const URL_LIMITS = {
    basic: 10,
    standard: 30,
    premium: Infinity, // No limit for premium users
};

// Effective category considering plan expiry (lazy downgrade to basic)
export const resolveCategory = (user) => {
    if (user.category === "basic") {
        return "basic";
    }
    if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) {
        return "basic";
    }
    return user.category;
};
