import { saveRefreshToken } from "./saveRefreshToken.js";


const sendToken = async (user, statusCode, islogin, isOauth, req, res) => {

    // Generate and save refresh token
    const refresh_token = await saveRefreshToken(user, req);

    // Generate access token
    const access_token = user.generateAccessToken();



    const isProduction = process.env.NODE_ENV === "production";

    const optionsRefreshToken = {
        expires: new Date(Date.now() + Number(process.env.REFRESH_COOKIE_VALIDITY) * 24 * 60 * 60 * 1000),
        httpOnly: true,                 // prevents JS access
        secure: isProduction,           // only send over HTTPS
        sameSite: 'strict',             // CSRF protection for same-site requests
        path: '/',
    };

    const optionsAccessToken = {
        expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY) * 60 * 1000),
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
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
