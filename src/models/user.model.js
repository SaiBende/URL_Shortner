import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            default: "clerk",
        },
        id: {
            type: String,
            default: null, // Clerk subscription id
        },
        status: {
            type: String,
            default: "inactive", // active | past_due | canceled | ended | incomplete
        },
        planSlug: {
            type: String,
            default: null, // Clerk plan slug (free | basic | standard | premium)
        },
        planName: {
            type: String,
            default: null,
        },
        planPeriod: {
            type: String,
            default: null, // month | year
        },
        currentPeriodEnd: {
            type: Date,
            default: null,
        },
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false,
        },
        lastSyncedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            unique: true,
            sparse: true, // existing users created before Clerk have no clerkId
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        // DNS-safe public handle for handle.sggs.saibende.in. `username` is
        // kept as-is because existing /u/:username profile URLs depend on it.
        handle: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        profilephoto: {
            type: String,
            default:
                "https://cdn.pixabay.com/photo/2013/07/13/12/33/man-159847_1280.png",
        },
        // Legacy one-time plan fields. Kept so existing purchases continue to
        // work until their paid period ends.
        category: {
            type: String,
            enum: ["basic", "standard", "premium"],
            default: "basic",
        },
        planExpiresAt: {
            type: Date,
            default: null, // when the current paid plan lapses (null = basic)
        },
        // Clerk Billing state. `plan` mirrors the active Clerk plan slug so it
        // is cheap to query; subscription holds the full snapshot.
        plan: {
            type: String,
            default: "free",
        },
        subscription: {
            type: subscriptionSchema,
            default: () => ({}),
        },
        urlCount: {
            type: Number,
            default: 0, // Initialize count at 0
        },
        socialMediaLinks: {
            type: Map,
            of: String, // Use a map to store key-value pairs of platform and link
            default: {},
            // Add more social media links as needed
        },
        description: {
            type: String,
            default: "Welcome to my page!",
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };
