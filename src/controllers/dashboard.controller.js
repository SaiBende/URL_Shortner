import jwt from "jsonwebtoken";
import { URL } from "../models/url.model.js"; // Assuming URL model is located here
import { User } from "../models/user.model.js"; // Assuming User model is located here

const dashboard = async (req, res) => {
    try {
        //const token = req.cookies.token;
        // const token =localStorage.getItem('token') ;
        const token = req.headers['authorization']
        
        if (!token) {
            console.log("Token not found");
            return res.status(401).json({ error: "You are not logged in" });
        }

        // Verify the token and extract user info
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);

        if (!decoded.user_id) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const userId = decoded.user_id;

        // Fetch the user from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Fetch the URLs created by this user
        const urls = await URL.find({ createdBy: userId });

        // Return the user details and the URLs they created
        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                category: user.category,
                urlCount: user.urlCount,
                profilephoto: user.profilephoto,
            },
            urls,
        });

    } catch (error) {
        console.error("Error in dashboard controller:", error);
        return res.status(500).send("Internal Server Error");
    }
};

export { dashboard };
