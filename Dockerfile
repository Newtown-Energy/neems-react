# Use Node.js 20 as base image for development
FROM node:20-bookworm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Expose port 5173
EXPOSE 5173

# Set environment variables
ENV NEEMS_REACT_PORT=5173
ENV NEEMS_CORE_SERVER=http://neems-api:8000

# Start the application in development mode (so proxy works)
CMD ["yarn", "dev"]