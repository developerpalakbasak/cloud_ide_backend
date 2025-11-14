// utils/saveRefreshToken.js
import { UAParser } from "ua-parser-js";
import RefreshToken from "../../models/refreshToken.model.js";


export const saveRefreshToken = async (user, req) => {
  const refreshToken = user.generateRefreshToken();

  // Detect device/browser/IP
  const userAgentHeader = req.headers['user-agent'] || 'Unknown';
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
  const parser = new UAParser(userAgentHeader);
  const browser = parser.getBrowser().name || 'Unknown Browser';
  const device = parser.getDevice().model || parser.getOS().name || 'Unknown Device';

  // Save to DB
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    device,
    browser,
    ip,
  });

  return refreshToken; // return token to set cookie
};
