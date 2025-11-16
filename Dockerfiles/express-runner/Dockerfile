FROM node:20-alpine

# Install Git + Nodemon
RUN apk add --no-cache git \
    && npm install -g nodemon

WORKDIR /usr/src/app

EXPOSE 8000

# Keep container alive
CMD ["sh", "-c", "tail -f /dev/null"]
