#!/bin/sh

### THIS GETS RUN FROM INSIDE THE CONTAINER.  RUN THE TESTS WITH DOSH

# Start server
node server.js &

# Wait for server using wget
while ! curl -sS http://127.0.0.1:5175; do
  sleep 0.1
done

echo "Server is running and serving static pages."

# while ! curl -sS http://localhost:5175/api/1/status; do
#   sleep 0.1
# done

# Run tests with correct environment
xvfb-run -a npx jest --config ./tests/jest.config.js

TEST_EXIT_CODE=$?
kill %1
exit $TEST_EXIT_CODE
