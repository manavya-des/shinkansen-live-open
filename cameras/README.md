# Live Cameras

This directory contains the live camera feed configuration. Each camera appears as a marker on the map and can be selected to view an embedded YouTube live stream.

## File

- **`data.json`** — Array of camera objects. Add, remove, or edit entries to update the map.

After editing, run `npm run build:data` to copy the file into `src/data/` where Next.js imports it.

## Schema

```json
[
  {
    "id": "tokyo-station-01",
    "title": "Tokyo Station Live Camera",
    "coordinate": [35.677571, 139.766487],
    "heading": 240,
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }
]
```

## Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the camera |
| `title` | `string` | Display name shown in the camera selector and panel |
| `coordinate` | `[number, number]` | `[latitude, longitude]` for the map marker position |
| `heading` | `number` | Camera viewing direction in degrees (0 = north, 90 = east, 180 = south, 270 = west). Controls the orientation of the camera icon on the map. |
| `url` | `string` | YouTube video URL. Must be a standard `youtube.com/watch?v=` link. The app extracts the video ID and embeds it as an iframe. |

## Adding a Camera

1. Find a YouTube live stream of a Shinkansen station or trackside view
2. Add an entry to `data.json` with the fields above
3. Set the `coordinate` to the camera's real-world location
4. Set `heading` to the approximate direction the camera faces
5. Restart the dev server to pick up the change

## Notes

- Only YouTube URLs are supported (the embed logic extracts the `v=` parameter)
- Cameras appear as small directional icons on the map at all zoom levels
- Clicking a camera marker or selecting from the dropdown opens the embedded stream
- Live cameras are only available in Live mode, not Playback mode
