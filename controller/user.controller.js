import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import sendToken from "../utils/token_fns/sendAuthTokens.js";
import catchAsync from "../utils/catchAsync.js";
import axios from "axios";
import RefreshToken from "../models/refreshToken.model.js";
import AppError from "../utils/AppError.js";
import { reNewAccessToken } from "../utils/token_fns/authTokens.js";

// Register new user
export const createUser = catchAsync(async (req, res, next) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    return next(new AppError("All fields are required", 400));
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError("Email already registered", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    name,
    username,
    email,
    password: hashedPassword,
    provider: "Credentials",
    isVerified: false,
  });
  await user.save();

  const isOauth = false

  // for later => verify users email using nodemailer

  await sendToken(user, 201, false, isOauth, req, res);

});

// Login user
export const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError("Email and password required", 400));
  }
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(new AppError("Invalid credentials", 400));
  }
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return next(new AppError("Invalid credentials", 400));
  }
  const isOauth = false
  await sendToken(user, 200, false, isOauth, req, res);
});


// Check username ableablity
export const checkUsernameAbleablity = catchAsync(async (req, res, next) => {
  const { username } = req.body;

  if (!username) {
    return next(new AppError("Enter a username", 400));
  }

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "username is available"
    });
  }
  return next(new AppError("username isn't available", 404));

});

// Logout user
export const logoutUser = catchAsync(async (req, res, next) => {

  const { refresh_token } = req.cookies;

  if (refresh_token) {
    // Delete the refresh token document from DB
    await RefreshToken.deleteOne({ token: refresh_token });
  }

  res
    .clearCookie("refresh_token", { path: "/" })
    .clearCookie("access_token", { path: "/" })
    .json({
      success: true,
      message: "Logout successful",
    });
});

// Get current logged-in user
export const currentUser = catchAsync(async (req, res, next) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// Get user by username
export const userUsingUsername = catchAsync(async (req, res, next) => {
  const { username } = req.params;

  if (!username) {
    return next(new AppError("Username is required", 404));
  }

  const user = await User.findOne({ username });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({ success: true, user });
});


//  Redirect user to Github OAuth 
export const authGithub = catchAsync((req, res, next) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email`;
  res.redirect(redirectUrl);
});

// Github OAuth callback
export const authGithubCallback = catchAsync(async (req, res, next) => {
  const code = req.query.code;
  if (!code) return next(new AppError("Code not provided", 404));
  // Exchange code for access token
  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    },
    { headers: { Accept: "application/json" } }
  );

  const accessToken = tokenResponse.data.access_token;

  // Get user info from GitHub
  const userResponse = await axios.get("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { id, login, avatar_url, name } = userResponse.data;

  // Get email if not provided in main user object
  let email = userResponse.data.email;
  if (!email) {
    const emailResponse = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const primaryEmail = emailResponse.data.find(e => e.primary && e.verified);
    email = primaryEmail ? primaryEmail.email : null;
  }
  ;

  if (!email) return next(new AppError("Email not available from Github", 400));

  // Check if user exists
  let user = await User.findOne({ email });

  // Generate username if necessary
  let username = login;
  let existingUser = await User.findOne({ username });
  if (existingUser) {
    let counter = 1;
    let newUsername = `${username}_${counter}`;
    while (await User.findOne({ username: newUsername })) {
      counter++;
      newUsername = `${username}_${counter}`;
    }
    username = newUsername;
  }

  const isOauth = true;

  if (!user) {
    user = new User({
      name: name || login,
      username,
      email,
      password: undefined,
      avatar: avatar_url,
      provider: "github",
      oauthId: id,
      isVerified: true,
    });
    await user.save();
    await sendToken(user, 201, false, isOauth, req, res);
  } else {
    await sendToken(user, 200, false, isOauth, req, res);
  }
});


// Redirect user to Google OAuth
export const authGoogle = catchAsync((req, res, next) => {
  const redirectUri = encodeURIComponent(`${process.env.SERVER_URL}/api/auth/google/callback`);
  const scope = encodeURIComponent("https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile");

  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(redirectUrl);
});


// Google OAuth callback
export const authGoogleCallback = catchAsync(async (req, res, next) => {
  const code = req.query.code;
  if (!code) return next(new AppError("Code not provided", 400));

  // Exchange code for tokens
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.SERVER_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const { access_token } = tokenResponse.data;

  // Get user info
  const userResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const { id, email, name, picture } = userResponse.data;

  let user = await User.findOne({ email });
  let username = email.split("@")[0];

  // Check if username exists and find next available username
  let existingUser = await User.findOne({ username });
  if (existingUser) {
    let counter = 1;
    let newUsername = `${username}_${counter}`;

    // Keep incrementing until you find an unused username
    while (await User.findOne({ username: newUsername })) {
      counter++;
      newUsername = `${username}_${counter}`;
    }

    username = newUsername;
  }

  const isOauth = true
  if (!user) {
    user = new User({
      name,
      username,
      email,
      password: undefined,
      avatar: picture,
      provider: "google",
      oauthId: id,
      isVerified: true,
    });
    await user.save()

    await sendToken(user, 201, false, isOauth, req, res);

  } else {

    await sendToken(user, 200, false, isOauth, req, res);

  }

});



// update access token for socket.io connection
export const updateAccessToken = catchAsync((req, res, next) => {
  const { access_token } = req.body;

  if (!access_token) {
    return next(new AppError("Access token is required", 400));

  }

  const isProduction = process.env.NODE_ENV === "production";

  const optionsAccessToken = {
    expires: new Date(Date.now() + Number(process.env.ACCESS_COOKIE_VALIDITY) * 60 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  };

  res
    .cookie("access_token", access_token, optionsAccessToken)
    .status(200).json({
      success: true,
      access_token
    });
});


// update access token for socket.io connection
export const updateInfo = catchAsync(async (req, res, next) => {
  const { name, username, bio } = req.body;

  const updateData = {};

  if (name !== undefined && name !== req.user.name) updateData.name = name;
  if (username !== undefined && username !== req.user.username) updateData.username = username;
  if (bio !== undefined && bio !== req.user.bio) updateData.bio = bio;

  if (Object.keys(updateData).length === 0) {
    return next(new AppError("No changes detected", 400));
  }


  const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
    new: true,
    runValidators: true,
  });

   reNewAccessToken(updatedUser, res);
  
  res.status(200).json({
    success: true,
    message: "Updated!"
  })


});
