import { User } from "../models/user.model.js";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const authController = async (req, res) => {

}
const register = async (req, res) => {

    try {
        const { username, email, password } = req.body;
        // check all entry are present or not
        if (!(username && email && password)) {
            return res.status(400).json({ error: "All fields are required" });
        }
        //check if already it is a user or not by email
        const existinguser = await User.findOne({ email });
        if (existinguser) {
            return res.status(400).json({ error: "User already exist with this email" });
        }
        //encrypt the password using bcryptjs
        const encryptedPassword = await bcrypt.hash(password, 10);
        //save the user in database
        const user = await User.create({
            username,
            email,
            password: encryptedPassword
        })
        // generate a token for user and send it
        const token = jwt.sign(
            { user_id: user._id, email },
            process.env.TOKEN_KEY,
            {
                expiresIn: "2h",
            }
        );
        user.token = token;
        return res.status(201).json({ user, token });





    } catch (error) {
        console.log("error caatch at register user", error);

    }






}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if both email and password are provided
        if (!(email && password)) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Find the user by email
        const user = await User.findOne({ email });

        // Check if user exists and password is valid
        if (user && (await bcrypt.compare(password, user.password))) {
            // Generate a token
            const token = jwt.sign(
                { user_id: user._id, email },
                process.env.TOKEN_KEY,
                { expiresIn: "2h" }
            );

            // Assign the token to the user object
            user.token = token;

            // Set cookie options
            const options = {
                expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
                httpOnly: true,
            };

            // Send the token and user in response
            return res.status(200).cookie("token", token, options).json({ success: true, user, token });
        }

        // If user is not found or password is invalid
        return res.status(400).json({ error: "Invalid email or password" });
    } catch (error) {
        console.log("Error at login controller", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const logout = (req, res) => {
    res.cookie("token", "", { expires: new Date(0), httpOnly: true });
    return res.status(200).json({ message: "Successfully logged out" });
}
export { authController, register,login ,logout}