import { User } from "../models/user.model.js";
import { syncUserBilling } from "../utils/clerkBilling.js";
import { resolvePlan } from "../utils/plans.js";

const buildPayload = (user) => {
    const plan = resolvePlan(user);

    return {
        provider: "clerk",
        plan: {
            ...plan,
            limit: plan.unlimited ? null : plan.limit,
        },
        urlLimit: plan.unlimited ? null : plan.limit,
        subscription: {
            provider: user.subscription?.provider || "clerk",
            status: user.subscription?.status || "inactive",
            planSlug: user.subscription?.planSlug || null,
            planPeriod: user.subscription?.planPeriod || null,
            currentPeriodEnd: user.subscription?.currentPeriodEnd || null,
            cancelAtPeriodEnd: Boolean(user.subscription?.cancelAtPeriodEnd),
            lastSyncedAt: user.subscription?.lastSyncedAt || null,
        },
    };
};

const getBilling = async (req, res) => {
    try {
        const user = await User.findById(req.user.user_id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            success: true,
            ...buildPayload(user),
        });
    } catch (error) {
        console.error("Error reading billing status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// Called by the frontend after the Clerk checkout drawer closes so the new
// entitlement is available immediately.
const refreshBilling = async (req, res) => {
    try {
        const user = await User.findById(req.user.user_id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await syncUserBilling(user, { force: true });

        // Read back in case the sync updated a different document snapshot.
        const fresh = await User.findById(user._id);

        return res.status(200).json({
            success: true,
            ...buildPayload(fresh || user),
        });
    } catch (error) {
        console.error("Error refreshing billing status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { getBilling, refreshBilling };
