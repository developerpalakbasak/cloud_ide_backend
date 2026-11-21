const sendToken = async (user, statusCode, islogin, isOauth, req, res) => {
    // Generate stateless refresh token (no session stored on server)
    const refresh_token = user.generateRefreshToken();

    // Generate access token
    const access_token = user.generateAccessToken();

    const isProduction = process.env.NODE_ENV === "production" && !req?.headers?.host?.includes("localhost");

    const optionsRefreshToken = {
        expires: new Date(Date.now() + Number(process.env.REFRESH_COOKIE_VALIDITY || 7) * 24 * 60 * 60 * 1000),
        httpOnly: true,                 // prevents JS access
        secure: isProduction,           // only send over HTTPS in production
        sameSite: isProduction ? 'none' : 'lax', // Lax for local cross-origin, none for cross-site prod
        path: '/',
    };

    const optionsAccessToken = {
        expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY || 15) * 60 * 1000),
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
    };

    res.cookie("refresh_token", refresh_token, optionsRefreshToken)
        .cookie("access_token", access_token, optionsAccessToken);

    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:5173/dashboard"
    if (isOauth) {
        return res
            .redirect(redirectUrl);
    }

    return res.status(statusCode).json({
        success: true,
        message: islogin ? "Login successful" : "User created successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            isVerified: user.isVerified
        },
    });
};

export default sendToken;
