import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  createFrameworkProject,
  createLanguageProject,
  createNew,
  deleteProject,
  deleteSingleFile,
  editEntryFile,
  getAllProject,
  getFileCodes,
  getProjectFromSlug,
  getTree,
  getTreeFromSlug,
  saveMultipleFiles,
} from "./controller/project.controller.js";
import { authGithub, authGithubCallback, authGoogle, authGoogleCallback, checkUsernameAbleablity, createUser, currentUser, loginUser, logoutUser, updateAccessToken, updateInfo, userUsingUsername } from "./controller/user.controller.js";
import { connectDB } from "./config/db.js";
import cookieParser from "cookie-parser";
import isAuthenticated, { isAuthenticReq } from "./middleware/auth.js";
import "dotenv/config";
import { socketHandler } from "./socket/socket.js";
import morgan from "morgan";
import errorHandler from "./middleware/errorHandler.js";


const app = express();
const httpServer = createServer(app);

// Enable CORS for your Next.js frontend
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  cors({
    origin: "http://localhost:3000", // your frontend URL
    credentials: true, // needed if sending cookies
  })
);
app.use(express.json());
connectDB();

// user routes
app.post("/api/user/create", createUser);
app.post("/api/user/login", loginUser);
app.get("/api/user/logout", logoutUser);
app.post("/api/user/username-ableablity", checkUsernameAbleablity);
app.get("/api/user/info", isAuthenticReq, isAuthenticated, currentUser);
app.post("/api/user/update-info", isAuthenticReq, isAuthenticated, updateInfo);
app.get("/api/user/:username", userUsingUsername);

// update access token route for socket.io connection
app.post("/api/update-token", updateAccessToken);

// oauth routes
app.get("/api/auth/github", authGithub);
app.get("/api/auth/github/callback", authGithubCallback);
app.get("/api/auth/google", authGoogle);
app.get("/api/auth/google/callback", authGoogleCallback);

// project  routes
app.post("/api/create/languageproject", isAuthenticated, createLanguageProject);
app.post("/api/create/frameworkproject", isAuthenticated, createFrameworkProject);
app.delete("/api/project/delete/:id", isAuthenticated, deleteProject);
app.get("/api/project/getall", isAuthenticated, getAllProject);
app.get("/api/project/:slug", isAuthenticated, getProjectFromSlug);
app.post("/api/project/:slug/editexescript", isAuthenticated, editEntryFile);

// work ==> need to make this for all user (auth and unauth both)
app.get("/api/project/:slug/tree", isAuthenticated, getTreeFromSlug);

// Route of file and folder
app.get("/api/project/:slug/file", isAuthenticated, getFileCodes);
app.post("/api/project/:slug/save-multiple", isAuthenticated, saveMultipleFiles);
app.post("/api/project/:slug/deletefile", isAuthenticated, deleteSingleFile);
app.post("/api/project/:slug/new", isAuthenticated, createNew);


app.get("/api", (req,res)=>{
  res.send("api is running")
});


// global errorhandler
app.use(errorHandler);

socketHandler(io);

const port = process.env.MAIN_SERVER_PORT
// Start server
httpServer.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
