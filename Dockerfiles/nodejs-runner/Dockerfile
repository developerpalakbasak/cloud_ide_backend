FROM node:20-alpine

# Install Git (no cache → smaller image)
RUN apk add --no-cache git

# Optional: Install nodemon (remove if you don't need it)
RUN npm install -g nodemon

WORKDIR /usr/src/app

# Expose your Express port (change if needed)
EXPOSE 8000

# Keep container alive (runner mode)
CMD ["sh", "-c", "tail -f /dev/null"]
