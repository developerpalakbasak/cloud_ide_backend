import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";

export default async function isAuthenticated(req, res, next) {
  const access_token =
    req.cookies.access_token ||
    req.cookies["access-token"] ||
    req.cookies.accessToken;

  const refresh_token =
    req.cookies.refresh_token ||
    req.cookies["refresh-token"] ||
    req.cookies["refesh-token"] ||
    req.cookies.refreshToken;

  const isProduction = process.env.NODE_ENV === "production" && !req.headers.host?.includes("localhost");
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };

  const clearAuthCookies = (response) => {
    ["access_token", "access-token", "accessToken",
     "refresh_token", "refresh-token", "refesh-token", "refreshToken"].forEach((name) => {
      response.clearCookie(name, cookieOptions);
    });
  };

  try {
    // If no access token and no refresh token, user is not logged in
    if (!access_token && !refresh_token) {
      return next(new AppError("Please login first", 401));
    }

    // Try verifying access token first
    if (access_token) {
      const decodedAccessToken = jwt.verify(access_token, process.env.JWT_SECRET_ACCESS_TOKEN);
      req.user = decodedAccessToken;
      return next();
    }

    // If access_token was not present, trigger catch to handle refresh_token
    throw new Error("No access token provided");
  } catch (error) {
    // Access token missing or expired -> verify refresh token
    if (!refresh_token) {
      return next(new AppError("Please login first", 401));
    }

    let decodedRefresh;
    try {
      decodedRefresh = jwt.verify(refresh_token, process.env.JWT_SECRET_REFRESH_TOKEN);
    } catch (refreshErr) {
      // ONLY clear cookies if the refresh token ITSELF is genuinely invalid or expired!
      clearAuthCookies(res);
      return next(new AppError("Session expired, please login again", 401));
    }

    // Refresh token is VALID! Never remove or clear refresh_token below this point.
    try {
      let user = await User.findById(decodedRefresh.id).catch(() => null);

      if (!user && decodedRefresh.username) {
        // Fallback to token payload if DB lookup is temporarily unavailable during server restart
        user = {
          _id: decodedRefresh.id,
          id: decodedRefresh.id,
          username: decodedRefresh.username,
          name: decodedRefresh.name,
          avatar: decodedRefresh.avatar,
          email: decodedRefresh.email,
          isVerified: decodedRefresh.isVerified,
        };
      }

      if (!user) {
        clearAuthCookies(res);
        return next(new AppError("User not found, please login again", 401));
      }

      // Stateless refresh token rotation if near expiry (< 1 day)
      const timeLeft = decodedRefresh.exp - Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60; // 24h in seconds

      if (timeLeft < oneDay) {
        const newRefreshToken = jwt.sign(
          {
            id: user._id || user.id,
            username: user.username,
            name: user.name,
            avatar: user.avatar,
            email: user.email,
            isVerified: user.isVerified,
          },
          process.env.JWT_SECRET_REFRESH_TOKEN,
          { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "7d" }
        );

        res.cookie("refresh_token", newRefreshToken, {
          ...cookieOptions,
          expires: new Date(Date.now() + Number(process.env.REFRESH_COOKIE_VALIDITY || 7) * 24 * 60 * 60 * 1000),
        });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          id: user._id || user.id,
          name: user.name,
          avatar: user.avatar,
          username: user.username,
          isVerified: user.isVerified,
          provider: user.provider,
          bio: user.bio,
        },
        process.env.JWT_SECRET_ACCESS_TOKEN,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" }
      );

      res.cookie("access_token", newAccessToken, {
        ...cookieOptions,
        expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY || 15) * 60 * 1000),
      });

      // Attach decoded new access token to req.user and proceed
      req.user = jwt.verify(newAccessToken, process.env.JWT_SECRET_ACCESS_TOKEN);
      return next();
    } catch (err) {
      console.error("Auth token processing error:", err.message);
      // Do NOT clear refresh token on internal errors during server restart
      return next(new AppError("Authentication temporary error, please retry", 500));
    }
  }
}

// ========================
// Block non-XHR direct access
// ========================
const isAuthenticReq = (req, res, next) => {
  const xhrHeader = req.get("x-requested-with");

  if (
    xhrHeader !== process.env.AUTH_REQUEST_HEADER &&
    xhrHeader !== "hello_from_frontend" &&
    xhrHeader !== "hello_from_forntend"
  ) {
    return res.status(403).json({ message: "Forbidden direct access" });
  }

  next();
};

export { isAuthenticReq };

