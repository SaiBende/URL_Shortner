import { User } from "../models/user.model.js";
import {
    RESERVED_HANDLES,
    isValidHandle,
    sanitizeHandle,
} from "./handles.js";

const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

// Display usernames keep their spaces and capitalisation, while the canonical
// key is DNS-safe. `Sai Bende` and `sai-bende` therefore reserve the same name.
export const normalizeUsername = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

export const usernameKey = (value) => sanitizeHandle(normalizeUsername(value));

const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Usernames and handles share one reservation pool. A key is unavailable if
// another account uses it as either its identity key or its subdomain.
const takenByOtherUser = async (key, userId) => {
    if (!key) return false;

    return Boolean(
        await User.exists({
            _id: { $ne: userId },
            $or: [
                { identityKey: key },
                { handle: key },
                {
                    username: {
                        $regex: new RegExp(`^${escapeRegex(key)}$`, "i"),
                    },
                },
            ],
        })
    );
};

export const suggestAvailableKey = async (base, userId) => {
    const clean = sanitizeHandle(base);
    if (!clean) return null;

    for (let index = 2; index <= 20; index += 1) {
        const candidate = `${clean.slice(0, 27)}-${index}`;
        if (
            !RESERVED_HANDLES.has(candidate) &&
            !(await takenByOtherUser(candidate, userId))
        ) {
            return candidate;
        }
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = `${clean.slice(0, 22)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        if (
            !RESERVED_HANDLES.has(candidate) &&
            !(await takenByOtherUser(candidate, userId))
        ) {
            return candidate;
        }
    }

    return null;
};

export const validateUsername = (value, { allowReserved = false } = {}) => {
    const username = normalizeUsername(value);

    if (!username) return "Username cannot be empty.";
    if (username.length < MIN_LENGTH) {
        return `Username must be at least ${MIN_LENGTH} characters.`;
    }
    if (username.length > MAX_LENGTH) {
        return `Username must be ${MAX_LENGTH} characters or fewer.`;
    }
    if (!/^[A-Za-z0-9 ._-]+$/.test(username)) {
        return "Use only letters, numbers, spaces, dots, underscores or hyphens.";
    }
    if (/^[ ._-]|[ ._-]$/.test(username)) {
        return "Username cannot start or end with a space, dot, underscore or hyphen.";
    }

    const key = usernameKey(username);
    if (!key) return "Username must include at least one letter or number.";
    if (key.length < MIN_LENGTH) {
        return `Username must be at least ${MIN_LENGTH} characters.`;
    }
    if (/^\d+$/.test(key)) return "Username cannot be only numbers.";
    if (!allowReserved && RESERVED_HANDLES.has(key)) {
        return "That username is reserved. Please choose another.";
    }

    return null;
};

export const validateHandle = (value, { allowReserved = false } = {}) => {
    const handle = sanitizeHandle(value);

    if (!handle) return "Subdomain cannot be empty.";
    if (handle.length < MIN_LENGTH) {
        return `Subdomain must be at least ${MIN_LENGTH} characters.`;
    }
    if (handle.length > MAX_LENGTH) {
        return `Subdomain must be ${MAX_LENGTH} characters or fewer.`;
    }
    if (/^\d+$/.test(handle)) return "Subdomain cannot be only numbers.";
    if (!allowReserved && RESERVED_HANDLES.has(handle)) {
        return "That subdomain is reserved. Please choose another.";
    }
    if (!isValidHandle(handle)) {
        // A reserved handle still needs the DNS-safe shape even when it is the
        // account's current, grandfathered value.
        if (
            !allowReserved ||
            !/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(handle)
        ) {
            return "Use lowercase letters, numbers and hyphens.";
        }
    }

    return null;
};

// The single availability check used by both the live form and the save
// endpoint, so the two can never disagree.
export const checkIdentity = async ({ userId, username, handle }) => {
    const user = await User.findById(userId).select(
        "username handle identityKey"
    );
    if (!user) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
    }

    const currentUsernameKey = user.identityKey || usernameKey(user.username);
    const currentHandle = user.handle || "";

    const nextUsername = normalizeUsername(username);
    const nextHandle = sanitizeHandle(handle || nextUsername);
    const nextUsernameKey = usernameKey(nextUsername);

    const usernameUnchanged = nextUsernameKey === currentUsernameKey;
    const handleUnchanged = nextHandle === currentHandle;

    const usernameError = validateUsername(nextUsername, {
        allowReserved: usernameUnchanged,
    });
    const handleError = validateHandle(nextHandle, {
        allowReserved: handleUnchanged,
    });

    const usernameAvailable =
        usernameUnchanged ||
        !(await takenByOtherUser(nextUsernameKey, userId));
    const handleAvailable =
        handleUnchanged || !(await takenByOtherUser(nextHandle, userId));

    const usernameSuggestion =
        !usernameAvailable && nextUsernameKey
            ? await suggestAvailableKey(nextUsernameKey, userId)
            : null;
    const handleSuggestion =
        !handleAvailable && nextHandle
            ? await suggestAvailableKey(nextHandle, userId)
            : null;

    const changed =
        nextUsername !== user.username || nextHandle !== currentHandle;

    return {
        success: true,
        username: {
            value: nextUsername,
            key: nextUsernameKey,
            valid: !usernameError,
            available: usernameAvailable,
            error:
                usernameError ||
                (!usernameAvailable
                    ? "That username is already taken."
                    : null),
            suggestion: usernameSuggestion,
        },
        handle: {
            value: nextHandle,
            valid: !handleError,
            available: handleAvailable,
            error:
                handleError ||
                (!handleAvailable
                    ? "That subdomain is already taken."
                    : null),
            suggestion: handleSuggestion,
        },
        changed,
        canSave:
            changed &&
            !usernameError &&
            usernameAvailable &&
            !handleError &&
            handleAvailable,
    };
};
