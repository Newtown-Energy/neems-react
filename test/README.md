# NEEMS React Tester

Docker container to test our frontend as it hits our upstream NEEMS
API server.

# Running

`dosh test` should build the docker images and run the tests.
There is a script called `jest/scripts/run-tests.sh` that runs in the
docker container.  Do not run it directly from the command line.  The
Dockerfile handles that for you.

`dosh test-local` should run the tests directly on your host system, no
docker involved.  It does this with `npx jest`.

But! See details below.

## Rebuilding Static Files

The docker looks for static files in two places.  Either in the dist
dir or from a server.

If you are making local changes and building them into dist, you will
want to rebuild so those changes get reflected in `dist`.  That is
where `dosh test` will look for static files.  `dosh watch` will
rebuild to dist for you as things change.

If you are running `npm run dev`, which I think is faster than `dosh
watch`, your `dist` dir doesn't get rebuilt.  Instead, your react
files get served by vite on port 5173.  Set `NGINX_STATIC_URL` as in
`env.example` to enable this.

## Docker vs Hosted System

There are tests in `jest/tests`.  You can run them with `dosh
test` or `dosh test-local`.  These are not the same!  They differ in
how they access static files.

When testing via docker, scripts will copy the `dist` directory into
the container or hit a react server.  The `docker-compose.yml` setup
includes an nginx server that will serve those static files.  You can
point it at any API server you like by setting the `NEEMS_CORE_SERVER`
envar.

When testing via `dosh test-local`, you are just hitting the API
server specified in `NEEMS_CORE_SERVER`.  That API server will also
serve whatever static files it is configured to serve.  If the API
server is on a remote box (e.g. running as part of CI/CD on some
server somewhere), it will not reflect your local changes.

In short, use `dosh test-local` if you're running a local API server that
points at `dist` for static files.  Otherwise, use `dosh test`,
which can use a remote API server while still serving your local
static `dist` or pulling files from a react server.

# Environment

Environment variables are documented in `env.example`.  You should
probably `cp env.example .env`.  The default values there should just
work, especially if you've properly set `NEEMS_API_SERVER` in the
`.env` of the root dir of the project.

The `.env` gets loaded by `dosh`, so you don't have to do anything
special to source it or anything.  this with `direnv` and a `.envrc`
file.

# Components

 * `dosh`: Task runner that sets up docker, runs the jest process

 * Jest: Runs the tests and provides assertions (expect).

 * Puppeteer: Controls the browser to simulate user actions and inspect the page.

 * Docker: Containerized environment for running jest and puppeteer on our codebase.

   Note that there are two Jest Dockerfile files.  Splitting the image
   build in two let me cache the expensive downloading of dependencies
   while applying `--no-cache` to the loading of the test code.

 * nginx: A container to serve static files from local disk or `npm
   run dev` while also proxying '/api' to`${NEEMS_CORE_SERVER}`.
