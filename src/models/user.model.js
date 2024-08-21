import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            enum: ["basic", "standard", "premium"],
            default: "basic",
        },
        urlCount: {
            type: Number,
            default: 0, // Initialize count at 0
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };
