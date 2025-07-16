#!/bin/sh

### THIS GETS RUN FROM INSIDE THE CONTAINER.  RUN THE TESTS WITH DOSH TEST


# Wait for server using wget
sleep 0.3
while ! curl -sS http://nginx; do
  sleep 0.1
done

echo "Server is running and serving static pages."

echo "nginx logs are in the react repo from where you're running 'dosh test'. Look in 'docker/test/nginx/logs'."

wget --spider http://nginx/api/1/status || {
  echo "API server is not responding. Exiting."
  exit 1
}

echo "API Server is up at ${API_TARGET}"
echo

# Run tests with correct environment
# xvfb-run -a npx jest --config ./tests/jest.config.js
npx jest --config ./tests/jest.config.js

TEST_EXIT_CODE=$?
exit $TEST_EXIT_CODE
