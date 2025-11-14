// socketmiddleware.js
import cookie from "cookie";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { saveRefreshToken } from "../utils/token_fns/saveRefreshToken.js";

export default async function isAuthSocket(socket, next) {
  try {
    const rawCookie = socket.request.headers.cookie;
    if (!rawCookie) return next(new Error("No cookie found"));

    const cookies = cookie.parse(rawCookie);
    const access_token = cookies.access_token;
    const refresh_token = cookies.refresh_token;

    if (!refresh_token) return next(new Error("Please login first"));

    try {

      // Verify access token first
      const decodedAccess = jwt.verify(access_token, process.env.JWT_SECRET_ACCESS_TOKEN);
      socket.user = decodedAccess;
      return next();

    } catch (accessErr) {
      // Try refreshing access token using refresh_token
      try {
        const findRefreshToken = await RefreshToken.findOne({ token: refresh_token });
        if (!findRefreshToken) return next(new Error("Authentication failed"));

        const decodedRefresh = jwt.verify(refresh_token, process.env.JWT_SECRET_REFRESH_TOKEN);

        if (decodedRefresh.id.toString() !== findRefreshToken.userId.toString()) {
          return next(new Error("Invalid refresh token"));
        }

        const user = await User.findById(decodedRefresh.id);
        if (!user) return next(new Error("User not found"));

        const timeLeft = decodedRefresh.exp - Math.floor(Date.now() / 1000);
        const oneDay = 24 * 60 * 60;

        // Rotate refresh token if it’s near expiry
        if (timeLeft < oneDay) {
          console.log("⏳ Rotating socket refresh token...");
          const newRefreshToken = await saveRefreshToken(user);
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
