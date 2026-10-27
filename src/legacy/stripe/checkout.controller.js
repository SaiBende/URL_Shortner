// Legacy Stripe checkout. Kept for reference and for a possible future
// re-enable, but it is no longer mounted or imported by the application.
import stripePackage from "stripe";
import { User } from "../../models/user.model.js";
import { Order } from "./order.model.js";
import { PLAN_PRICES, PLAN_CATEGORY, PLAN_DURATION_DAYS } from "../../utils/plans.js";

const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);

const getFrontendUrl = () =>
    (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");

// Upgrade the user's category — only after a confirmed payment.
// Idempotent: a session is processed at most once (guarded by the Order record),
// so webhook + session-status racing each other can't double-extend the plan.
const applyPlanForSession = async (session) => {
    if (session.payment_status !== "paid") {
        return null;
    }

    const category = PLAN_CATEGORY[session.metadata?.planName];
    if (!category) {
        return null;
    }

    let user = null;
    if (session.metadata?.user_id) {
        user = await User.findById(session.metadata.user_id);
    }
    if (!user && session.customer_details?.email) {
        user = await User.findOne({ email: session.customer_details.email });
    }
    if (!user) {
        return null;
    }

    // Already processed (webhook or a previous session-status call)?
    const existingOrder = await Order.findOne({ stripeSessionId: session.id });
    if (existingOrder) {
        return null;
    }

    const expiresAt = new Date(Date.now() + PLAN_DURATION_DAYS[category] * 24 * 60 * 60 * 1000);

    await User.updateOne({ _id: user._id }, { category, planExpiresAt: expiresAt });

    try {
        await Order.create({
            user: user._id,
            planName: session.metadata.planName,
            category,
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency || "inr",
            stripeSessionId: session.id,
        });
    } catch (error) {
        // Unique index race: another request recorded this session first — that's fine
        if (error.code !== 11000) {
            throw error;
        }
    }

    return { user, category, expiresAt };
};

const createCheckoutSession = async (req, res) => {
    try {
        const { planName } = req.body;
        const price = PLAN_PRICES[planName];

        if (!price) {
            return res.status(400).json({ error: "Invalid plan. Choose Basic, Standard or Premium." });
        }

        // req.user is set by the auth middleware
        const user = await User.findById(req.user.user_id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const session = await stripe.checkout.sessions.create({
            ui_mode: "embedded",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: planName,
                        },
                        unit_amount: price * 100,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            customer_email: user.email,
            metadata: {
                user_id: user._id.toString(),
                planName,
            },
            return_url: `${getFrontendUrl()}/payment/session-status/return?session_id={CHECKOUT_SESSION_ID}`,
        });

        return res.json({ id: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return res.status(500).json({ error: error.message });
    }
};

const sessionStatus = async (req, res) => {
    try {
        const { session_id } = req.query;

        if (!session_id) {
            return res.status(400).json({ error: "session_id is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);

        // The session must belong to the caller (metadata, with email fallback)
        const ownerId = session.metadata?.user_id;
        const ownerEmail = session.customer_details?.email;
        if (ownerId && ownerId !== req.user.user_id) {
            return res.status(403).json({ error: "This payment session belongs to another account" });
        }
        if (!ownerId && ownerEmail && ownerEmail !== req.user.email) {
            return res.status(403).json({ error: "This payment session belongs to another account" });
        }

        const result = await applyPlanForSession(session);

        return res.json({
            status: session.status,
            payment_status: session.payment_status,
            customer_email: ownerEmail || null,
            category: result ? result.category : null,
        });
    } catch (error) {
        console.error("Error fetching session status:", error);
        return res.status(500).json({ error: error.message });
    }
};

// Purchase history for the logged-in user
const listOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.user_id }).sort({ createdAt: -1 });
        return res.json({ success: true, orders });
    } catch (error) {
        console.error("Error listing orders:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// Stripe webhook — the reliable way to apply plan upgrades (works even if the
// user closes the browser before returning to the site).
// Requires STRIPE_WEBHOOK_SECRET in the environment.
const webhookHandler = async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
        return res.status(503).json({ error: "Stripe webhook is not configured" });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
    } catch (error) {
        console.error("Webhook signature verification failed:", error.message);
        return res.status(400).json({ error: `Webhook error: ${error.message}` });
    }

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            await applyPlanForSession(session);
        }
        return res.json({ received: true });
    } catch (error) {
        console.error("Error processing webhook event:", error);
        return res.status(500).json({ error: "Webhook processing failed" });
    }
};

export { createCheckoutSession, sessionStatus, listOrders, webhookHandler, applyPlanForSession };
