# Timetable Data Format

This directory contains the Shinkansen timetable data that powers both the animated map and the timetable viewer.

## File

- **`data.json`** — The timetable dataset. Edit or replace this file to update train schedules.

After modifying `data.json`, run the build step to regenerate animation data:

```bash
npm run build:data
```

## Schema

```json
{
  "date": "2026-03-10",
  "lines": [
    {
      "lineId": "601",
      "lineName": "Tokaido and Sanyo Shinkansen",
      "directions": [
        {
          "directionId": "0",
          "directionLabel": "Downbound (towards Hakata)",
          "trains": [
            {
              "name": "Nozomi",
              "number": "1号",
              "vehicleType": "N700S",
              "caution": "",
              "serviceDay": "毎日"
            }
          ],
          "stations": [
            {
              "stationName": "東京",
              "times": ["06:00\n06:00"]
            }
          ]
        }
      ]
    }
  ]
}
```

## Field Reference

### Root

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | Schedule date in `YYYY-MM-DD` format |
| `lines` | `array` | Array of Shinkansen lines |

### Line

| Field | Type | Description |
|-------|------|-------------|
| `lineId` | `string` | Unique line identifier (e.g. `"601"`, `"101"`) |
| `lineName` | `string` | Display name of the line |
| `directions` | `array` | Two directions per line (downbound and upbound) |

### Direction

| Field | Type | Description |
|-------|------|-------------|
| `directionId` | `string` | `"0"` for downbound, `"1"` for upbound |
| `directionLabel` | `string` | Human-readable direction label |
| `trains` | `array` | All trains running in this direction |
| `stations` | `array` | All stations in route order, each with a `times` array |

### Train

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Service name (e.g. `"Nozomi"`, `"Kodama"`, `"Hayabusa"`) |
| `number` | `string` | Train number (e.g. `"1号"`, `"503号"`) |
| `vehicleType` | `string` | Rolling stock model (may be empty) |
| `caution` | `string` | Service notes or warnings (may be empty) |
| `serviceDay` | `string` | Operating days (e.g. `"毎日"` = daily, `"平日"` = weekdays) |

### Station

| Field | Type | Description |
|-------|------|-------------|
| `stationName` | `string` | Station name (Japanese) |
| `times` | `array` | One entry per train in the same direction. See **Time Format** below. |

## Time Format

Each entry in a station's `times` array corresponds to a train at the same index in the direction's `trains` array.

| Value | Meaning |
|-------|---------|
| `""` | Train does not stop at or pass through this station |
| `"06:10"` | Single time — departure (first station) or arrival (last station) |
| `"06:10\n06:15"` | Two times separated by `\n` — arrival time, then departure time |
| `"↓"` | Train passes through without stopping |

All times are in **24-hour JST** (Japan Standard Time) format `HH:MM`.

## Line IDs

| ID | Line |
|----|------|
| `601` | Tokaido Shinkansen (+ Sanyo overlap) |
| `901` | Sanyo Shinkansen + Kyushu Shinkansen |
| `101` | Tohoku Shinkansen + Hokkaido Shinkansen |
| `201` | Yamagata Shinkansen |
| `301` | Akita Shinkansen |
| `401` | Joetsu Shinkansen |
| `501` | Hokuriku Shinkansen |
| `1101` | Nishi-Kyushu Shinkansen |

## Notes

- Lines `601` (Tokaido) and `901` (Sanyo/Kyushu) share overlapping stations. The build script merges them into one combined western route and deduplicates trains that appear in both.
- Station names must be in Japanese to match the coordinate lookup in the map component.
- The build script translates Japanese station names to English for the animation output.
