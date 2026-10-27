import mongoose from "mongoose";

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
        category: {
            type: String,
            enum: ["basic", "standard", "premium"],
            default: "basic",
        },
        planExpiresAt: {
            type: Date,
            default: null, // when the current paid plan lapses (null = basic)
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
