# Demo deployment (DigitalOcean App Platform)

This repo continuously deploys the public **demo web front end** to its own
DigitalOcean App — no coordinator repo. GitHub Actions builds the image and
pushes it to public GHCR (`ghcr.io/newtown-energy/neems-web`); on merge to
`main`, `.github/workflows/deploy.yml` rolls the App via
`doctl apps create-deployment`. It also builds the image on PRs as a check.

Caddy serves the built SPA and reverse-proxies `/api` to the **separate core
API App** (`neems-core`), so the browser sees one origin and the `SameSite=Lax`
session cookie works. Keep both Apps on one registrable domain — same-origin or
sibling subdomains (`app.demo.x` / `api.demo.x`), never fully cross-site.

## One-time setup

1. Make the `neems-web` GHCR package **public** (GitHub → org **Packages** →
   `neems-web` → **Package settings** → Public) so App Platform can pull it with
   no credential. The package appears after the first image push (first merge to
   `main`).
2. Create the App:
   ```bash
   doctl apps create --spec .do/app.yaml
   doctl apps list        # note the App id + the *.ondigitalocean.app URL
   ```
3. Set **`NEEMS_API_UPSTREAM`** as an env var **on the App** (dashboard or
   `doctl`) — it is deliberately not committed to the spec, so it's configured
   per-deployment rather than hard-coded. Point it at the core API App's public
   URL — its `*.ondigitalocean.app` address or `api.demo.x` — **including
   `https://`**, e.g. `https://neems-demo-api-xxxx.ondigitalocean.app`. (Until
   it's set, the App serves the SPA fine but `/api` calls won't resolve.)
4. Add repo secrets: `DIGITALOCEAN_ACCESS_TOKEN` (must be **write**-capable —
   `create-deployment` is a write op) and `DIGITALOCEAN_APP_ID` (this App's id).

After this, every merge to `main` rebuilds and redeploys.

## Notes

- App Platform serves the App over HTTPS (edge TLS); Caddy runs plain HTTP
  internally (`DEMO_DOMAIN=:80`, HTTP port 80).
- Routine CD uses `doctl apps create-deployment`, which redeploys with the App's
  **stored** config — so `NEEMS_API_UPSTREAM` set on the App persists and is not
  overwritten by CI.
- `instance_size_slug` is a starting guess; confirm with
  `doctl apps tier instance-size list`.
- To change the spec, edit `.do/app.yaml` and
  `doctl apps update <id> --spec .do/app.yaml` (re-set `NEEMS_API_UPSTREAM`
  after, since the committed value is a placeholder).
