import { User } from "../models/user.model.js";
import { platformHostFor } from "../utils/handles.js";
import { checkIdentity } from "../utils/identity.js";

const publicUser = (user) => ({
    username: user.username,
    handle: user.handle,
    platformHost: user.handle ? platformHostFor(user.handle) : null,
});

const checkName = async (req, res) => {
    try {
        const result = await checkIdentity({
            userId: req.user.user_id,
            username: req.body?.username,
            handle: req.body?.handle,
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error checking name:", error);
        return res.status(error.status || 500).json({
            success: false,
            message:
                error.status === 404
                    ? "User not found."
                    : "Could not check that name. Please try again.",
        });
    }
};

const updateIdentity = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await checkIdentity({
            userId,
            username: req.body?.username,
            handle: req.body?.handle,
        });

        if (!result.changed) {
            const user = await User.findById(userId);
            return res.status(200).json({
                success: true,
                user: publicUser(user),
            });
        }

        if (!result.canSave) {
            return res.status(400).json({
                ...result,
                success: false,
            });
        }

        const user = await User.findById(userId);
        user.username = result.username.value;
        user.handle = result.handle.value;
        user.identityKey = result.username.key;
        await user.save();

        return res.status(200).json({
            success: true,
            user: publicUser(user),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    "That name was just taken. Please choose another one.",
            });
        }

        console.error("Error updating identity:", error);
        return res.status(error.status || 500).json({
            success: false,
            message:
                error.status === 404
                    ? "User not found."
                    : "Could not update your address. Please try again.",
        });
    }
};

export { checkName, updateIdentity };
