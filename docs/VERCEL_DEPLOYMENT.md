# Vercel deployment guide

Spatial Audio is a static Vite app. The repository includes `vercel.json` so the user can import the project into their Vercel account without custom dashboard overrides.

## Project settings

When connecting the repository in Vercel, use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Development command | `npm run dev` |

The committed `vercel.json` mirrors the important production settings:

- Vite framework detection.
- Deterministic dependency install with `npm ci`.
- Local development command for Vercel previews.
- Production build through `npm run build`.
- Static output from `dist`.
- SPA fallback that rewrites all app URLs to `index.html`.
- Immutable caching for built assets under `/assets/*`.
- Basic security headers for document and asset responses.

## Environment variables

No Vercel environment variables are required for the production app.

Notes:

- `NYPL_API_TOKEN` is only used by the local `npm run nypl:search` sourcing script.
- Geocoding uses public OpenStreetMap Nominatim requests from the browser.
- Bundled audio and artwork should already be present in `public/` before production deploys.

## Deployment steps

1. Open Vercel and choose **Add New Project**.
2. Import the Git repository.
3. Confirm the settings above. Vercel should read them from `vercel.json`.
4. Deploy the selected branch.
5. After production is live, update:
   - The live demo link in `README.md`.
   - The live demo URL in `docs/PORTFOLIO.md`.

## Production verification

After deployment, verify:

- The root URL loads the canvas.
- Refreshing a nested URL or query-string URL still renders the app.
- `?globe=night-lights` preserves the globe style.
- Audio unlock appears until the first user gesture.
- Play/pause works after unlocking audio.
- The globe sheet opens and can be closed on mobile.
- Location search returns a place and applies the nearest soundscape.
- Built files under `/assets/` include long-lived cache headers.
