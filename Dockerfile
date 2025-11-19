# Use Bun 1.x as base image for development
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port 5173
EXPOSE 5173

# Set environment variables
ENV NEEMS_REACT_PORT=5173
ENV NEEMS_CORE_SERVER=http://neems-api:8000

# Start the application in development mode (so proxy works)
CMD ["bun", "run", "dev"]