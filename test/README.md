# NEEMS React Tester

End-to-end (E2E) browser automation tests using Jest and Puppeteer.

## Testing Architecture

This project uses **Jest specifically for E2E browser testing**, not unit testing:

- **E2E Tests**: Jest + Puppeteer (located in `test/jest/tests/`)
- **Unit Tests**: None currently (could use Bun's built-in test runner in the future)
- **Package Manager**: Bun (chosen for speed and modern tooling)

### Why Jest when Bun has a test framework?

While Bun includes its own excellent test runner, we keep Jest for these reasons:

1. **E2E-specific tooling**: `jest-puppeteer` provides convenient integration between Jest and Puppeteer for browser automation
2. **Visual regression testing**: `jest-image-snapshot` enables screenshot comparison tests
3. **Established pattern**: Jest + Puppeteer is a well-documented approach for E2E testing
4. **Separation of concerns**: E2E tests are in a separate `test/` directory, not mixed with source code

If we add unit tests in the future, we may use Bun's test runner for those while keeping Jest for E2E tests.

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
