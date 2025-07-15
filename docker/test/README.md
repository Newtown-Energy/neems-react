# NEEMS React Tester

Docker container to test our frontend as it hits our upstream NEEMS
API server.

# Running

`dosh test` should build the docker images and run the tests.  There
is a script called `scripts/run-tests.sh` that runs in the docker
container.  Do not run it directly from the command line.  The
Dockerfile handles that for you.

# Environment

Take a look in env.example.  Set those in .env.

 * NEEMS_STATIC_DIR: this is where the running `server.js` gets static files from
 * API_TARGET: this where `server.js` will proxy /api 

# Components

 * Jest: Runs the tests and provides assertions (expect).

 * Puppeteer: Controls the browser to simulate user actions and inspect the page.

 * Docker: Containerized environment for running jest and puppeteer on our codebase.

   Note that there are two Dockerfile files.  Splitting the image
   build in two let me cache the expensive downloading of dependencies
   while applying `--no-cache` to the loading of the test code.

 * server.js: Runs in the container to serve static files from `${NEEM_STATIC_DIR}` and proxy '/api' to `${API_TARGET}`.
