import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
    // console.log(req.cookies); // Log cookies for debugging
    // const token = req.cookies.token; // Get the token from cookies
    const token=req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ success: false, message: "You are not logged in" });
    }

    try {
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        console.log(decoded, "auth middleware called");
        req.user = decoded; // Store the decoded user info in the request object
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error(error); // Log the error for debugging
        return res.status(401).json({ status: "fail", message: "You are not authenticated" });
    }
};

export { auth };
