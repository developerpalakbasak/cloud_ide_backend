const imageMap = {
    nodejs: process.env.NODE_IMAGE || "node:20-alpine",
    typescript: process.env.TS_IMAGE || "node:20-ts",
    python: process.env.PYTHON_IMAGE || "python:3.12-alpine",
    express: process.env.EXPRESS_IMAGE || "express-runner:latest",
    "html-css-js": null,
};

export default imageMap