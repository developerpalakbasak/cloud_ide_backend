import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import RefreshToken from "../models/refreshToken.model.js";
import { saveRefreshToken } from "../utils/token_fns/saveRefreshToken.js";

export default async function isAuthenticated(req, res, next) {
  const { access_token, refresh_token } = req.cookies;
  try {

    if (!refresh_token) {
      return next(new AppError("Please login first", 401));
    }

    const decodedAccessToken = jwt.verify(access_token, process.env.JWT_SECRET_ACCESS_TOKEN);
    req.user = decodedAccessToken;

    return next();
  } catch (error) {

    try {
      const findRefreshToken = await RefreshToken.findOne({ token: refresh_token })

      if (!findRefreshToken) {
        return next(new AppError("Authentication failed", 404));
      }

      const decodedRefresh = jwt.verify(refresh_token, process.env.JWT_SECRET_REFRESH_TOKEN);

      if (decodedRefresh.id.toString() !== findRefreshToken.userId.toString()) {
        return next(new AppError("Bad request please login again", 400));

      }

      // Try refreshing with refresh token

      const user = await User.findById(decodedRefresh.id);

      if (!user) return next(new AppError("User not found", 404));

      const timeLeft = decodedRefresh.exp - Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60; // 24 hours in seconds

      // Refresh token rataing for regular user  
      if (timeLeft < oneDay) {
        console.log("⏳ Refresh token almost expired, rotating...");

        const refresh_token = await saveRefreshToken(user, req);

        res.cookie("refresh_token", refresh_token, {
          httpOnly: true,
          expires: new Date(Date.now() + Number(process.env.REFRESH_COOKIE_VALIDITY) * 24 * 60 * 60 * 1000),
        });

      }

      const newAccessToken = await user.generateAccessToken();

      // console.log(newAccessToken);
      
      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY) * 60 * 1000),
      });

      // Important: send signal so frontend knows to retry
      return res.status(401).json({
        success: false,
        retry: true,
        message: "Access token refreshed. Retry request.",
      });

    } catch (refreshErr) {
      console.log("catch block")
      return next(new AppError("Session expired, please login again", 401));
    }
  }
}





// Block non-XHR direct access
const isAuthenticReq = (req, res, next) => {
  const xhrHeader = req.get("x-requested-with");

  // Allow only requests that include the XHR header (like fetch/axios)
  if (xhrHeader !== process.env.AUTH_REQUEST_HEADER) {
    return res.status(403).json({ message: "Forbidden direct access" });
  }

  next();
}


export { isAuthenticReq }