import "../config/env.js";
import mongoose from "mongoose";
import ConnectMongoDB from "../db/ConnectMongoDB.js";
import { User } from "../models/user.model.js";
import { ensureUserHandle } from "../utils/handles.js";

// Backfills DNS-safe platform handles for accounts created before Phase 1.
// Safe to run repeatedly; users that already have a valid handle are skipped.
const run = async () => {
    await ConnectMongoDB();

    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB connection failed. Check MONGODB_URL.");
    }

    const users = await User.find({
        $or: [
            { handle: { $exists: false } },
            { handle: null },
            { handle: "" },
        ],
    });

    console.log(`Found ${users.length} account(s) without a handle.`);

    let updated = 0;
    for (const user of users) {
        await ensureUserHandle(user);
        updated += 1;
        console.log(`  ${user.username} -> ${user.handle}`);
    }

    console.log(`Backfilled ${updated} handle(s).`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Handle backfill failed:", error?.message || error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
});
