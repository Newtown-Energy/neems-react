# Use Bun 1.x as base image for development
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files (.npmrc routes the @newtown-energy scope to GitHub Packages
# and reads the auth token from $GITHUB_PACKAGES_TOKEN)
COPY package.json bun.lock .npmrc ./

# Install dependencies. The GitHub Packages token is provided as a BuildKit
# secret so it is available only during this step and never persisted into an
# image layer or build metadata. Build with:
#   docker build --secret id=github_packages_token,env=GITHUB_PACKAGES_TOKEN ...
RUN --mount=type=secret,id=github_packages_token \
    GITHUB_PACKAGES_TOKEN="$(cat /run/secrets/github_packages_token 2>/dev/null)" \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port 5173
EXPOSE 5173

# Set environment variables
ENV NEEMS_REACT_PORT=5173
ENV NEEMS_CORE_SERVER=http://neems-api:8000

# Start the application in development mode (so proxy works)
CMD ["bun", "run", "dev"]
