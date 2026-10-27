// Legacy Stripe purchase history. The collection name stays `orders`, so any
// existing data remains readable if this model is re-enabled.
import mongoose from "mongoose";

// One record per completed Stripe checkout - gives us purchase history,
// receipts and idempotency for webhook + session-status processing.
const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        planName: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            enum: ["basic", "standard", "premium"],
            required: true,
        },
        amount: {
            type: Number, // in INR
            required: true,
        },
        currency: {
            type: String,
            default: "inr",
        },
        stripeSessionId: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ["paid", "refunded"],
            default: "paid",
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export { Order };
