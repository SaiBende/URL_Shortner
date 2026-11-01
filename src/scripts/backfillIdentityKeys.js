import "../config/env.js";
import mongoose from "mongoose";
import ConnectMongoDB from "../db/ConnectMongoDB.js";
import { User } from "../models/user.model.js";
import { sanitizeHandle } from "../utils/handles.js";

// Populates `identityKey` for accounts created before usernames and subdomains
// shared one reservation pool. Safe to re-run: values are only written when
// they are missing or out of date.
const reserve = (owners, key, user) => {
    if (!key) {
        throw new Error(
            `Could not derive a name key for "${user.username}" (${user._id}).`
        );
    }

    const existing = owners.get(key);
    if (existing && String(existing._id) !== String(user._id)) {
        throw new Error(
            `Name collision for "${key}": used by "${existing.username}" and "${user.username}". Resolve it before running this backfill.`
        );
    }

    owners.set(key, user);
};

const run = async () => {
    await ConnectMongoDB();

    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB connection failed. Check MONGODB_URL.");
    }

    const users = await User.find({}).sort({ createdAt: 1 });
    const owners = new Map();

    for (const user of users) {
        const key = sanitizeHandle(user.username) || sanitizeHandle(user.handle);
        reserve(owners, key, user);

        // The handle is a separate unique index, but it belongs to the same
        // shared namespace as identity keys.
        if (user.handle) reserve(owners, user.handle, user);
    }

    let updated = 0;
    for (const user of users) {
        const key = sanitizeHandle(user.username) || sanitizeHandle(user.handle);
        if (user.identityKey !== key) {
            user.identityKey = key;
            await user.save();
            updated += 1;
        }
    }

    // Ensures the unique sparse index exists on deployments that had no
    // identityKey values when the model was first deployed.
    await User.createIndexes();

    const missing = await User.countDocuments({
        $or: [
            { identityKey: { $exists: false } },
            { identityKey: null },
            { identityKey: "" },
        ],
    });

    const duplicateKeys = await User.aggregate([
        { $match: { identityKey: { $type: "string" } } },
        { $group: { _id: "$identityKey", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
    ]);

    console.log(`Accounts checked: ${users.length}`);
    console.log(`identityKey values updated: ${updated}`);
    console.log(`Missing identityKey values: ${missing}`);
    console.log(`Duplicate identityKey values: ${duplicateKeys.length}`);

    if (missing || duplicateKeys.length) {
        throw new Error("Identity backfill verification failed.");
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Identity backfill failed:", error?.message || error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
});
