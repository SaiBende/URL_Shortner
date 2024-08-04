import jwt from "jsonwebtoken";

const dashboard = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.TOKEN_KEY);
            console.log(decoded, "auth middleware");
            req.user = decoded;
            const userdetail = req.user;
            return res.send(userdetail); // Use return to exit the function after sending the response
        }
        return res.send("Hello"); // Use return here as well
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error"); // Send a proper error response if an exception occurs
    }
};

export { dashboard };
