// Clerk owns registration, login, email verification and password reset.
// This endpoint exists so the frontend can confirm a session and trigger
// the local MongoDB user sync performed by the auth middleware.
const isauthenticated = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "You are authenticated",
        user: req.user,
    });
};

export { isauthenticated };
