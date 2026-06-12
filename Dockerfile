# Use Bun 1.x as base image for development
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies. @newtown-energy/types is published to GitHub Packages,
# which requires auth even for public packages. The token is supplied as a
# BuildKit secret (id=github_token) so it never lands in an image layer; we
# write a throwaway .npmrc for the install only, then remove it.
RUN --mount=type=secret,id=github_token \
    printf '@newtown-energy:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$(cat /run/secrets/github_token)" > .npmrc \
 && bun install --frozen-lockfile \
 && rm -f .npmrc

# Copy source code
COPY . .

# Expose port 5173
EXPOSE 5173

# Set environment variables
ENV NEEMS_REACT_PORT=5173
ENV NEEMS_CORE_SERVER=http://neems-api:8000

# Start the application in development mode (so proxy works)
CMD ["bun", "run", "dev"]
