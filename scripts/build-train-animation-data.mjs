/**
 * build-train-animation-data.mjs
 *
 * Reads timetable data from timetable/data.json and produces animation-ready
 * JSON consumed by the map component. Also copies the timetable into src/data/
 * so the timetable page can import it.
 *
 * Usage:  npm run build:data
 *
 * Input:  timetable/data.json          — flat timetable (see timetable/README.md)
 * Output: src/data/shinkansen-train-animations.json — animation routes
 *         src/data/shinkansen-timetables.json        — copy of timetable for Next.js
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const TIMETABLE_PATH = path.join(ROOT, "timetable/data.json");
const MAP_CLIENT_PATH = path.join(ROOT, "src/components/map-client.tsx");
const TIMETABLE_PAGE_PATH = path.join(ROOT, "src/app/timetable/page.tsx");
const OUTPUT_PATH = path.join(ROOT, "src/data/shinkansen-train-animations.json");
const TIMETABLE_COPY_PATH = path.join(ROOT, "src/data/shinkansen-timetables.json");
const CAMERAS_PATH = path.join(ROOT, "cameras/data.json");
const CAMERAS_COPY_PATH = path.join(ROOT, "src/data/live-cameras.json");

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------

const timetableData = JSON.parse(fs.readFileSync(TIMETABLE_PATH, "utf8"));

// LINE_STATIONS and STATION_TRANSLATIONS are defined inside TypeScript source
// files. We extract them at build time using regex + vm.runInNewContext rather
// than duplicating the data. See extractObjectLiteral() at the bottom.
const lineStations = extractObjectLiteral(MAP_CLIENT_PATH, "LINE_STATIONS");
const stationTranslations = extractObjectLiteral(TIMETABLE_PAGE_PATH, "STATION_TRANSLATIONS");

// ---------------------------------------------------------------------------
// Route station definitions
//
// Mini-shinkansen lines (Yamagata, Akita) and branch lines (Joetsu, Hokuriku,
// Gala-Yuzawa) share track with the Tohoku Shinkansen between Tokyo and their
// divergence point. Each station is tagged with the map lineId it belongs to,
// so trains visually change color when crossing line boundaries.
// ---------------------------------------------------------------------------

const JOETSU_ROUTE_STATIONS_DOWN = [
  { name: "Tokyo", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Kumagaya", lineId: "joetsu" },
  { name: "Honjo-Waseda", lineId: "joetsu" },
  { name: "Takasaki", lineId: "joetsu" },
  { name: "Jomo-Kogen", lineId: "joetsu" },
  { name: "Echigo-Yuzawa", lineId: "joetsu" },
  { name: "Urasa", lineId: "joetsu" },
  { name: "Nagaoka", lineId: "joetsu" },
  { name: "Tsubame-Sanjo", lineId: "joetsu" },
  { name: "Niigata", lineId: "joetsu" },
];

const JOETSU_ROUTE_STATIONS_UP = [
  { name: "Niigata", lineId: "joetsu" },
  { name: "Tsubame-Sanjo", lineId: "joetsu" },
  { name: "Nagaoka", lineId: "joetsu" },
  { name: "Urasa", lineId: "joetsu" },
  { name: "Echigo-Yuzawa", lineId: "joetsu" },
  { name: "Jomo-Kogen", lineId: "joetsu" },
  { name: "Takasaki", lineId: "joetsu" },
  { name: "Honjo-Waseda", lineId: "joetsu" },
  { name: "Kumagaya", lineId: "joetsu" },
  { name: "Omiya", lineId: "joetsu" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Tokyo", lineId: "tohoku" },
];

const GALA_YUZAWA_ROUTE_STATIONS_DOWN = [
  { name: "Tokyo", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Kumagaya", lineId: "joetsu" },
  { name: "Honjo-Waseda", lineId: "joetsu" },
  { name: "Takasaki", lineId: "joetsu" },
  { name: "Jomo-Kogen", lineId: "joetsu" },
  { name: "Echigo-Yuzawa", lineId: "joetsu" },
  { name: "Gala-Yuzawa", lineId: "gala-yuzawa" },
];

const GALA_YUZAWA_ROUTE_STATIONS_UP = [
  { name: "Gala-Yuzawa", lineId: "gala-yuzawa" },
  { name: "Echigo-Yuzawa", lineId: "gala-yuzawa" },
  { name: "Jomo-Kogen", lineId: "joetsu" },
  { name: "Takasaki", lineId: "joetsu" },
  { name: "Honjo-Waseda", lineId: "joetsu" },
  { name: "Kumagaya", lineId: "joetsu" },
  { name: "Omiya", lineId: "joetsu" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Tokyo", lineId: "tohoku" },
];

const HOKURIKU_ROUTE_STATIONS_DOWN = [
  { name: "Tokyo", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Takasaki", lineId: "joetsu" },
  { name: "Annaka-Haruna", lineId: "hokuriku" },
  { name: "Karuizawa", lineId: "hokuriku" },
  { name: "Sakudaira", lineId: "hokuriku" },
  { name: "Ueda", lineId: "hokuriku" },
  { name: "Nagano", lineId: "hokuriku" },
  { name: "Iiyama", lineId: "hokuriku" },
  { name: "Joetsumyoko", lineId: "hokuriku" },
  { name: "Itoigawa", lineId: "hokuriku" },
  { name: "Kurobe-Unazukionsen", lineId: "hokuriku" },
  { name: "Toyama", lineId: "hokuriku" },
  { name: "Shin-Takaoka", lineId: "hokuriku" },
  { name: "Kanazawa", lineId: "hokuriku" },
  { name: "Komatsu", lineId: "hokuriku" },
  { name: "Kagaonsen", lineId: "hokuriku" },
  { name: "Awaraonsen", lineId: "hokuriku" },
  { name: "Fukui", lineId: "hokuriku" },
  { name: "Echizen-Takefu", lineId: "hokuriku" },
  { name: "Tsuruga", lineId: "hokuriku" },
];

const HOKURIKU_ROUTE_STATIONS_UP = [
  { name: "Tsuruga", lineId: "hokuriku" },
  { name: "Echizen-Takefu", lineId: "hokuriku" },
  { name: "Fukui", lineId: "hokuriku" },
  { name: "Awaraonsen", lineId: "hokuriku" },
  { name: "Kagaonsen", lineId: "hokuriku" },
  { name: "Komatsu", lineId: "hokuriku" },
  { name: "Kanazawa", lineId: "hokuriku" },
  { name: "Shin-Takaoka", lineId: "hokuriku" },
  { name: "Toyama", lineId: "hokuriku" },
  { name: "Kurobe-Unazukionsen", lineId: "hokuriku" },
  { name: "Itoigawa", lineId: "hokuriku" },
  { name: "Joetsumyoko", lineId: "hokuriku" },
  { name: "Iiyama", lineId: "hokuriku" },
  { name: "Nagano", lineId: "hokuriku" },
  { name: "Ueda", lineId: "hokuriku" },
  { name: "Sakudaira", lineId: "hokuriku" },
  { name: "Karuizawa", lineId: "hokuriku" },
  { name: "Annaka-Haruna", lineId: "hokuriku" },
  { name: "Takasaki", lineId: "hokuriku" },
  { name: "Omiya", lineId: "joetsu" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Tokyo", lineId: "tohoku" },
];

const AKITA_ROUTE_STATIONS_DOWN = [
  { name: "Tokyo", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Oyama", lineId: "tohoku" },
  { name: "Utsunomiya", lineId: "tohoku" },
  { name: "Nasu-Shiobara", lineId: "tohoku" },
  { name: "Shin-Shirakawa", lineId: "tohoku" },
  { name: "Koriyama", lineId: "tohoku" },
  { name: "Fukushima", lineId: "tohoku" },
  { name: "Shiroishi-Zao", lineId: "tohoku" },
  { name: "Sendai", lineId: "tohoku" },
  { name: "Furukawa", lineId: "tohoku" },
  { name: "Kurikoma-Kogen", lineId: "tohoku" },
  { name: "Ichinoseki", lineId: "tohoku" },
  { name: "Mizusawa-Esashi", lineId: "tohoku" },
  { name: "Kitakami", lineId: "tohoku" },
  { name: "Shin-Hanamaki", lineId: "tohoku" },
  { name: "Morioka", lineId: "tohoku" },
  { name: "Shizukuishi", lineId: "akita" },
  { name: "Tazawako", lineId: "akita" },
  { name: "Kakunodate", lineId: "akita" },
  { name: "Omagari", lineId: "akita" },
  { name: "Akita", lineId: "akita" },
];

const AKITA_ROUTE_STATIONS_UP = [
  { name: "Akita", lineId: "akita" },
  { name: "Omagari", lineId: "akita" },
  { name: "Kakunodate", lineId: "akita" },
  { name: "Tazawako", lineId: "akita" },
  { name: "Shizukuishi", lineId: "akita" },
  { name: "Morioka", lineId: "akita" },
  { name: "Shin-Hanamaki", lineId: "tohoku" },
  { name: "Kitakami", lineId: "tohoku" },
  { name: "Mizusawa-Esashi", lineId: "tohoku" },
  { name: "Ichinoseki", lineId: "tohoku" },
  { name: "Kurikoma-Kogen", lineId: "tohoku" },
  { name: "Furukawa", lineId: "tohoku" },
  { name: "Sendai", lineId: "tohoku" },
  { name: "Shiroishi-Zao", lineId: "tohoku" },
  { name: "Fukushima", lineId: "tohoku" },
  { name: "Koriyama", lineId: "tohoku" },
  { name: "Shin-Shirakawa", lineId: "tohoku" },
  { name: "Nasu-Shiobara", lineId: "tohoku" },
  { name: "Utsunomiya", lineId: "tohoku" },
  { name: "Oyama", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Tokyo", lineId: "tohoku" },
];

const YAMAGATA_ROUTE_STATIONS_DOWN = [
  { name: "Tokyo", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Oyama", lineId: "tohoku" },
  { name: "Utsunomiya", lineId: "tohoku" },
  { name: "Nasu-Shiobara", lineId: "tohoku" },
  { name: "Shin-Shirakawa", lineId: "tohoku" },
  { name: "Koriyama", lineId: "tohoku" },
  { name: "Fukushima", lineId: "tohoku" },
  { name: "Yonezawa", lineId: "yamagata" },
  { name: "Takahata", lineId: "yamagata" },
  { name: "Akayu", lineId: "yamagata" },
  { name: "Kaminoyama-Onsen", lineId: "yamagata" },
  { name: "Yamagata", lineId: "yamagata" },
  { name: "Tendo", lineId: "yamagata" },
  { name: "Sakurambo-Higashine", lineId: "yamagata" },
  { name: "Murayama", lineId: "yamagata" },
  { name: "Oishida", lineId: "yamagata" },
  { name: "Shinjo", lineId: "yamagata" },
];

const YAMAGATA_ROUTE_STATIONS_UP = [
  { name: "Shinjo", lineId: "yamagata" },
  { name: "Oishida", lineId: "yamagata" },
  { name: "Murayama", lineId: "yamagata" },
  { name: "Sakurambo-Higashine", lineId: "yamagata" },
  { name: "Tendo", lineId: "yamagata" },
  { name: "Yamagata", lineId: "yamagata" },
  { name: "Kaminoyama-Onsen", lineId: "yamagata" },
  { name: "Akayu", lineId: "yamagata" },
  { name: "Takahata", lineId: "yamagata" },
  { name: "Yonezawa", lineId: "yamagata" },
  { name: "Fukushima", lineId: "yamagata" },
  { name: "Koriyama", lineId: "tohoku" },
  { name: "Shin-Shirakawa", lineId: "tohoku" },
  { name: "Nasu-Shiobara", lineId: "tohoku" },
  { name: "Utsunomiya", lineId: "tohoku" },
  { name: "Oyama", lineId: "tohoku" },
  { name: "Omiya", lineId: "tohoku" },
  { name: "Ueno", lineId: "tohoku" },
  { name: "Tokyo", lineId: "tohoku" },
];

// ---------------------------------------------------------------------------
// Route configurations
//
// Each entry produces one animation route in the output. A route combines one
// or more map line IDs, a direction, and a source for timetable data.
//
// "western-combined" merges Tokaido (601) + Sanyo/Kyushu (901) because many
// trains (Nozomi, Hikari, Mizuho, Sakura) run across both lines.
// ---------------------------------------------------------------------------

const ROUTE_CONFIGS = [
  {
    routeId: "western",
    lineName: "Tokaido, Sanyo and Kyushu Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Kagoshima-Chuo)",
    mapLineIds: ["tokaido", "sanyo", "kyushu"],
    source: { type: "western-combined", directionId: "0" },
  },
  {
    routeId: "western",
    lineName: "Tokaido, Sanyo and Kyushu Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tokaido", "sanyo", "kyushu"],
    source: { type: "western-combined", directionId: "1" },
  },
  {
    routeId: "tohoku-hokkaido",
    lineName: "Tohoku and Hokkaido Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Shin-Hakodate-Hokuto)",
    mapLineIds: ["tohoku", "hokkaido"],
    source: { type: "line", lineId: "101", directionId: "0" },
  },
  {
    routeId: "tohoku-hokkaido",
    lineName: "Tohoku and Hokkaido Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "hokkaido"],
    source: { type: "line", lineId: "101", directionId: "1" },
  },
  {
    routeId: "yamagata",
    lineName: "Yamagata Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Shinjo)",
    mapLineIds: ["tohoku", "yamagata"],
    stations: YAMAGATA_ROUTE_STATIONS_DOWN,
    source: { type: "line", lineId: "201", directionId: "0" },
  },
  {
    routeId: "yamagata",
    lineName: "Yamagata Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "yamagata"],
    stations: YAMAGATA_ROUTE_STATIONS_UP,
    source: { type: "line", lineId: "201", directionId: "1" },
  },
  {
    routeId: "akita",
    lineName: "Akita Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Akita)",
    mapLineIds: ["tohoku", "akita"],
    stations: AKITA_ROUTE_STATIONS_DOWN,
    source: { type: "line", lineId: "301", directionId: "0" },
  },
  {
    routeId: "akita",
    lineName: "Akita Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "akita"],
    stations: AKITA_ROUTE_STATIONS_UP,
    source: { type: "line", lineId: "301", directionId: "1" },
  },
  {
    routeId: "joetsu",
    lineName: "Joetsu Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Niigata)",
    mapLineIds: ["tohoku", "joetsu"],
    stations: JOETSU_ROUTE_STATIONS_DOWN,
    source: { type: "line", lineId: "401", directionId: "0" },
    filter: { mode: "exclude", stationName: "Gala-Yuzawa" },
  },
  {
    routeId: "joetsu",
    lineName: "Joetsu Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "joetsu"],
    stations: JOETSU_ROUTE_STATIONS_UP,
    source: { type: "line", lineId: "401", directionId: "1" },
    filter: { mode: "exclude", stationName: "Gala-Yuzawa" },
  },
  {
    routeId: "gala-yuzawa",
    lineName: "Gala-Yuzawa Branch",
    directionId: "0",
    directionLabel: "Downbound (towards Gala-Yuzawa)",
    mapLineIds: ["tohoku", "joetsu", "gala-yuzawa"],
    stations: GALA_YUZAWA_ROUTE_STATIONS_DOWN,
    source: { type: "line", lineId: "401", directionId: "0" },
    filter: { mode: "include", stationName: "Gala-Yuzawa" },
  },
  {
    routeId: "gala-yuzawa",
    lineName: "Gala-Yuzawa Branch",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "joetsu", "gala-yuzawa"],
    stations: GALA_YUZAWA_ROUTE_STATIONS_UP,
    source: { type: "line", lineId: "401", directionId: "1" },
    filter: { mode: "include", stationName: "Gala-Yuzawa" },
  },
  {
    routeId: "hokuriku",
    lineName: "Hokuriku Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Tsuruga)",
    mapLineIds: ["tohoku", "joetsu", "hokuriku"],
    stations: HOKURIKU_ROUTE_STATIONS_DOWN,
    source: { type: "line", lineId: "501", directionId: "0" },
  },
  {
    routeId: "hokuriku",
    lineName: "Hokuriku Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Tokyo)",
    mapLineIds: ["tohoku", "joetsu", "hokuriku"],
    stations: HOKURIKU_ROUTE_STATIONS_UP,
    source: { type: "line", lineId: "501", directionId: "1" },
  },
  {
    routeId: "nishi-kyushu",
    lineName: "Nishi-Kyushu Shinkansen",
    directionId: "0",
    directionLabel: "Downbound (towards Nagasaki)",
    mapLineIds: ["nishi-kyushu"],
    source: { type: "line", lineId: "1101", directionId: "0" },
  },
  {
    routeId: "nishi-kyushu",
    lineName: "Nishi-Kyushu Shinkansen",
    directionId: "1",
    directionLabel: "Upbound (towards Takeo-Onsen)",
    mapLineIds: ["nishi-kyushu"],
    source: { type: "line", lineId: "1101", directionId: "1" },
  },
];

// ---------------------------------------------------------------------------
// Build animation output and write files
// ---------------------------------------------------------------------------

const output = {
  generatedAt: new Date().toISOString(),
  scheduleDate: timetableData.date,
  timezone: "Asia/Tokyo",
  routes: ROUTE_CONFIGS.map((config) => buildRouteAnimation(config)),
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

// Copy timetable and cameras into src/data/ so Next.js can import them at build time
fs.copyFileSync(TIMETABLE_PATH, TIMETABLE_COPY_PATH);
if (fs.existsSync(CAMERAS_PATH)) {
  fs.copyFileSync(CAMERAS_PATH, CAMERAS_COPY_PATH);
}

console.log(
  JSON.stringify(
    {
      output: path.relative(ROOT, OUTPUT_PATH),
      routes: output.routes.length,
      trains: output.routes.reduce((count, route) => count + route.trains.length, 0),
    },
    null,
    2
  )
);

function buildRouteAnimation(config) {
  const mergedDirection = getMergedDirection(config.source);
  const routeShape = buildRouteShape(config);
  const stationTimeMap = new Map(
    mergedDirection.stations.map((station) => [translateStationName(station.stationName), station.times])
  );

  const trains = [];

  for (let trainIndex = 0; trainIndex < mergedDirection.trains.length; trainIndex += 1) {
    const train = mergedDirection.trains[trainIndex];
    const stationCells = routeShape.stations.map((station) => ({
      station,
      value: stationTimeMap.get(station.name)?.[trainIndex] ?? "",
    }));

    if (!matchesRouteFilter(stationTimeMap, trainIndex, config.filter)) {
      continue;
    }

    const points = buildTrainPoints(routeShape.stations, stationCells);

    if (points.length === 0) {
      continue;
    }

    const startMinute = points[0].departureMinute ?? points[0].arrivalMinute ?? points[0].passMinute;
    const endMinute =
      points.at(-1)?.arrivalMinute ?? points.at(-1)?.departureMinute ?? points.at(-1)?.passMinute;

    if (typeof startMinute !== "number" || typeof endMinute !== "number") {
      continue;
    }

    trains.push({
      id: formatTrainIdentifier(train),
      name: normalizeTrainServiceName(train.name, train.number),
      number: normalizeTrainNumber(train.number),
      startMinute,
      endMinute,
      points,
    });
  }

  return {
    routeId: config.routeId,
    lineName: config.lineName,
    directionId: config.directionId,
    directionLabel: config.directionLabel,
    mapLineIds: config.mapLineIds,
    stations: routeShape.stations,
    segmentLineIds: routeShape.segmentLineIds,
    trains,
  };
}

function getMergedDirection(source) {
  if (source.type === "western-combined") {
    return buildCombinedWesternDirection(source.directionId);
  }

  const line = timetableData.lines.find((item) => item.lineId === source.lineId);
  const direction = line?.directions.find((item) => item.directionId === source.directionId);

  if (!line || !direction) {
    throw new Error(`Missing timetable source ${JSON.stringify(source)}`);
  }

  // Flat format: trains[] and stations[] live directly on the direction
  const flatDirection = {
    trains: direction.trains.map((train) => ({
      ...train,
      name: normalizeTrainServiceName(train.name, train.number),
    })),
    stations: direction.stations,
  };

  return postProcessDirection({
    lineId: line.lineId,
    directionId: direction.directionId,
    mergedDirection: flatDirection,
  });
}

// Tokaido (601) and Sanyo/Kyushu (901) are merged into one combined western
// route because many trains (Nozomi, Hikari, Mizuho, Sakura) run across both.
// Duplicate trains appearing in both datasets are deduped by identifier.
function buildCombinedWesternDirection(directionId) {
  const tokaidoSanyo = timetableData.lines.find((line) => line.lineId === "601");
  const sanyoKyushu = timetableData.lines.find((line) => line.lineId === "901");

  if (!tokaidoSanyo || !sanyoKyushu) {
    throw new Error("Missing western timetable sources");
  }

  const normalize = (dir) => ({
    trains: dir.trains.map((t) => ({ ...t, name: normalizeTrainServiceName(t.name, t.number) })),
    stations: dir.stations,
  });

  if (directionId === "0") {
    return dedupeMergedDirectionByIdentifier(
      mergeMergedDirections([
        normalize(tokaidoSanyo.directions.find((d) => d.directionId === "0")),
        normalize(sanyoKyushu.directions.find((d) => d.directionId === "0")),
      ])
    );
  }

  return dedupeMergedDirectionByIdentifier(
    mergeMergedDirections([
      normalize(sanyoKyushu.directions.find((d) => d.directionId === "1")),
      normalize(tokaidoSanyo.directions.find((d) => d.directionId === "1")),
    ])
  );
}

function buildRouteShape(config) {
  if (config.stations) {
    return {
      stations: config.stations.map((station) => ({
        ...station,
        coordinate: findStationCoordinate(station.lineId, station.name),
      })),
      segmentLineIds: config.stations.slice(1).map((station) => station.lineId),
    };
  }

  const { mapLineIds, directionId } = config;
  const stations = [];
  const segmentLineIds = [];

  for (const lineId of mapLineIds) {
    for (const station of lineStations[lineId] ?? []) {
      const previous = stations.at(-1);

      if (!previous) {
        stations.push({
          name: station.name,
          lineId,
          coordinate: station.coordinate,
        });
        continue;
      }

      if (previous.name === station.name) {
        continue;
      }

      segmentLineIds.push(lineId);
      stations.push({
        name: station.name,
        lineId,
        coordinate: station.coordinate,
      });
    }
  }

  if (directionId === "1") {
    stations.reverse();
    segmentLineIds.reverse();
  }

  return {
    stations,
    segmentLineIds,
  };
}

function findStationCoordinate(lineId, stationName) {
  const station = (lineStations[lineId] ?? []).find((item) => item.name === stationName);

  if (!station) {
    throw new Error(`Missing coordinate for ${lineId}:${stationName}`);
  }

  return station.coordinate;
}

function matchesRouteFilter(stationTimeMap, trainIndex, filter) {
  if (!filter) {
    return true;
  }

  const stationValue = stationTimeMap.get(filter.stationName)?.[trainIndex] ?? "";
  const parsedStationCell = parseStationCell(stationValue);
  const hasTimedStation =
    parsedStationCell.kind === "stop" || parsedStationCell.kind === "timed";

  if (filter.mode === "include") {
    return hasTimedStation;
  }

  return !hasTimedStation;
}

function buildTrainPoints(routeStations, stationCells) {
  const routeDistances = buildRouteStationDistances(routeStations);
  const rawPoints = stationCells.map(({ station, value }, routeIndex) => ({
    routeIndex,
    stationName: station.name,
    lineId: station.lineId,
    ...parseStationCell(value),
  }));

  for (let index = 0; index < rawPoints.length; index += 1) {
    if (rawPoints[index].kind !== "pass") {
      continue;
    }

    const previous = findPreviousTimedPoint(rawPoints, index);
    const next = findNextTimedPoint(rawPoints, index);

    if (!previous || !next) {
      continue;
    }

    const previousMinute = previous.departureMinute ?? previous.arrivalMinute;
    const nextMinute = next.arrivalMinute ?? next.departureMinute;

    if (typeof previousMinute !== "number" || typeof nextMinute !== "number") {
      continue;
    }

    const previousDistance = routeDistances[previous.routeIndex];
    const nextDistance = routeDistances[next.routeIndex];
    const currentDistance = routeDistances[index];
    const denominator = nextDistance - previousDistance;

    if (denominator <= 0) {
      rawPoints[index].passMinute = previousMinute;
      continue;
    }

    const ratio = (currentDistance - previousDistance) / denominator;
    rawPoints[index].passMinute = previousMinute + (nextMinute - previousMinute) * ratio;
  }

  return rawPoints
    .filter((point) => point.kind !== "blank")
    .filter(
      (point) =>
        typeof point.arrivalMinute === "number" ||
        typeof point.departureMinute === "number" ||
        typeof point.passMinute === "number"
    );
}

function findPreviousTimedPoint(points, fromIndex) {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (
      typeof points[index].departureMinute === "number" ||
      typeof points[index].arrivalMinute === "number"
    ) {
      return points[index];
    }
  }

  return null;
}

function findNextTimedPoint(points, fromIndex) {
  for (let index = fromIndex + 1; index < points.length; index += 1) {
    if (
      typeof points[index].arrivalMinute === "number" ||
      typeof points[index].departureMinute === "number"
    ) {
      return points[index];
    }
  }

  return null;
}

function buildRouteStationDistances(routeStations) {
  const distances = [0];

  for (let index = 1; index < routeStations.length; index += 1) {
    distances.push(
      distances[index - 1] + haversineDistance(routeStations[index - 1].coordinate, routeStations[index].coordinate)
    );
  }

  return distances;
}

function parseStationCell(value) {
  if (!value) {
    return { kind: "blank" };
  }

  if (value === "↓") {
    return { kind: "pass", passMinute: null };
  }

  const values = value
    .split("\n")
    .map((item) => parseTimeToMinute(item))
    .filter((item) => Number.isFinite(item));

  if (values.length === 2) {
    return {
      kind: "stop",
      arrivalMinute: values[0],
      departureMinute: values[1],
    };
  }

  if (values.length === 1) {
    return {
      kind: "timed",
      arrivalMinute: values[0],
      departureMinute: values[0],
    };
  }

  return { kind: "blank" };
}

function parseTimeToMinute(value) {
  const match = String(value).trim().match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function postProcessDirection({ lineId, directionId, mergedDirection }) {
  if (lineId === "101" && directionId === "1") {
    return removeTrainByIdentifier(mergedDirection, "Komachi-32");
  }

  return mergedDirection;
}

function mergeMergedDirections(directions) {
  const stationOrder = [];
  const seenStations = new Set();

  for (const direction of directions) {
    for (const station of direction.stations) {
      if (!seenStations.has(station.stationName)) {
        seenStations.add(station.stationName);
        stationOrder.push(station.stationName);
      }
    }
  }

  const mergedTrains = directions.flatMap((direction) => direction.trains);
  const stationRows = stationOrder.map((stationName) => ({
    stationName,
    times: mergedTrains.map(() => ""),
  }));
  const stationIndex = new Map(stationRows.map((station, index) => [station.stationName, index]));

  let trainOffset = 0;

  for (const direction of directions) {
    for (const station of direction.stations) {
      const targetIndex = stationIndex.get(station.stationName);
      if (targetIndex === undefined) {
        continue;
      }

      for (let index = 0; index < station.times.length; index += 1) {
        stationRows[targetIndex].times[trainOffset + index] = station.times[index];
      }
    }

    trainOffset += direction.trains.length;
  }

  const sortableTrains = mergedTrains.map((train, index) => ({
    train,
    index,
    sortKey: firstTimeValue(stationRows.map((station) => station.times[index])),
  }));

  sortableTrains.sort((left, right) => {
    if (left.sortKey === right.sortKey) {
      return left.index - right.index;
    }

    return left.sortKey.localeCompare(right.sortKey);
  });

  const sortedIndexes = sortableTrains.map((item) => item.index);

  return {
    trains: sortableTrains.map((item) => item.train),
    stations: stationRows.map((station) => ({
      stationName: station.stationName,
      times: sortedIndexes.map((index) => station.times[index]),
    })),
  };
}

function firstTimeValue(values) {
  for (const value of values) {
    if (/^\d{2}:\d{2}/.test(value)) {
      return value;
    }
  }

  return "99:99";
}

function dedupeMergedDirectionByIdentifier(mergedDirection) {
  const groupedIndexes = new Map();

  mergedDirection.trains.forEach((train, index) => {
    const identifier = trainIdentifierKey(train);
    const key = identifier === "-" ? `__blank__${index}` : identifier;

    if (!groupedIndexes.has(key)) {
      groupedIndexes.set(key, []);
    }

    groupedIndexes.get(key).push(index);
  });

  const dedupedColumns = [...groupedIndexes.values()]
    .map((indexes) => buildMergedTrainColumn(mergedDirection, indexes))
    .sort((left, right) => left.firstIndex - right.firstIndex);

  return {
    trains: dedupedColumns.map((column) => column.train),
    stations: mergedDirection.stations.map((station, stationIndex) => ({
      stationName: station.stationName,
      times: dedupedColumns.map((column) => column.stationTimes[stationIndex]),
    })),
  };
}

function buildMergedTrainColumn(mergedDirection, indexes) {
  const rankedIndexes = [...indexes].sort((left, right) => {
    const scoreDifference =
      trainColumnScore(mergedDirection, right) - trainColumnScore(mergedDirection, left);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left - right;
  });

  return {
    firstIndex: indexes[0],
    train: rankedIndexes.reduce(
      (mergedTrain, index) => mergeTrainMetadata(mergedTrain, mergedDirection.trains[index]),
      createEmptyTrain()
    ),
    stationTimes: mergedDirection.stations.map((station) =>
      pickRicherValue(rankedIndexes.map((index) => station.times[index] ?? ""))
    ),
  };
}

function trainColumnScore(mergedDirection, index) {
  const train = mergedDirection.trains[index];
  const metadataScore = [
    train.name,
    normalizeTrainNumber(train.number),
    train.vehicleType,
    train.caution,
    train.serviceDay,
  ].filter(Boolean).length;
  const stationScore = mergedDirection.stations.reduce(
    (count, station) => count + (station.times[index] ? 1 : 0),
    0
  );

  return metadataScore + stationScore * 10;
}

function mergeTrainMetadata(current, candidate) {
  return {
    name: current.name || candidate.name,
    number: current.number || candidate.number,
    vehicleType: current.vehicleType || candidate.vehicleType,
    caution: current.caution || candidate.caution,
    serviceDay: current.serviceDay || candidate.serviceDay,
  };
}

function createEmptyTrain() {
  return {
    name: "",
    number: "",
    vehicleType: "",
    caution: "",
    serviceDay: "",
  };
}

function pickRicherValue(values) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return "";
}

function removeTrainByIdentifier(mergedDirection, identifierToRemove) {
  const keepIndexes = mergedDirection.trains
    .map((train, index) => ({ train, index }))
    .filter(({ train }) => trainIdentifierKey(train) !== identifierToRemove)
    .map(({ index }) => index);

  return pickTrainIndexes(mergedDirection, keepIndexes);
}

function pickTrainIndexes(mergedDirection, indexes) {
  return {
    trains: indexes.map((index) => mergedDirection.trains[index]),
    stations: mergedDirection.stations.map((station) => ({
      stationName: station.stationName,
      times: indexes.map((index) => station.times[index] ?? ""),
    })),
  };
}

function formatTrainIdentifier(train) {
  const name = String(normalizeTrainServiceName(train.name, train.number) || "").trim();
  const number = normalizeTrainNumber(train.number).trim();
  return number ? `${name}-${number}` : name;
}

function trainIdentifierKey(train) {
  const name = String(normalizeTrainServiceName(train.name, train.number) || "").trim();
  const number = normalizeTrainNumber(train.number).trim();

  if (!name && !number) {
    return "-";
  }

  return `${name}-${number}`;
}

function normalizeTrainNumber(value) {
  return String(value || "").replace(/号$/u, "");
}

function normalizeTrainServiceName(name, number) {
  const normalizedNumber = normalizeTrainNumber(number).trim();

  if (name === "Hikari" && normalizedNumber === "590") {
    return "Hikari Rail Star";
  }

  return name;
}

function translateStationName(value) {
  return stationTranslations[value] ?? value;
}

function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function extractObjectLiteral(filePath, name) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(new RegExp(`const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));

  if (!match) {
    throw new Error(`Could not extract ${name} from ${filePath}`);
  }

  return vm.runInNewContext(`(${match[1]})`);
}
