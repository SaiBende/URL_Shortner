import { User } from "../../models/user.model.js";
import multer from "multer";
import cloudinary from "../../utils/cloudinary.js";

const publicprofile = async (req, res) => {
    try {
        const { username } = req.params;

        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Public data only — never expose email/password/category here
        const profileData = {
            username: user.username,
            socialMediaLinks: user.socialMediaLinks,
            description: user.description,
            profilephoto: user.profilephoto,
        };

        return res.status(200).json(profileData);
    } catch (error) {
        console.error("Error in public profile route:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const addsocialmedialinkpublicprofilelink = async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        const { platform, link } = req.body;

        if (!platform || !link) {
            return res.status(400).json({ error: "Platform and link are required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.socialMediaLinks.set(platform, link); // Add or update the link
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${platform} link added successfully`,
            socialMediaLinks: user.socialMediaLinks,
        });
    } catch (error) {
        console.error("Error adding social media link:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const deletesocialmedialinkpublicprofilelink = async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        const { platform } = req.body;

        if (!platform) {
            return res.status(400).json({ error: "Platform is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.socialMediaLinks || !user.socialMediaLinks.has(platform)) {
            return res.status(400).json({ error: `${platform} link does not exist` });
        }

        user.socialMediaLinks.delete(platform); // Delete the link
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${platform} link deleted successfully`,
            socialMediaLinks: user.socialMediaLinks,
        });
    } catch (error) {
        console.error("Error deleting social media link:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const adddescriptionpublicprofile = async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Description is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.description = description;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Description updated successfully",
            description: user.description,
        });
    } catch (error) {
        console.error("Error updating description:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// Profile photo update

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    },
});

// Controller function to update profile photo (runs after the auth middleware)
const updateProfilePhoto = (req, res) => {
    upload.single("profilephoto")(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || "Error uploading the photo" });
        }

        // Check if file is available
        if (!req.file) {
            return res.status(400).json({ error: "No photo uploaded" });
        }

        const userId = req.user.user_id;

        // Upload the photo buffer to Cloudinary
        cloudinary.uploader
            .upload_stream({ folder: "user_profile_photos" }, async (error, result) => {
                if (error) {
                    return res.status(400).json({ error: "Error uploading the photo to Cloudinary" });
                }

                const photoUrl = result.secure_url;

                try {
                    // Update the user profile photo URL in the database
                    const user = await User.findByIdAndUpdate(userId, { profilephoto: photoUrl }, { new: true });

                    if (!user) {
                        return res.status(404).json({ error: "User not found" });
                    }

                    const safeUser = user.toObject();
                    delete safeUser.password;

                    // Send the response back
                    return res.status(200).json({
                        success: true,
                        message: "Profile photo updated successfully",
                        profilePhotoUrl: photoUrl,
                        user: safeUser,
                    });
                } catch (updateError) {
                    console.error("Error updating user profile photo:", updateError);
                    return res.status(500).json({ error: "Error updating user profile photo" });
                }
            })
            .end(req.file.buffer);
    });
};

export {
    publicprofile,
    addsocialmedialinkpublicprofilelink,
    deletesocialmedialinkpublicprofilelink,
    adddescriptionpublicprofile,
    updateProfilePhoto,
};
