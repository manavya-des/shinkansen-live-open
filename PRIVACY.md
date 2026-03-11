# Privacy Note

This project does not include user accounts or a first-party database.

When the app is running, it may contact third-party services directly or indirectly:

- `Vercel Analytics` collects usage analytics when enabled in the deployment.
- Map tile providers receive standard requests from the browser for tiles.
- `YouTube` is used for embedded live camera streams.
- The server-side status endpoint requests live status data from `JR Cyber Station`.

If you self-host or redeploy this project, review these integrations and publish your own privacy notice if required by your jurisdiction or hosting setup.
