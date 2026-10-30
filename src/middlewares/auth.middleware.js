import { clerkClient, getAuth } from "@clerk/express";
import { User } from "../models/user.model.js";
import { syncUserBilling } from "../utils/clerkBilling.js";
import { ensureUserHandle, generateUniqueHandle } from "../utils/handles.js";

const DEFAULT_PROFILE_PHOTO =
    "https://cdn.pixabay.com/photo/2013/07/13/12/33/man-159847_1280.png";

// Escape user-controlled text before using it inside a case-insensitive regex.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const primaryEmail = (clerkUser) => {
    const addresses = clerkUser.emailAddresses || [];
    const primary = addresses.find(
        (item) => item.id === clerkUser.primaryEmailAddressId
    );

    // Only use a verified address: linking a local account by an unverified
    // email would let someone claim another user's existing URLs/data.
    const verified = addresses.find(
        (item) => item.verification?.status === "verified"
    );
    const chosen =
        primary?.verification?.status === "verified" ? primary : verified;

    return normalizeEmail(chosen?.emailAddress);
};

const sanitizeUsername = (value) => {
    const cleaned = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "");
    return cleaned.slice(0, 30);
};

const findUserByEmail = (email) =>
    User.findOne({
        email: { $regex: new RegExp(`^${escapeRegex(email)}$`, "i") },
    });

const usernameExists = (username) =>
    User.exists({
        username: { $regex: new RegExp(`^${escapeRegex(username)}$`, "i") },
    });

const uniqueUsername = async (base) => {
    const fallback = `user-${Math.random().toString(36).slice(2, 8)}`;
    let candidate = sanitizeUsername(base) || fallback;

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const username =
            attempt === 0
                ? candidate
                : `${candidate.slice(0, 23)}-${Math.random().toString(36).slice(2, 8)}`;

        if (!(await usernameExists(username))) {
            return username;
        }
    }

    return `${fallback}-${Date.now().toString(36)}`;
};

// A local Mongo user keeps the application data (URLs, plan, profile) while
// Clerk owns credentials and sessions. Existing accounts are linked by email.
const linkExistingUser = async (user, clerkUser) => {
    if (user.clerkId && user.clerkId !== clerkUser.id) {
        const error = new Error(
            "This email address is already linked to a different sign-in account."
        );
        error.status = 409;
        throw error;
    }

    if (!user.clerkId) {
        user.clerkId = clerkUser.id;
        await user.save();
    }

    return user;
};

const createLocalUser = async (clerkUser) => {
    const email = primaryEmail(clerkUser);
    if (!email) {
        const error = new Error(
            "Your Clerk account needs a verified email address to use SGGS."
        );
        error.status = 400;
        throw error;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
        return linkExistingUser(existing, clerkUser);
    }

    const requestedUsername =
        (typeof clerkUser.unsafeMetadata?.username === "string" &&
            clerkUser.unsafeMetadata.username) ||
        clerkUser.username ||
        email.split("@")[0];

    const baseUsername = sanitizeUsername(requestedUsername) || "user";
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidateBase =
            attempt === 0 ? baseUsername : `${baseUsername.slice(0, 20)}-${attempt}`;
        const username = await uniqueUsername(candidateBase);
        const handle = await generateUniqueHandle(candidateBase);

        try {
            return await User.create({
                clerkId: clerkUser.id,
                username,
                handle,
                email,
                profilephoto: clerkUser.imageUrl || DEFAULT_PROFILE_PHOTO,
            });
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }

            lastError = error;

            // Another request may have created/linked the user first.
            const byClerkId = await User.findOne({ clerkId: clerkUser.id });
            if (byClerkId) {
                return byClerkId;
            }

            const byEmail = await findUserByEmail(email);
            if (byEmail) {
                return linkExistingUser(byEmail, clerkUser);
            }
            // Otherwise a username collided; loop and try a different one.
        }
    }

    throw lastError || new Error("Could not create a local user account.");
};

// Coalesce parallel requests for the same Clerk user during first login.
const localUserPromises = new Map();

const getOrCreateLocalUser = (clerkUserId) => {
    const pending = localUserPromises.get(clerkUserId);
    if (pending) {
        return pending;
    }

    const promise = (async () => {
        const user = await User.findOne({ clerkId: clerkUserId });
        if (user) {
            return ensureUserHandle(user);
        }

        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        return ensureUserHandle(await createLocalUser(clerkUser));
    })().finally(() => {
        localUserPromises.delete(clerkUserId);
    });

    localUserPromises.set(clerkUserId, promise);
    return promise;
};

const auth = async (req, res, next) => {
    // Allows the rest of the API (public profiles, redirects, docs) to keep
    // working locally before Clerk keys are added.
    if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
        return res.status(503).json({
            success: false,
            message: "Authentication is not configured on this server.",
        });
    }

    try {
        const { userId } = getAuth(req);

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: "You are not logged in" });
        }

        const user = await getOrCreateLocalUser(userId);

        // Keep the local entitlement snapshot fresh. The helper has its own
        // short TTL, so this is at most one Clerk Billing call per user per
        // few minutes per server instance. Billing is never allowed to block
        // authentication: a failed sync keeps the last known entitlement.
        try {
            await syncUserBilling(user);
        } catch (error) {
            console.warn(
                "[billing] Could not refresh subscription for",
                userId,
                "-",
                error?.message || error
            );
        }

        // Keep the shape used by all existing controllers.
        req.user = {
            user_id: user._id.toString(),
            email: user.email,
            username: user.username,
            handle: user.handle,
            clerkId: userId,
        };
        req.dbUser = user;

        return next();
    } catch (error) {
        console.error("Clerk authentication failed:", error);

        if (error.status === 400 || error.status === 409) {
            return res
                .status(error.status)
                .json({ success: false, message: error.message });
        }
        if (error.status === 404) {
            return res.status(401).json({
                success: false,
                message: "Your sign-in account no longer exists.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication failed. Please try again.",
        });
    }
};

export { auth };
