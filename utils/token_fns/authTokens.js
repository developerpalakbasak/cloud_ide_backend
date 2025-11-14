import jwt from "jsonwebtoken";

// Create JWT token from userInfo
export const createAccessToken = (userInfo) => {
  const secret = process.env.JWT_SECRET_ACCESS_TOKEN;

  const token = jwt.sign(userInfo, secret, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "7d",
  });

  return token;
};



export const reNewAccessToken = (user, res) => {
  // Generate new access token
  const access_token = user.generateAccessToken();

  const isProduction = process.env.NODE_ENV === "production";

  const optionsAccessToken = {
    expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY) * 60 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  };

  // Set new access token cookie
  res.cookie("access_token", access_token, optionsAccessToken);

  return access_token; // optional return
};
