# Use an official Node.js runtime as a parent image
FROM node:18
ENV NODE_ENV=production

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .
# Build the application
RUN npx tsc 

# Set the working directory to the build output directory
WORKDIR /usr/src/app/dist

# Expose the port the app runs on
EXPOSE 8585

# Run the application
CMD ["node", "index.js"]