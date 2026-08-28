# Public Deployment Audit

## 2026-08-24 external verification

The permanent domain `https://cadaiengine-m5yd8vuw.manus.space/` returned HTTP 503 with `x-manus-original-status: 404` and the rendered message **"This site is under maintenance."** after the production static-frontend checkpoint. The same public domain returned HTTP 200 JSON from `/api/health` with `x-manus-proxy-mode: transparent/1` before the checkpoint.

The isolated local production build served the packaged Expo Web root, an SPA route (`/seats`), and `/api/health` with HTTP 200. This establishes that the production artifact contains both the frontend and backend routes; the remaining public-root response is outside the local application process and must not be represented as successful public UI access.
