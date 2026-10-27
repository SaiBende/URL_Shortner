import { clerkClient } from "@clerk/express";
import { User } from "../models/user.model.js";
import { isSubscriptionActive, planForSlug } from "./plans.js";

// How long a synced Clerk subscription is trusted before we ask Clerk again.
// A short TTL keeps quota decisions responsive without an API call per request.
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const configuredTtl = Number(process.env.BILLING_SYNC_TTL_MS);
const SYNC_TTL_MS =
    Number.isFinite(configuredTtl) && configuredTtl >= 0
        ? configuredTtl
        : DEFAULT_TTL_MS;

const inFlight = new Map();
const warnedErrors = new Set();
const retryAfter = new Map();
const RETRY_BACKOFF_MS = 60 * 1000;
// If Billing is disabled/misconfigured for the whole application, stop asking
// Clerk on every request. A manual refresh still bypasses this guard.
let billingDisabledUntil = 0;

const toTime = (value) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
};

const errorStatus = (error) =>
    Number(error?.status ?? error?.statusCode ?? error?.response?.status);

const isNotFound = (error) => errorStatus(error) === 404;

const pickSubscriptionItem = (subscription) => {
    const items = subscription?.subscriptionItems || [];

    return (
        items.find((item) => item.status === "active") ||
        items.find((item) => item.status === "past_due") ||
        items.find((item) => item.status === "canceled") ||
        items[0] ||
        null
    );
};

const inactiveSnapshot = () => ({
    provider: "clerk",
    id: null,
    status: "inactive",
    planSlug: null,
    planName: null,
    planPeriod: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
});

// Convert Clerk's BillingSubscription resource into the shape stored in Mongo.
export const snapshotSubscription = (subscription) => {
    if (!subscription) return inactiveSnapshot();

    const item = pickSubscriptionItem(subscription);
    const rawSlug = item?.plan?.slug || null;
    const catalogPlan = planForSlug(rawSlug);
    const periodEnd = item?.periodEnd ? new Date(item.periodEnd) : null;

    return {
        provider: "clerk",
        id: subscription.id || null,
        status: subscription.status || "inactive",
        planSlug: catalogPlan?.slug || rawSlug,
        planName: item?.plan?.name || catalogPlan?.name || null,
        planPeriod:
            item?.planPeriod === "annual"
                ? "year"
                : item?.planPeriod === "month"
                  ? "month"
                  : null,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(
            item?.canceledAt && (!periodEnd || periodEnd.getTime() > Date.now())
        ),
        lastSyncedAt: new Date(),
    };
};

// Pull the current Billing subscription from Clerk and persist it locally.
// Failures are non-fatal: the last known entitlement stays in place.
export const syncUserBilling = async (user, { force = false } = {}) => {
    if (!user?.clerkId) return user;

    const lastSyncedAt = toTime(user.subscription?.lastSyncedAt);
    if (!force && lastSyncedAt && Date.now() - lastSyncedAt < SYNC_TTL_MS) {
        return user;
    }

    if (!force && Date.now() < billingDisabledUntil) {
        return user;
    }

    if (!force && (retryAfter.get(user.clerkId) || 0) > Date.now()) {
        return user;
    }

    const pending = inFlight.get(user.clerkId);
    if (pending) return pending;

    const task = (async () => {
        if (!clerkClient.billing?.getUserBillingSubscription) {
            return user;
        }

        let snapshot;

        try {
            const subscription =
                await clerkClient.billing.getUserBillingSubscription(
                    user.clerkId
                );
            snapshot = snapshotSubscription(subscription);
        } catch (error) {
            if (isNotFound(error)) {
                // No paid Clerk subscription - the account stays on Free.
                snapshot = inactiveSnapshot();
            } else {
                const status = errorStatus(error);
                const key = String(
                    status || error?.code || error?.message || "unknown"
                );

                if (status === 400 || status === 401 || status === 403) {
                    billingDisabledUntil = Date.now() + 10 * 60 * 1000;
                } else {
                    retryAfter.set(user.clerkId, Date.now() + RETRY_BACKOFF_MS);
                }

                if (!warnedErrors.has(key)) {
                    warnedErrors.add(key);
                    console.warn(
                        `[billing] Clerk subscription sync failed (${key}):`,
                        error?.message || error
                    );
                }

                return user;
            }
        }

        const planSlug = isSubscriptionActive(snapshot)
            ? planForSlug(snapshot.planSlug)?.slug || "free"
            : "free";

        // An active subscription whose slug is not in the local catalog would
        // otherwise look like a free account. Log it so the Clerk plan slug can
        // be corrected instead of silently under-granting quota.
        if (
            isSubscriptionActive(snapshot) &&
            snapshot.planSlug &&
            !planForSlug(snapshot.planSlug)
        ) {
            const key = `unknown-plan:${snapshot.planSlug}`;
            if (!warnedErrors.has(key)) {
                warnedErrors.add(key);
                console.warn(
                    `[billing] Unknown Clerk plan slug "${snapshot.planSlug}". ` +
                        "Add it to PLAN_CATALOG in src/utils/plans.js or fix the slug in Clerk."
                );
            }
        }

        await User.updateOne(
            { _id: user._id },
            { $set: { subscription: snapshot, plan: planSlug } }
        );

        // Keep the in-memory document in sync for this request.
        user.subscription = snapshot;
        user.plan = planSlug;
        retryAfter.delete(user.clerkId);

        return user;
    })().finally(() => {
        inFlight.delete(user.clerkId);
    });

    inFlight.set(user.clerkId, task);
    return task;
};
