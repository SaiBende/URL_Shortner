import { URL } from "../models/url.model.js";
import { User } from "../models/user.model.js";
import { resolvePlan } from "../utils/plans.js";
import { syncUserBilling } from "../utils/clerkBilling.js";
import { platformHostFor } from "../utils/handles.js";

const dashboard = async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        // Fetch the user from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // After a Clerk checkout the frontend asks for an immediate refresh
        // instead of waiting for the normal sync TTL.
        const refreshBilling = String(
            req.query?.refreshBilling ?? req.body?.refreshBilling ?? ""
        ).toLowerCase();
        if (refreshBilling === "1" || refreshBilling === "true") {
            try {
                await syncUserBilling(user, { force: true });
            } catch (error) {
                // Keep serving the cached entitlement rather than failing the
                // whole dashboard right after a successful checkout.
                console.warn(
                    "[billing] Dashboard refresh failed:",
                    error?.message || error
                );
            }
        }

        // Effective plan combines legacy one-time purchases and Clerk
        // subscriptions without mutating the stored legacy fields.
        const plan = resolvePlan(user);
        const publicPlan = {
            ...plan,
            limit: plan.unlimited ? null : plan.limit,
        };

        // Fetch the URLs created by this user
        const urls = await URL.find({ createdBy: userId });

        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                handle: user.handle || null,
                platformHost: user.handle ? platformHostFor(user.handle) : null,
                email: user.email,
                category: plan.category,
                // Only expose the legacy expiry while it is still the active
                // entitlement; the raw field is preserved in MongoDB.
                planExpiresAt: plan.source === "legacy" ? user.planExpiresAt : null,
                plan: publicPlan,
                urlLimit: plan.unlimited ? null : plan.limit,
                subscription: {
                    provider: user.subscription?.provider || "clerk",
                    status: user.subscription?.status || "inactive",
                    planSlug: user.subscription?.planSlug || null,
                    planPeriod: user.subscription?.planPeriod || null,
                    currentPeriodEnd:
                        user.subscription?.currentPeriodEnd || null,
                    cancelAtPeriodEnd: Boolean(
                        user.subscription?.cancelAtPeriodEnd
                    ),
                    lastSyncedAt: user.subscription?.lastSyncedAt || null,
                },
                billingProvider: "clerk",
                urlCount: user.urlCount,
                profilephoto: user.profilephoto,
            },
            urls,
        });
    } catch (error) {
        console.error("Error in dashboard controller:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { dashboard };
