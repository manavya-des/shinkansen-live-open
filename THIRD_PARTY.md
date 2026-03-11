# Third-Party Services and Assets

This project depends on third-party data sources, services, and media.

- `OpenStreetMap` / `Overpass API`: rail geometry and related map data.
- `OpenRailwayMap`: railway overlay tiles.
- `CartoDB`: map tiles.
- `Google Maps` tile endpoints: optional map layers in the current app implementation. Review the provider's terms before public deployment or redistribution.
- `YouTube`: embedded live camera streams configured in [`cameras/data.json`](cameras/data.json).
- `JR Cyber Station`: live service status fetched by the status API route.
- `Vercel Analytics`: client-side analytics when deployed with analytics enabled.

Notes:

- Third-party names, trademarks, stream content, and service terms remain the property of their respective owners.
- If you publish, fork, or deploy this project, you are responsible for confirming that your use of each provider, stream, tile source, and bundled asset is permitted.
- Replace or remove any provider or asset you are not comfortable redistributing under your own project.
