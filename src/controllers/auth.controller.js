import { User } from "../models/user.model.js";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const authController = async (req, res) => {

}
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!(username && email && password)) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existinguser = await User.findOne({ email });
        if (existinguser) {
            return res.status(400).json({ status: "fail", error: "User already exists with this email" });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password: encryptedPassword
        });

        const token = jwt.sign(
            { user_id: user._id, email, username },
            process.env.TOKEN_KEY,
            // { expiresIn: "2h" }
        );
         // Set the token in a secure cookie
         res.cookie('token', token, {
            httpOnly: true,
            secure: true, // Ensures the cookie is only sent over HTTPS
            sameSite: 'None', // Allows cross-site requests
            path: '/',
        });

        // Here we don't set the token in the cookie; we will return it in the response
        return res.status(201).json({ user, token, message: "User registered successfully" });
    } catch (error) {
        console.log("Error caught at register user", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!(email && password)) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const user = await User.findOne({ email });
        if (user && (await bcrypt.compare(password, user.password))) {
            const token = jwt.sign(
                { user_id: user._id, email },
                process.env.TOKEN_KEY,
                // { expiresIn: "2h" }
            );
             // Set the token in a secure cookie
             res.cookie('token', token, {
                httpOnly: true,
                secure: true, // Ensures the cookie is only sent over HTTPS
                sameSite: 'None', // Allows cross-site requests
                path: '/',
            });
        
            // Return token in the response
            return res.status(200).json({ message: "Login Successfully", success: true, user, token });
        }

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
export { authController, register, login, logout }