import { User } from "../models/user.model.js";
import { extractHandleFromHost, normalizeHost } from "../utils/handles.js";

// Public, read-only lookup used by the tenant app. The hostname is passed
// explicitly because the API lives on a different origin from the subdomain.
const getPublicSite = async (req, res) => {
    try {
        const host = normalizeHost(req.query.host);
        const handle = extractHandleFromHost(host);

        if (!handle) {
            return res.status(404).json({ error: "Site not found" });
        }

        const user = await User.findOne({ handle }).select(
            "username handle socialMediaLinks description profilephoto"
        );

        if (!user) {
            return res.status(404).json({ error: "Site not found" });
        }

        return res.status(200).json({
            username: user.username,
            handle: user.handle,
            socialMediaLinks: user.socialMediaLinks,
            description: user.description,
            profilephoto: user.profilephoto,
        });
    } catch (error) {
        console.error("Error resolving public site:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { getPublicSite };
