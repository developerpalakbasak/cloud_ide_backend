import AppError from "../utils/AppError.js";

const errorHandler = (err, req, res, next) => {
  // default values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // CastError ( Wrong Mongodb Id entered)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    message = `Invalid : ${err.kind}`;
    err = new AppError(message, 400);
  }

  // missing path error for create user and project
  if (err.name == "ValidationError") {
    err.statusCode = 400;
  }

  // Validation Error (e.g., missing required fields)
  if (err.name === "ValidationError") {
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    statusCode = 400;
  }

  // Duplicate mongoose key error ( Duplicate User)
  if (err.code == 11000) {
    err.statusCode = 400;
    err.message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
    err = new AppError(err.message, 400);
  }

  // Wrong JWT error
  if (err.name === "JsonWebTokenError") {
    const message = `Invalid JsonWebToken, try again`;
    err = new AppError(message, 400);
  }

  // Expired JWT
  if (err.name === "TokenExpiredError") {
    message = "Your token has expired. Please log in again.";
    statusCode = 401;
  }


  res.status(statusCode).json({
    success: false,
    // err,
    status: err.status || "error",
    message,
  });
};

export default errorHandler;
