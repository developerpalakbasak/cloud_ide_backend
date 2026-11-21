// socketmiddleware.js
import cookie from "cookie";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export default async function isAuthSocket(socket, next) {
  try {
    const rawCookie = socket.request.headers.cookie;
    if (!rawCookie) return next(new Error("No cookie found"));

    const cookies = cookie.parse(rawCookie);
    const access_token = cookies.access_token || cookies["access-token"] || cookies.accessToken;
    const refresh_token = cookies.refresh_token || cookies["refresh-token"] || cookies["refesh-token"] || cookies.refreshToken;

    if (!refresh_token && !access_token) return next(new Error("Please login first"));

    try {
      // Verify access token first
      const decodedAccess = jwt.verify(access_token, process.env.JWT_SECRET_ACCESS_TOKEN);
      socket.user = decodedAccess;
      return next();
    } catch (accessErr) {
      if (!refresh_token) return next(new Error("Please login first"));

      // Try refreshing access token using refresh_token statelessly
      try {
        const decodedRefresh = jwt.verify(refresh_token, process.env.JWT_SECRET_REFRESH_TOKEN);

        let user = await User.findById(decodedRefresh.id).catch(() => null);
        if (!user && decodedRefresh.username) {
          user = {
            _id: decodedRefresh.id,
            id: decodedRefresh.id,
            username: decodedRefresh.username,
            name: decodedRefresh.name,
            avatar: decodedRefresh.avatar,
            email: decodedRefresh.email,
            isVerified: decodedRefresh.isVerified,
            generateAccessToken() {
              return jwt.sign(
                {
                  id: this._id || this.id,
                  name: this.name,
                  avatar: this.avatar,
                  username: this.username,
                },
                process.env.JWT_SECRET_ACCESS_TOKEN,
                { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" }
              );
            },
            generateRefreshToken() {
              return jwt.sign(
                {
                  id: this._id || this.id,
                  username: this.username,
                  name: this.name,
                  avatar: this.avatar,
                  email: this.email,
                },
                process.env.JWT_SECRET_REFRESH_TOKEN,
                { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "7d" }
              );
            },
          };
        }

        if (!user) return next(new Error("User not found"));

        const timeLeft = decodedRefresh.exp - Math.floor(Date.now() / 1000);
        const oneDay = 24 * 60 * 60;

        // Rotate refresh token if it's near expiry
        if (timeLeft < oneDay) {
          console.log("⏳ Rotating socket refresh token...");
          const newRefreshToken = user.generateRefreshToken();
          socket.emit("token:refresh", { refresh_token: newRefreshToken });
        }

        const newAccessToken = await user.generateAccessToken();
        // emit event to make a http call and reset the access token 
        socket.emit("token:refreshed", { access_token: newAccessToken });

        // Attach user to socket
        socket.user = {
          id: user._id,
          name: user.name,
          username: user.username,
          isVerified: user.isVerified,
          provider: user.provider,
          bio: user.bio,
        };

        console.log("✅ Socket token refreshed successfully");
        next();
      } catch (refreshErr) {
        console.error("Socket refresh failed:", refreshErr);
        return next(new Error("Session expired, please login again"));
      }
    }
  } catch (err) {
    console.error("Socket Auth Error:", err);
    next(new Error("Socket authentication failed"));
  }
}
