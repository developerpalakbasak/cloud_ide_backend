FROM node:20-alpine

# Install Git
RUN apk add --no-cache git

# Install both TypeScript and ts-node globally
RUN npm install -g typescript ts-node

WORKDIR /usr/src/app

CMD ["node"]
