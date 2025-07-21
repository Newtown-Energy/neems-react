# NEEMS React Tester

Jest tests to exercise our frontend as it hits our upstream NEEMS API
server.

# Running

`dosh test` should do the right thing.  The jest tests will connect to
localhost:5173, which should already be active (do `bun run dev` or
`npm run dev`).

The dev server will proxy to the API server for all /api routes.  See
`../vite.config.js`, which has a proxy section that you can edit or
use the environment.  Set NEEMS_CORE_SERVER to the url and port of
whatever server you like.  It defaults to `localhost:8000` on the
assumption that you're running a local dev version of the NEEMS Core.
But maybe you're only developing on the front end.  If that's the
case, point it at our staging server and use the
`superadmin@example.com` and `admin` credentials.

# Components

 * `dosh`: Task runner that runs the jest process

 * Jest: Runs the tests and provides assertions (expect).

 * Puppeteer: Controls the browser to simulate user actions and inspect the page.
