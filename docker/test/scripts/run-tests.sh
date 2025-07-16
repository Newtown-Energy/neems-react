#!/bin/sh

### DO NOT RUN THIS SCRIPT DIRECTLY.
###
### THIS GETS RUN BY DOCKER AND ALSO BY DOSH TEST.

### This script runs tests in the docker container and also on the
### host system.  That is, it can be run in either environment and
### will work.  If you make changes to this script, make sure it works
### in both places.

### If you are trying to make it work, make sure you have
### NEEMS_CORE_SERVER set in your environment to the url of the API
### server.

### You shouldn't run this script directly. Instead, use the `dosh
### test-local` or `dost test` function in the `dosh` task runner.

echo NEEMS_CORE_SERVER: ${NEEMS_CORE_SERVER}
echo Test parameters: ${TEST_PARAMETERS}

echo "nginx logs are in the react repo from where you're running 'dosh test'. Look in 'docker/test/nginx/logs'."

wget --spider http://nginx/api/1/status || {
  echo "API server is not responding. Exiting."
  exit 1
}

echo "API Server is up at ${NEEMS_CORE_SERVER}"
echo


# Run tests with correct environment
# xvfb-run -a npx jest --config ./tests/jest.config.js
npx jest --colors --config ./tests/jest.config.js "${TEST_PARAMETERS}"

TEST_EXIT_CODE=$?
exit $TEST_EXIT_CODE
