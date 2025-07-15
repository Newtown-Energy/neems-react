#!/bin/sh

### THIS GETS RUN FROM INSIDE THE CONTAINER.  RUN THE TESTS WITH DOSH TEST

# Wait for server using wget
sleep 0.3
while ! curl -sS http://nginx; do
  sleep 0.1
done

echo "Server is running and serving static pages."

while ! curl -sS http://nginx/api/1/status; do
   sleep 0.1
done

echo
echo "API Server is up at ${API_TARGET}"

# Run tests with correct environment
xvfb-run -a npx jest --config ./tests/jest.config.js

TEST_EXIT_CODE=$?
exit $TEST_EXIT_CODE
