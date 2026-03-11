"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Layers,
  ChevronUp,
  ChevronDown,
  Clock,
  Camera,
  Radio,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  TrainFront,
  LocateFixed,
  Plus,
  Minus,
  MoonStar,
} from "lucide-react";
import shinkansenLines from "@/data/shinkansen-lines.json";
import trainAnimations from "@/data/shinkansen-train-animations.json";
import liveCamerasData from "@/data/live-cameras.json";
import {
  TRAIN_SERVICE_DESCRIPTORS,
  TRAIN_SERVICE_GROUPS,
  TRAIN_SERVICE_IMAGES,
  TRAIN_TYPES,
  type TrainType,
} from "@/lib/shinkansen-services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LayerId =
  | "google-road"
  | "google-satellite"
  | "google-hybrid"
  | "google-terrain"
  | "osm"
  | "openrailwaymap"
  | "carto-dark"
  | "carto-positron"
  | "carto-voyager";

type ShinkansenFeature = {
  properties: {
    id: string;
    color: string;
    name: string;
    status?: "planned" | "under-construction";
  };
  geometry: {
    coordinates: number[][];
  };
};

type ShinkansenDataset = {
  features: ShinkansenFeature[];
};

type StationReference = {
  name: string;
  coordinate: [number, number];
};

type SnappedCoordinate = {
  coordinate: [number, number];
  segmentStart: [number, number];
  segmentEnd: [number, number];
};

type StationLabelDirection = "top" | "bottom" | "left" | "right";
type StationLabelVariant = "major" | "minor";

type TerminalCoordinatePair = {
  start: [number, number];
  end: [number, number];
};

type LiveCamera = {
  id: string;
  title: string;
  coordinate: [number, number];
  heading: number;
  url: string;
};

type TrainAnimationDataset = typeof trainAnimations;
type TrainAnimationRoute = TrainAnimationDataset["routes"][number];
type TrainAnimationStation = TrainAnimationRoute["stations"][number];
type TrainAnimationTrain = TrainAnimationRoute["trains"][number];
type TrainAnimationPoint = TrainAnimationTrain["points"][number];

type PathMetrics = {
  segmentLengths: number[];
  cumulativeDistances: number[];
  totalDistance: number;
};

type RouteTemplate = {
  key: string;
  route: TrainAnimationRoute;
  color: string;
  pathCoordinates: [number, number][];
  metrics: PathMetrics;
  stations: Array<
    TrainAnimationStation & {
      routeIndex: number;
      snappedCoordinate: [number, number];
      pathDistance: number;
    }
  >;
  stationByIndex: Map<number, RouteTemplate["stations"][number]>;
  segmentRanges: Array<{
    lineId: string;
    startDistance: number;
    endDistance: number;
  }>;
};

type TrainCountsByType = Record<TrainType, number>;

const LAYERS: {
  id: LayerId;
  label: string;
  group: string;
  url: string;
  attribution: string;
  overlay?: { url: string; attribution: string };
}[] = [
  {
    id: "google-road",
    label: "Road",
    group: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  {
    id: "google-satellite",
    label: "Satellite",
    group: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  {
    id: "google-hybrid",
    label: "Hybrid",
    group: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  {
    id: "google-terrain",
    label: "Terrain",
    group: "Google Maps",
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  {
    id: "osm",
    label: "OSM",
    group: "OpenStreetMap / Railway",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: "openrailwaymap",
    label: "OpenRailwayMap",
    group: "OpenStreetMap / Railway",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    overlay: {
      url: "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openrailwaymap.org">OpenRailwayMap</a>',
    },
  },
  {
    id: "carto-dark",
    label: "Dark Matter",
    group: "CartoDB",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: "carto-positron",
    label: "Positron",
    group: "CartoDB",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: "carto-voyager",
    label: "Voyager",
    group: "CartoDB",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
];

const GROUPS = ["Google Maps", "OpenStreetMap / Railway", "CartoDB"];

// Thumbnail tile at z=5, x=28, y=12 (centered roughly on Japan)
function getLayerThumb(layer: (typeof LAYERS)[number]) {
  return layer.url
    .replace("{z}", "5")
    .replace("{x}", "28")
    .replace("{y}", "12")
    .replace("{r}", "")
    .replace("{s}", "a");
}
const STATION_LABEL_MIN_ZOOM = 10;
const SHINKANSEN_DATASET = shinkansenLines as ShinkansenDataset;
const CUSTOM_FEATURES: ShinkansenFeature[] = [
  {
    properties: {
      id: "chuo-extension",
      name: "Chuo Extension",
      color: "#888888",
      status: "planned",
    },
    geometry: {
      coordinates: [
        [136.8809822, 35.170581],
        [136.74, 35.08],
        [136.57, 34.97],
        [136.39, 34.86],
        [136.21, 34.77],
        [136.05, 34.72],
        [135.92, 34.695],
        [135.82, 34.685],
        [135.73, 34.69],
        [135.65, 34.705],
        [135.58, 34.72],
        [135.54, 34.728],
        [135.5001888, 34.7335385],
      ],
    },
  },
  {
    properties: {
      id: "hokuriku-extension",
      name: "Hokuriku Extension",
      color: "#888888",
      status: "planned",
    },
    geometry: {
      coordinates: [
        [136.0763837, 35.644899],
        [135.99, 35.57],
        [135.88, 35.48],
        [135.78, 35.39],
        [135.73, 35.29],
        [135.72, 35.18],
        [135.72, 35.08],
        [135.73, 35.01],
        [135.7584303, 34.9846076],
        [135.75, 34.93],
        [135.73, 34.88],
        [135.72, 34.83],
        [135.66, 34.79],
        [135.59, 34.76],
        [135.54, 34.745],
        [135.5001888, 34.7335385],
      ],
    },
  },
  {
    properties: {
      id: "nishi-kyushu-extension",
      name: "Nishi-Kyushu Extension",
      color: "#888888",
      status: "planned",
    },
    geometry: {
      coordinates: [
        [130.0230661, 33.1964792],
        [130.048, 33.208],
        [130.083, 33.223],
        [130.119, 33.241],
        [130.159, 33.255],
        [130.201, 33.265],
        [130.248, 33.271],
        [130.296, 33.27],
        [130.342, 33.276],
        [130.389, 33.291],
        [130.431, 33.315],
        [130.466, 33.344],
        [130.4908123, 33.3696637],
      ],
    },
  },
];
const ALL_FEATURES = [...SHINKANSEN_DATASET.features, ...CUSTOM_FEATURES];
const LINE_STATUSES: Partial<Record<string, "planned" | "under-construction">> = {
  chuo: "under-construction",
  "chuo-extension": "planned",
  "hokkaido-extension": "under-construction",
  "hokuriku-extension": "planned",
  "nishi-kyushu-extension": "planned",
};

type TrainLiveStatus = {
  status: string;
  tone: "success" | "warning" | "danger" | "neutral";
  detail: string;
  fetchedAt: number;
};

const STATUS_POLL_SEQUENCE: { lineId: string; directionId: string }[] = [
  { lineId: "1", directionId: "U" }, { lineId: "1", directionId: "D" },
  { lineId: "2", directionId: "U" }, { lineId: "2", directionId: "D" },
  { lineId: "3", directionId: "U" }, { lineId: "3", directionId: "D" },
  { lineId: "4", directionId: "U" }, { lineId: "4", directionId: "D" },
  { lineId: "5", directionId: "U" }, { lineId: "5", directionId: "D" },
  { lineId: "6", directionId: "U" }, { lineId: "6", directionId: "D" },
  { lineId: "7", directionId: "U" }, { lineId: "7", directionId: "D" },
];

const STATUS_POLL_INTERVAL_MS = 4000;
const STATUS_STALE_MS = 3 * 60 * 1000;

const LINE_MENU_GROUPS = [
  {
    id: "core",
    label: "Core network",
    lineIds: ["tokaido", "sanyo", "kyushu", "tohoku", "hokkaido", "joetsu", "hokuriku"],
  },
  {
    id: "branches",
    label: "Branches and mini-shinkansen",
    lineIds: ["nishi-kyushu", "akita", "yamagata", "gala-yuzawa"],
  },
  {
    id: "future",
    label: "Planned and under construction",
    lineIds: [
      "chuo",
      "chuo-extension",
      "hokkaido-extension",
      "hokuriku-extension",
      "nishi-kyushu-extension",
    ],
  },
] as const;
const LINE_TERMINALS: Partial<Record<string, TerminalCoordinatePair>> = {
  hokuriku: {
    start: [36.3223804, 139.0127191],
    end: [35.644899, 136.0763837],
  },
  joetsu: {
    start: [35.9063869, 139.6243304],
    end: [37.9122444, 139.0613294],
  },
};
const LINE_STATIONS: Record<string, StationReference[]> = {
  tokaido: [
    { name: "Tokyo", coordinate: [35.6809626, 139.7679859] },
    { name: "Shinagawa", coordinate: [35.6286457, 139.7400659] },
    { name: "Shin-Yokohama", coordinate: [35.5072282, 139.6174221] },
    { name: "Odawara", coordinate: [35.2561225, 139.1545547] },
    { name: "Atami", coordinate: [35.10409, 139.0777771] },
    { name: "Mishima", coordinate: [35.1268739, 138.9101672] },
    { name: "Shin-Fuji", coordinate: [35.1421319, 138.6634609] },
    { name: "Shizuoka", coordinate: [34.9715372, 138.3883294] },
    { name: "Kakegawa", coordinate: [34.7693974, 138.0146156] },
    { name: "Hamamatsu", coordinate: [34.7040059, 137.7348139] },
    { name: "Toyohashi", coordinate: [34.7626409, 137.3812062] },
    { name: "Mikawa-Anjo", coordinate: [34.9703195, 137.0614456] },
    { name: "Nagoya", coordinate: [35.170581, 136.8809822] },
    { name: "Gifu-Hashima", coordinate: [35.3155126, 136.6860366] },
    { name: "Maibara", coordinate: [35.3150245, 136.2895833] },
    { name: "Kyoto", coordinate: [34.9846076, 135.7584303] },
    { name: "Shin-Osaka", coordinate: [34.7335385, 135.5001888] },
  ],
  sanyo: [
    { name: "Shin-Osaka", coordinate: [34.7335385, 135.5001888] },
    { name: "Shin-Kobe", coordinate: [34.7064884, 135.1956157] },
    { name: "Nishi-Akashi", coordinate: [34.6669049, 134.9604166] },
    { name: "Himeji", coordinate: [34.8269005, 134.6902424] },
    { name: "Aioi", coordinate: [34.818017, 134.4739008] },
    { name: "Okayama", coordinate: [34.6654089, 133.917825] },
    { name: "Shin-Kurashiki", coordinate: [34.5652579, 133.6784605] },
    { name: "Fukuyama", coordinate: [34.4894286, 133.3624823] },
    { name: "Shin-Onomichi", coordinate: [34.4300627, 133.1903283] },
    { name: "Mihara", coordinate: [34.4007946, 133.083283] },
    { name: "Higashi-Hiroshima", coordinate: [34.3888993, 132.7588789] },
    { name: "Hiroshima", coordinate: [34.3973947, 132.4758369] },
    { name: "Shin-Iwakuni", coordinate: [34.1645738, 132.1495132] },
    { name: "Tokuyama", coordinate: [34.0512305, 131.8027197] },
    { name: "Shin-Yamaguchi", coordinate: [34.0937693, 131.396365] },
    { name: "Asa", coordinate: [34.0537909, 131.1599628] },
    { name: "Shin-Shimonoseki", coordinate: [34.0082223, 130.9492803] },
    { name: "Kokura", coordinate: [33.8872865, 130.8832221] },
    { name: "Hakata", coordinate: [33.5899887, 130.4211594] },
  ],
  kyushu: [
    { name: "Hakata", coordinate: [33.5899887, 130.4211594] },
    { name: "Shin-Tosu", coordinate: [33.3696637, 130.4908123] },
    { name: "Kurume", coordinate: [33.3206417, 130.5014036] },
    { name: "Chikugo-Funagoya", coordinate: [33.1781547, 130.4924364] },
    { name: "Shin-Omuta", coordinate: [33.0711991, 130.4887598] },
    { name: "Shin-Tamana", coordinate: [32.9423867, 130.5737758] },
    { name: "Kumamoto", coordinate: [32.7903174, 130.6889738] },
    { name: "Shin-Yatsushiro", coordinate: [32.5180397, 130.6348392] },
    { name: "Shin-Minamata", coordinate: [32.2105785, 130.4286671] },
    { name: "Izumi", coordinate: [32.089725, 130.3577842] },
    { name: "Sendai", coordinate: [31.8137835, 130.3122563] },
    { name: "Kagoshima-Chuo", coordinate: [31.5837134, 130.5417909] },
  ],
  "nishi-kyushu": [
    { name: "Takeo-Onsen", coordinate: [33.1964792, 130.0230661] },
    { name: "Ureshino-Onsen", coordinate: [33.1066719, 129.9989438] },
    { name: "Shin-Omura", coordinate: [32.9329805, 129.9570496] },
    { name: "Isahaya", coordinate: [32.8515808, 130.041437] },
    { name: "Nagasaki", coordinate: [32.7521727, 129.8688815] },
  ],
  tohoku: [
    { name: "Tokyo", coordinate: [35.6809626, 139.7679859] },
    { name: "Ueno", coordinate: [35.7134128, 139.7765418] },
    { name: "Omiya", coordinate: [35.9063869, 139.6243304] },
    { name: "Oyama", coordinate: [36.3129364, 139.8065054] },
    { name: "Utsunomiya", coordinate: [36.5592983, 139.8981571] },
    { name: "Nasu-Shiobara", coordinate: [36.9315325, 140.0210685] },
    { name: "Shin-Shirakawa", coordinate: [37.1230906, 140.1884461] },
    { name: "Koriyama", coordinate: [37.398488, 140.388798] },
    { name: "Fukushima", coordinate: [37.75454, 140.4592144] },
    { name: "Shiroishi-Zao", coordinate: [37.9954269, 140.6331751] },
    { name: "Sendai", coordinate: [38.2603516, 140.8823921] },
    { name: "Furukawa", coordinate: [38.5705529, 140.9679338] },
    { name: "Kurikoma-Kogen", coordinate: [38.7487399, 141.0716092] },
    { name: "Ichinoseki", coordinate: [38.9268807, 141.1389019] },
    { name: "Mizusawa-Esashi", coordinate: [39.1451474, 141.1887494] },
    { name: "Kitakami", coordinate: [39.2818212, 141.1217172] },
    { name: "Shin-Hanamaki", coordinate: [39.4058826, 141.1735809] },
    { name: "Morioka", coordinate: [39.7005875, 141.136689] },
    { name: "Iwate-Numakunai", coordinate: [39.960584, 141.2172841] },
    { name: "Ninohe", coordinate: [40.260138, 141.286006] },
    { name: "Hachinohe", coordinate: [40.5093889, 141.4311833] },
    { name: "Shichinohe-Towada", coordinate: [40.7199949, 141.1534608] },
    { name: "Shin-Aomori", coordinate: [40.8282447, 140.6934733] },
  ],
  hokuriku: [
    { name: "Takasaki", coordinate: [36.3223804, 139.0127191] },
    { name: "Annaka-Haruna", coordinate: [36.3625792, 138.8493964] },
    { name: "Karuizawa", coordinate: [36.3425512, 138.6351092] },
    { name: "Sakudaira", coordinate: [36.2781104, 138.4643868] },
    { name: "Ueda", coordinate: [36.3965984, 138.2495851] },
    { name: "Nagano", coordinate: [36.6431239, 138.1885153] },
    { name: "Iiyama", coordinate: [36.8462882, 138.3587871] },
    { name: "Joetsumyoko", coordinate: [37.0812219, 138.2486852] },
    { name: "Itoigawa", coordinate: [37.0433062, 137.8617531] },
    { name: "Kurobe-Unazukionsen", coordinate: [36.8743189, 137.481437] },
    { name: "Toyama", coordinate: [36.7016421, 137.2127904] },
    { name: "Shin-Takaoka", coordinate: [36.726967, 137.01199] },
    { name: "Kanazawa", coordinate: [36.5780499, 136.6480247] },
    { name: "Komatsu", coordinate: [36.4018391, 136.4528145] },
    { name: "Kagaonsen", coordinate: [36.3203882, 136.3504996] },
    { name: "Awaraonsen", coordinate: [36.2146024, 136.2350566] },
    { name: "Fukui", coordinate: [36.0618051, 136.2231202] },
    { name: "Echizen-Takefu", coordinate: [35.8955139, 136.1989052] },
    { name: "Tsuruga", coordinate: [35.644899, 136.0763837] },
  ],
  joetsu: [
    { name: "Omiya", coordinate: [35.9063869, 139.6243304] },
    { name: "Kumagaya", coordinate: [36.1390715, 139.390035] },
    { name: "Honjo-Waseda", coordinate: [36.2188607, 139.1794855] },
    { name: "Takasaki", coordinate: [36.3223804, 139.0127191] },
    { name: "Jomo-Kogen", coordinate: [36.6931647, 138.9775973] },
    { name: "Echigo-Yuzawa", coordinate: [36.9359414, 138.8090456] },
    { name: "Urasa", coordinate: [37.1672238, 138.9228409] },
    { name: "Nagaoka", coordinate: [37.4478778, 138.8541667] },
    { name: "Tsubame-Sanjo", coordinate: [37.6483698, 138.9390886] },
    { name: "Niigata", coordinate: [37.9122444, 139.0613294] },
  ],
  "gala-yuzawa": [
    { name: "Echigo-Yuzawa", coordinate: [36.9359414, 138.8090456] },
    { name: "Gala-Yuzawa", coordinate: [36.9521441, 138.798846] },
  ],
  hokkaido: [
    { name: "Shin-Aomori", coordinate: [40.8282447, 140.6934733] },
    { name: "Okutsugaru-Imabetsu", coordinate: [41.1449446, 140.5157284] },
    { name: "Kikonai", coordinate: [41.678018, 140.4342846] },
    { name: "Shin-Hakodate-Hokuto", coordinate: [41.9046814, 140.6485358] },
  ],
  akita: [
    { name: "Morioka", coordinate: [39.7005875, 141.136689] },
    { name: "Shizukuishi", coordinate: [39.6892709, 140.9744464] },
    { name: "Tazawako", coordinate: [39.7002861, 140.7223789] },
    { name: "Kakunodate", coordinate: [39.5917435, 140.5711801] },
    { name: "Omagari", coordinate: [39.4656823, 140.479891] },
    { name: "Akita", coordinate: [39.7168833, 140.1296657] },
  ],
  yamagata: [
    { name: "Fukushima", coordinate: [37.75454, 140.4592144] },
    { name: "Yonezawa", coordinate: [37.9094986, 140.1283425] },
    { name: "Takahata", coordinate: [37.992415, 140.1531311] },
    { name: "Akayu", coordinate: [38.0473771, 140.1489763] },
    { name: "Kaminoyama-Onsen", coordinate: [38.1520989, 140.2785301] },
    { name: "Yamagata", coordinate: [38.2484701, 140.3278031] },
    { name: "Tendo", coordinate: [38.3599623, 140.3695642] },
    { name: "Sakurambo-Higashine", coordinate: [38.4285068, 140.3810129] },
    { name: "Murayama", coordinate: [38.4770786, 140.3864953] },
    { name: "Oishida", coordinate: [38.5956294, 140.3753132] },
    { name: "Shinjo", coordinate: [38.7626088, 140.30602] },
  ],
};
// Live cameras loaded from cameras/data.json — edit that file to add/remove cameras
const LIVE_CAMERAS: LiveCamera[] = liveCamerasData as LiveCamera[];
const MAJOR_STATION_NAMES = new Set([
  "Tokyo",
  "Shinagawa",
  "Shin-Yokohama",
  "Nagoya",
  "Kyoto",
  "Shin-Osaka",
  "Okayama",
  "Hiroshima",
  "Kokura",
  "Hakata",
  "Kumamoto",
  "Kagoshima-Chuo",
  "Nagasaki",
  "Sendai",
  "Omiya",
  "Morioka",
  "Shin-Aomori",
  "Nagano",
  "Kanazawa",
  "Tsuruga",
  "Niigata",
]);
const STATION_KEY_COUNTS = buildStationKeyCounts(LINE_STATIONS);

export default function MapClient() {
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const overlayTileRef = useRef<L.TileLayer | null>(null);
  const initialBoundsRef = useRef<L.LatLngBounds | null>(null);
  const lineLayersRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const trainLayerRef = useRef<L.LayerGroup | null>(null);
  const routeTemplatesRef = useRef<Map<string, RouteTemplate>>(new Map());
  const trainMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const trainStatusRef = useRef<Map<string, TrainLiveStatus>>(new Map());
  const stationPaneRef = useRef<HTMLElement | null>(null);
  const stationLabelPaneRef = useRef<HTMLElement | null>(null);
  const showStationsRef = useRef(true);
  const [activeLayer, setActiveLayer] = useState<LayerId>("carto-dark");
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [attribution, setAttribution] = useState(
    LAYERS.find((layer) => layer.id === "carto-dark")!.attribution
  );
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    () => new Set(ALL_FEATURES.map((feature) => feature.properties.id))
  );
  const [linesOpen, setLinesOpen] = useState(false);
  const [trainsOpen, setTrainsOpen] = useState(false);
  const [visibleTrainTypes, setVisibleTrainTypes] = useState<Set<string>>(
    () => new Set(TRAIN_TYPES)
  );
  const [activeTrainCountsByType, setActiveTrainCountsByType] = useState<TrainCountsByType>(
    () => createEmptyTrainCountsByType()
  );
  const visibleTrainTypesRef = useRef(visibleTrainTypes);

  const toggleTrainType = useCallback((type: string) => {
    setVisibleTrainTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);
  const toggleTrainServiceGroup = useCallback((types: readonly TrainType[]) => {
    setVisibleTrainTypes((prev) => {
      const next = new Set(prev);
      const allSelected = types.every((type) => next.has(type));

      for (const type of types) {
        if (allSelected) {
          next.delete(type);
        } else {
          next.add(type);
        }
      }

      return next;
    });
  }, []);
  const [showStations, setShowStations] = useState(true);
  const [tokyoClock, setTokyoClock] = useState(() => formatTokyoScheduleTime(new Date()));
  const [activeTrainCount, setActiveTrainCount] = useState(0);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "playback">("live");
  const [playbackMinute, setPlaybackMinute] = useState(() => Math.floor(getTokyoMinutes(new Date())));
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackMinuteRef = useRef(playbackMinute);
  const modeRef = useRef(mode);
  const playbackPlayingRef = useRef(playbackPlaying);
  const playbackSpeedRef = useRef(playbackSpeed);

  useEffect(() => {
    visibleTrainTypesRef.current = visibleTrainTypes;
  }, [visibleTrainTypes]);

  useEffect(() => {
    playbackMinuteRef.current = playbackMinute;
    modeRef.current = mode;
    playbackPlayingRef.current = playbackPlaying;
    playbackSpeedRef.current = playbackSpeed;
  }, [mode, playbackMinute, playbackPlaying, playbackSpeed]);

  useEffect(() => {
    let pollIndex = 0;
    let aborted = false;

    const poll = async () => {
      if (aborted) return;
      const { lineId, directionId } = STATUS_POLL_SEQUENCE[pollIndex % STATUS_POLL_SEQUENCE.length];
      pollIndex++;

      try {
        const res = await fetch(`/api/status?lang=en&lineId=${lineId}&directionId=${directionId}`);
        if (!res.ok) return;
        const data = await res.json();
        const now = Date.now();

        for (const train of data.trains ?? []) {
          const id = normalizeTrainIdFromStatus(train.trainName);
          if (!id) continue;
          trainStatusRef.current.set(id, {
            status: train.status,
            tone: train.tone,
            detail: train.detail,
            fetchedAt: now,
          });
        }

        for (const [key, val] of trainStatusRef.current) {
          if (now - val.fetchedAt > STATUS_STALE_MS) {
            trainStatusRef.current.delete(key);
          }
        }
      } catch {
        // Silently ignore fetch failures
      }
    };

    poll();
    const intervalId = window.setInterval(poll, STATUS_POLL_INTERVAL_MS);

    return () => {
      aborted = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const toggleLine = useCallback((lineId: string) => {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  }, []);
  const toggleAllLines = useCallback(() => {
    setVisibleLines((prev) =>
      prev.size === ALL_FEATURES.length
        ? new Set<string>()
        : new Set(ALL_FEATURES.map((feature) => feature.properties.id))
    );
  }, []);
  const reframeMap = useCallback(() => {
    const map = mapRef.current;
    const bounds = initialBoundsRef.current;
    if (!map || !bounds) return;

    map.fitBounds(bounds, { animate: true, duration: 0.8 });
  }, []);

  // Sync visibility with map layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, group] of lineLayersRef.current) {
      if (visibleLines.has(id)) {
        if (!map.hasLayer(group)) map.addLayer(group);
      } else {
        if (map.hasLayer(group)) map.removeLayer(group);
      }
    }
  }, [visibleLines]);

  // Sync station visibility via pane
  useEffect(() => {
    showStationsRef.current = showStations;

    const stationPane = stationPaneRef.current;
    if (stationPane) {
      stationPane.style.display = showStations ? "" : "none";
    }

    const labelPane = stationLabelPaneRef.current;
    const map = mapRef.current;
    if (!labelPane || !map) return;

    labelPane.style.display =
      showStations && map.getZoom() >= STATION_LABEL_MIN_ZOOM ? "" : "none";
  }, [showStations]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("map", {
      center: [36.5, 136.0],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
    });

    map.createPane("shinkansen-lines");
    map.getPane("shinkansen-lines")!.style.zIndex = "650";
    map.createPane("shinkansen-stations");
    map.getPane("shinkansen-stations")!.style.zIndex = "660";
    map.createPane("shinkansen-station-labels");
    map.getPane("shinkansen-station-labels")!.style.zIndex = "665";
    map.createPane("shinkansen-cameras");
    map.getPane("shinkansen-cameras")!.style.zIndex = "668";
    map.createPane("shinkansen-trains");
    map.getPane("shinkansen-trains")!.style.zIndex = "670";

    const defaultLayer = LAYERS.find((l) => l.id === "carto-dark")!;
    baseTileRef.current = L.tileLayer(defaultLayer.url, { maxZoom: 20 }).addTo(map);

    const bounds = L.latLngBounds([]);
    const lineCoordinatesById = new Map<string, [number, number][]>();
    const lineColorsById = new Map<string, string>();
    const renderedStationKeys = new Set<string>();

    const NON_OPERATIONAL_STYLE = {
      color: "#888888",
      weight: 2.5,
      opacity: 0.7,
      dashArray: "8 6",
      lineCap: "butt",
      pane: "shinkansen-lines",
    } satisfies L.PolylineOptions;
    stationPaneRef.current = map.getPane("shinkansen-stations")!;
    stationLabelPaneRef.current = map.getPane("shinkansen-station-labels")!;

    const syncStationLabelVisibility = () => {
      if (!stationLabelPaneRef.current) return;

      stationLabelPaneRef.current.style.display =
        showStationsRef.current && map.getZoom() >= STATION_LABEL_MIN_ZOOM ? "" : "none";
    };

    map.on("zoomend", syncStationLabelVisibility);
    syncStationLabelVisibility();

    for (const feature of ALL_FEATURES) {
      const rawCoordinates = feature.geometry.coordinates.map(
        (coordinate) => [coordinate[1], coordinate[0]] as [number, number]
      );
      const coordinates = trimLineToTerminals(
        rawCoordinates,
        LINE_TERMINALS[feature.properties.id]
      );

      if (coordinates.length < 2) continue;

      bounds.extend(coordinates);
      lineCoordinatesById.set(feature.properties.id, coordinates);

      const group = L.layerGroup().addTo(map);
      lineLayersRef.current.set(feature.properties.id, group);

      const lineStatus = feature.properties.status ?? LINE_STATUSES[feature.properties.id];
      const isNonOperational = Boolean(lineStatus);
      const lineColor = isNonOperational ? "#888888" : feature.properties.color;
      lineColorsById.set(feature.properties.id, lineColor);
      const lineStyle: L.PolylineOptions = isNonOperational
        ? NON_OPERATIONAL_STYLE
        : { color: lineColor, weight: 3, opacity: 1, lineCap: "round", pane: "shinkansen-lines" };

      const lineTooltipContent = lineStatus
        ? `<span class="map-line-tooltip__name">${escapeHtml(feature.properties.name)}</span><span class="map-line-tooltip__meta">${escapeHtml(
            lineStatus === "planned" ? "Under planning" : "Under construction"
          )}</span>`
        : `<span class="map-line-tooltip__name">${escapeHtml(feature.properties.name)}</span>`;

      L.polyline(coordinates, lineStyle).addTo(group);

      const hoverLine = L.polyline(coordinates, {
        ...lineStyle,
        weight: 20,
        opacity: 0,
      })
        .bindTooltip(lineTooltipContent, {
          direction: "top",
          sticky: false,
          opacity: 1,
          offset: [0, -10],
          className: "map-tooltip map-tooltip--line",
        })
        .on("mouseover mousemove", (event) => {
          const mouseEvent = event as L.LeafletMouseEvent;
          const snappedPoint = snapCoordinateToLine(
            [mouseEvent.latlng.lat, mouseEvent.latlng.lng],
            coordinates
          );

          if (!snappedPoint) return;

          hoverLine.openTooltip(
            L.latLng(snappedPoint.coordinate[0], snappedPoint.coordinate[1])
          );
        })
        .on("mouseout", () => {
          hoverLine.closeTooltip();
        })
        .addTo(group);

      const stations = LINE_STATIONS[feature.properties.id] ?? [];
      for (const [stationIndex, station] of stations.entries()) {
        const snappedStation = snapCoordinateToLine(station.coordinate, coordinates);
        if (!snappedStation) continue;

        const stationKey = getStationKey(station);
        if (renderedStationKeys.has(stationKey)) continue;
        renderedStationKeys.add(stationKey);

        const snappedCoordinate = snappedStation.coordinate;
        const labelPlacement = getStationLabelPlacement(
          snappedStation.segmentStart,
          snappedStation.segmentEnd,
          stationIndex
        );
        const labelVariant = getStationLabelVariant(station.name);
        const displayCoordinate =
          (STATION_KEY_COUNTS.get(stationKey) ?? 0) > 1 ? station.coordinate : snappedCoordinate;

        L.circleMarker(displayCoordinate, {
          radius: isNonOperational ? 2.5 : 3,
          color: "#05070b",
          weight: 1.5,
          fillColor: lineColor,
          fillOpacity: 1,
          pane: "shinkansen-stations",
        })
          .addTo(group);

        L.marker(displayCoordinate, {
          icon: createStationLabelIcon(station.name, labelPlacement.direction, labelVariant),
          interactive: false,
          keyboard: false,
          pane: "shinkansen-station-labels",
        }).addTo(group);
      }
    }

    for (const camera of LIVE_CAMERAS) {
      L.marker(camera.coordinate, {
        icon: createLiveCameraIcon(camera.heading),
        title: camera.title,
        pane: "shinkansen-cameras",
      })
        .on("click", () => {
          setActiveCameraId(camera.id);
        })
        .addTo(map);
    }

    trainLayerRef.current = L.layerGroup().addTo(map);
    routeTemplatesRef.current = new Map(
      (trainAnimations as TrainAnimationDataset).routes.map((route) => [
        getRouteKey(route.routeId, route.directionId),
        buildRouteTemplate(route, lineCoordinatesById, lineColorsById),
      ])
    );

    if (bounds.isValid()) {
      const paddedBounds = bounds.pad(0.08);
      initialBoundsRef.current = paddedBounds;
      map.fitBounds(paddedBounds);
    }

    mapRef.current = map;

    return () => {
      map.off("zoomend", syncStationLabelVisibility);
    };
  }, []);

  useEffect(() => {
    const trainLayer = trainLayerRef.current;

    if (!trainLayer || routeTemplatesRef.current.size === 0) {
      return;
    }

    const updateTrainMarkers = () => {
      let currentMinute: number;

      if (modeRef.current === "live") {
        const now = new Date();
        setTokyoClock(formatTokyoScheduleTime(now));
        currentMinute = getTokyoMinutes(now);
      } else {
        if (playbackPlayingRef.current) {
          const next = playbackMinuteRef.current + playbackSpeedRef.current / 60;
          const clamped = next > 1440 ? 0 : next;
          setPlaybackMinute(clamped);
        }
        currentMinute = playbackMinuteRef.current;
        setTokyoClock(formatMinuteToTime(currentMinute));
      }
      const activeMarkerIds = new Set<string>();
      let nextActiveTrainCount = 0;
      const nextActiveTrainCountsByType = createEmptyTrainCountsByType();

      for (const route of (trainAnimations as TrainAnimationDataset).routes) {
        const template = routeTemplatesRef.current.get(getRouteKey(route.routeId, route.directionId));

        if (!template) {
          continue;
        }

        for (const train of route.trains) {
          const position = getTrainPosition(train, template, currentMinute);

          if (!position) {
            continue;
          }

          nextActiveTrainCountsByType[train.name as TrainType] += 1;

          if (!visibleTrainTypesRef.current.has(train.name) || !visibleLines.has(position.lineId)) {
            continue;
          }

          nextActiveTrainCount += 1;

          const markerId = `${template.key}:${train.id}`;
          activeMarkerIds.add(markerId);

          const liveStatus = trainStatusRef.current.get(train.id) ?? null;

          const tooltipContent = createTrainTooltipContent({
            train,
            routeLineName: route.lineName,
            currentMinute,
            position,
            liveStatus,
          });

          const markerTone = liveStatus?.tone;
          const isDelayed = markerTone === "warning";
          const isDanger = markerTone === "danger";
          const markerRadius = (isDelayed || isDanger) ? 5.5 : 4.5;
          const markerWeight = (isDelayed || isDanger) ? 2.5 : 1.5;
          const markerStroke = isDanger
            ? "rgba(239, 68, 68, 0.9)"
            : isDelayed
              ? "rgba(251, 191, 36, 0.85)"
              : "#ffffff";
          const markerFillOpacity = isDanger ? 0.5 : 1;

          const existingMarker = trainMarkersRef.current.get(markerId);

          if (existingMarker) {
            existingMarker.setLatLng(position.coordinate);
            existingMarker.setStyle({
              fillColor: position.color,
              color: markerStroke,
              weight: markerWeight,
              radius: markerRadius,
              fillOpacity: markerFillOpacity,
            });
            existingMarker.setTooltipContent(tooltipContent);
          } else {
            const marker = L.circleMarker(position.coordinate, {
              radius: markerRadius,
              color: markerStroke,
              weight: markerWeight,
              fillColor: position.color,
              fillOpacity: markerFillOpacity,
              pane: "shinkansen-trains",
            })
              .bindTooltip(tooltipContent, {
                direction: "top",
                opacity: 0.95,
                offset: [0, -8],
                className: "map-tooltip map-tooltip--train",
              })
              .addTo(trainLayer);

            trainMarkersRef.current.set(markerId, marker);
          }
        }
      }

      for (const [markerId, marker] of trainMarkersRef.current) {
        if (activeMarkerIds.has(markerId)) {
          continue;
        }

        trainLayer.removeLayer(marker);
        trainMarkersRef.current.delete(markerId);
      }

      setActiveTrainCount(nextActiveTrainCount);
      setActiveTrainCountsByType(nextActiveTrainCountsByType);
    };

    updateTrainMarkers();
    const intervalMs = 1000;
    const intervalId = window.setInterval(updateTrainMarkers, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [visibleLines, mode, playbackPlaying]);

  const handleLayerChange = (id: LayerId) => {
    setActiveLayer(id);
    const map = mapRef.current;
    if (!map) return;

    const layer = LAYERS.find((l) => l.id === id)!;

    if (baseTileRef.current) map.removeLayer(baseTileRef.current);
    if (overlayTileRef.current) {
      map.removeLayer(overlayTileRef.current);
      overlayTileRef.current = null;
    }

    baseTileRef.current = L.tileLayer(layer.url, { maxZoom: 20 }).addTo(map);

    if (layer.overlay) {
      overlayTileRef.current = L.tileLayer(layer.overlay.url, {
        maxZoom: 20,
        opacity: 0.8,
      }).addTo(map);
      setAttribution(`${layer.attribution} · ${layer.overlay.attribution}`);
    } else {
      setAttribution(layer.attribution);
    }
  };

  const activeLabel = LAYERS.find((l) => l.id === activeLayer)?.label ?? "";
  const currentJstMinute = getTokyoMinutes(new Date());
  const isNonOperatingHours = currentJstMinute >= 0 && currentJstMinute < 360; // 00:00–06:00 JST
  const activeCamera = activeCameraId
    ? LIVE_CAMERAS.find((camera) => camera.id === activeCameraId) ?? null
    : null;

  return (
    <div className="relative w-full h-screen">
      <div id="map" className="w-full h-full" />

      <div className="absolute top-3 left-3 z-[1000] w-[min(92vw,24rem)] time-panel">
        {/* Mode toggle + badge row */}
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-0">
          <div className="time-panel__tabs">
            <button
              onClick={() => { setMode("live"); setPlaybackPlaying(false); }}
              className={`time-panel__tab ${mode === "live" ? "time-panel__tab--active" : ""}`}
            >
              <Radio className="w-2.5 h-2.5" />
              Live
            </button>
            <button
              onClick={() => { setMode("playback"); setPlaybackMinute(Math.floor(getTokyoMinutes(new Date()))); }}
              className={`time-panel__tab ${mode === "playback" ? "time-panel__tab--active" : ""}`}
            >
              Playback
            </button>
          </div>
          <span className="time-panel__badge">{mode === "live" ? "Live feed" : "Replay"}</span>
        </div>

        {/* Clock + active trains */}
        <div className="flex items-end justify-between gap-3 px-3.5 pt-3 pb-3">
          <div className="min-w-0">
            <div className="time-panel__label">
              {mode === "live" ? "Japan Standard Time" : "Playback time"}
            </div>
            <div className="time-panel__clock jr-clock">
              {mode === "playback" ? formatMinuteToTime(playbackMinute) : tokyoClock}
            </div>
          </div>
          <div className="time-panel__stat">
            <span className="time-panel__stat-value">{activeTrainCount}</span>
            <span className="time-panel__stat-label">trains</span>
          </div>
        </div>

        {/* Non-operating hours warning */}
        {mode === "live" && isNonOperatingHours && (
          <div className="time-panel__night-warning">
            <MoonStar className="time-panel__night-icon" />
            <div className="time-panel__night-body">
              <span className="time-panel__night-title">No active services</span>
              <span className="time-panel__night-desc">
                Trains don&apos;t run 00:00–06:00.{" "}
                <button onClick={() => { setMode("playback"); setPlaybackMinute(Math.floor(getTokyoMinutes(new Date()))); }} className="time-panel__night-link">
                  Use Playback
                </button>{" "}
                to explore schedules.
              </span>
              <span className="time-panel__night-note">Live cameras are unavailable in Playback.</span>
            </div>
          </div>
        )}

        {/* Playback controls */}
        {mode === "playback" && (
          <div className="time-panel__playback">
            {/* Slider */}
            <div className="time-panel__slider-wrap">
              <input
                type="range"
                min={0}
                max={1440}
                step={1}
                value={playbackMinute}
                onChange={(e) => setPlaybackMinute(Number(e.target.value))}
                className="time-panel__slider"
              />
              <div className="time-panel__slider-labels">
                <span>00:00</span>
                <span>{formatMinuteToTime(playbackMinute)}</span>
                <span>24:00</span>
              </div>
            </div>

            {/* Transport + speed */}
            <div className="flex items-center gap-1.5">
              <div className="time-panel__transport">
                <button
                  onClick={() => setPlaybackMinute((m) => Math.max(0, m - 30))}
                  className="time-panel__transport-btn"
                  title="Back 30 min"
                >
                  <SkipBack className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setPlaybackPlaying((p) => !p)}
                  className="time-panel__transport-btn time-panel__transport-btn--play"
                  title={playbackPlaying ? "Pause" : "Play"}
                >
                  {playbackPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setPlaybackMinute((m) => Math.min(1440, m + 30))}
                  className="time-panel__transport-btn"
                  title="Forward 30 min"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
              <div className="time-panel__speeds">
                {[1, 5, 10, 100].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`time-panel__speed ${playbackSpeed === speed ? "time-panel__speed--active" : ""}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="time-panel__disclaimer">
          <span className="time-panel__disclaimer-icon">⚠</span>
          <span>Private preview — train positions may vary ±3 min from actual. Do not rely on this for time-critical decisions.</span>
        </div>
      </div>

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-[1000] flex w-[min(92vw,28rem)] flex-col items-end gap-2">
        {activeCamera && (
          <div className="cam-stack">
            <div className="cam-header">
              <Select value={activeCamera.id} onValueChange={setActiveCameraId}>
                <SelectTrigger className="cam-select-trigger">
                  <Camera className="w-3 h-3 shrink-0" style={{ opacity: 0.45 }} />
                  <SelectValue>{activeCamera.title}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="end"
                  sideOffset={6}
                  className="cam-select-content z-[1001]"
                >
                  <div className="py-0.5">
                    {LIVE_CAMERAS.map((camera) => (
                      <SelectItem
                        key={camera.id}
                        value={camera.id}
                        className="cam-select-item"
                      >
                        {camera.title}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setActiveCameraId(null)}
                className="cam-collapse-btn"
                title="Close camera"
              >
                <Plus className="w-3 h-3 rotate-45" />
              </button>
            </div>
            {activeCamera && (
              <div className="cam-panel">
                <div className="cam-panel__top">
                  <span className="cam-panel__live-dot" />
                  <span className="cam-panel__label">Live</span>
                  <span className="cam-panel__title">{activeCamera.title}</span>
                </div>
                <div className="cam-panel__frame">
                  <iframe
                    src={getYouTubeEmbedUrl(activeCamera.url, true)}
                    title={activeCamera.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map controls + layer picker */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-end gap-2">
        {/* Layer picker */}
        <div className="layer-picker">
          {layerPickerOpen && (
            <div className="layer-picker__panel">
              <div className="layer-picker__panel-header">
                <span className="layer-picker__panel-title">Map type</span>
                <button
                  type="button"
                  onClick={() => setLayerPickerOpen(false)}
                  className="layer-picker__close"
                >
                  <Plus className="h-3 w-3 rotate-45" />
                </button>
              </div>
              {GROUPS.map((group, gi) => {
                const groupLayers = LAYERS.filter((l) => l.group === group);
                return (
                  <div key={group}>
                    {gi > 0 && <div className="layer-picker__divider" />}
                    <div className="layer-picker__group-label">{group}</div>
                    <div className="layer-picker__grid">
                      {groupLayers.map((layer) => (
                        <button
                          key={layer.id}
                          type="button"
                          onClick={() => { handleLayerChange(layer.id); setLayerPickerOpen(false); }}
                          className={`layer-picker__tile ${activeLayer === layer.id ? "layer-picker__tile--active" : ""}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getLayerThumb(layer)}
                            alt={layer.label}
                            className="layer-picker__tile-img"
                          />
                          <span className="layer-picker__tile-label">{layer.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setLayerPickerOpen((o) => !o)}
            className={`layer-picker__trigger ${layerPickerOpen ? "layer-picker__trigger--open" : ""}`}
            title="Map type"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getLayerThumb(LAYERS.find((l) => l.id === activeLayer)!)}
              alt={activeLabel}
              className="layer-picker__trigger-img"
            />
            <Layers className="layer-picker__trigger-icon" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-end gap-1.5">
          <a
            href="/timetable"
            className="map-control-button"
            title="Timetable"
            aria-label="Timetable"
          >
            <Clock className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={reframeMap}
            className="map-control-button"
            title="Reframe to Japan"
            aria-label="Reframe to Japan"
          >
            <LocateFixed className="h-3.5 w-3.5" />
          </button>
          <div className="map-control-zoom">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="map-control-button map-control-button--segmented"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="map-control-button map-control-button--segmented"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Lines & service types panel */}
      <div className="absolute top-16 bottom-8 left-3 z-[1000] w-[min(92vw,340px)] pointer-events-none">
        <div className="h-full flex flex-col justify-end overflow-hidden">
          <div className="pointer-events-auto overflow-y-auto overscroll-contain flex flex-col gap-2">
            {/* Service types */}
            <div className="filter-panel">
              <div className="filter-panel__section">
                <button
                  onClick={() => setTrainsOpen((o) => !o)}
                  className="filter-panel__header"
                >
                  <span className="filter-panel__icon">
                    <TrainFront className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="filter-panel__title">Services</span>
                    <span className="filter-panel__subtitle">
                      {visibleTrainTypes.size}/{TRAIN_TYPES.length} enabled
                    </span>
                  </span>
                  <span className="filter-panel__count">{visibleTrainTypes.size}</span>
                  <span className="filter-panel__chevron">
                    {trainsOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                  </span>
                </button>
                {trainsOpen && (
                  <div className="filter-panel__body">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleTrainTypes(
                          visibleTrainTypes.size === TRAIN_TYPES.length
                            ? new Set()
                            : new Set(TRAIN_TYPES)
                        )
                      }
                      className="svc-toggle-all"
                    >
                      <span className="svc-toggle-all__text">All services</span>
                      <span className="svc-toggle-all__count">
                        {visibleTrainTypes.size}/{TRAIN_TYPES.length}
                      </span>
                      <span className={`line-toggle__switch ${visibleTrainTypes.size === TRAIN_TYPES.length ? "line-toggle__switch--on" : ""}`}>
                        <span className="line-toggle__knob" />
                      </span>
                    </button>
                    <div className="filter-panel__divider" />
                    <div className="space-y-1.5">
                      {TRAIN_SERVICE_GROUPS.map((group) => {
                        const groupActive = group.services.filter((s) => visibleTrainTypes.has(s)).length;
                        return (
                        <div key={group.id} className="filter-panel__group">
                          <button
                            type="button"
                            onClick={() => toggleTrainServiceGroup(group.services)}
                            className="svc-group-header"
                          >
                            <span className="svc-group-header__label">{group.label}</span>
                            <span className="svc-group-header__count">{groupActive}/{group.services.length}</span>
                            <span className={`line-toggle__switch ${groupActive === group.services.length ? "line-toggle__switch--on" : ""}`}>
                              <span className="line-toggle__knob" />
                            </span>
                          </button>
                          <div className="grid grid-cols-2 gap-1 p-1">
                            {group.services.map((type) => {
                              const isActive = visibleTrainTypes.has(type);
                              const count = activeTrainCountsByType[type];
                              return (
                                <label
                                  key={type}
                                  className={`svc-card ${isActive ? "svc-card--on" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={() => toggleTrainType(type)}
                                    className="sr-only"
                                  />
                                  <div className="svc-card__top">
                                    <span className="svc-card__descriptor">{TRAIN_SERVICE_DESCRIPTORS[type]}</span>
                                    {count > 0 && (
                                      <span className="svc-card__live-count">{count}</span>
                                    )}
                                  </div>
                                  <div className="svc-card__bottom">
                                    <span className="svc-card__name">{type}</span>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={TRAIN_SERVICE_IMAGES[type]}
                                      alt={type}
                                      className={`svc-card__img ${isActive ? "" : "svc-card__img--off"}`}
                                    />
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Lines */}
            <div className="filter-panel">
              <div className="filter-panel__section">
                <button
                  onClick={() => setLinesOpen((o) => !o)}
                  className="filter-panel__header"
                >
                  <span className="filter-panel__icon">
                    <div className="h-[2px] w-2.5 rounded-full bg-white/60" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="filter-panel__title">Lines</span>
                    <span className="filter-panel__subtitle">
                      {visibleLines.size}/{ALL_FEATURES.length} visible
                    </span>
                  </span>
                  <span className="filter-panel__count">{visibleLines.size}</span>
                  <span className="filter-panel__chevron">
                    {linesOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronUp className="h-3 w-3" />
                    )}
                  </span>
                </button>
                {linesOpen && (
                  <div className="filter-panel__body">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setShowStations((s) => !s)}
                        className={`filter-panel__quick-toggle ${
                          showStations ? "filter-panel__quick-toggle--active" : ""
                        }`}
                      >
                        <SelectionMark state={showStations ? "all" : "none"} />
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-white/88">Stations</div>
                          <div className="text-[8px] text-white/40">markers &amp; labels</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={toggleAllLines}
                        className="filter-panel__quick-toggle filter-panel__quick-toggle--active"
                      >
                        <SelectionMark
                          state={getSelectionState(
                            visibleLines,
                            ALL_FEATURES.map((feature) => feature.properties.id)
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-white/88">All lines</div>
                          <div className="text-[8px] text-white/40">
                            {visibleLines.size}/{ALL_FEATURES.length}
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="filter-panel__divider" />
                    <div className="space-y-1.5">
                      {LINE_MENU_GROUPS.map((group) => {
                        const features = group.lineIds
                          .map((lineId) => ALL_FEATURES.find((feature) => feature.properties.id === lineId))
                          .filter(Boolean) as typeof ALL_FEATURES;

                        if (features.length === 0) return null;

                        return (
                          <div key={group.id} className="filter-panel__group">
                            <div className="filter-panel__group-label">
                              <span>{group.label}</span>
                              <span className="text-white/25">{features.length}</span>
                            </div>
                            <div className="space-y-0.5 px-1 pb-1">
                              {features.map((feature) => {
                                const lineStatus =
                                  feature.properties.status ?? LINE_STATUSES[feature.properties.id];
                                const isNonOperational = Boolean(lineStatus);
                                const displayColor = isNonOperational ? "#888888" : feature.properties.color;
                                const isActive = visibleLines.has(feature.properties.id);

                                return (
                                  <label
                                    key={feature.properties.id}
                                    className={`line-toggle ${isActive ? "line-toggle--on" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isActive}
                                      onChange={() => toggleLine(feature.properties.id)}
                                      className="sr-only"
                                    />
                                    <span
                                      className="line-toggle__swatch"
                                      style={{ backgroundColor: displayColor }}
                                    />
                                    <span className="line-toggle__name">{feature.properties.name}</span>
                                    {lineStatus && (
                                      <span className="line-toggle__status">{formatLineStatusLabel(lineStatus)}</span>
                                    )}
                                    <span className={`line-toggle__switch ${isActive ? "line-toggle__switch--on" : ""}`}>
                                      <span className="line-toggle__knob" />
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom attribution */}
      <div
        className="absolute bottom-1 left-1 z-[1000] text-[10px] text-white/35 px-1.5 py-0.5 rounded backdrop-blur-sm" style={{ background: "rgba(15,20,30,0.6)" }}
        dangerouslySetInnerHTML={{ __html: attribution }}
      />

      <style jsx global>{`
        .leaflet-tooltip-pane,
        .leaflet-popup-pane {
          z-index: 800 !important;
        }

        .live-camera-marker {
          background: transparent;
          border: 0;
        }

        .live-camera-radar {
          position: relative;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          overflow: hidden;
          background:
            repeating-radial-gradient(
              circle at center,
              rgba(255, 255, 255, 0.18) 0 1px,
              transparent 1px 5px
            ),
            radial-gradient(circle at center, rgba(10, 13, 18, 0.92), rgba(8, 11, 18, 0.76));
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow:
            0 6px 18px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .live-camera-radar::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: conic-gradient(
            from var(--camera-heading),
            rgba(129, 140, 248, 0.42) 0deg,
            rgba(99, 102, 241, 0.26) 42deg,
            rgba(99, 102, 241, 0.06) 78deg,
            transparent 78deg 360deg
          );
        }

        .live-camera-radar::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), transparent 38%),
            radial-gradient(circle at center, transparent 0 5px, rgba(255,255,255,0.08) 5px 6px, transparent 6px);
          pointer-events: none;
        }

        .live-camera-radar__core {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background: rgba(251, 191, 36, 0.92);
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.88),
            0 0 0 6px rgba(251, 191, 36, 0.08);
          z-index: 2;
        }

        .live-camera-marker:hover .live-camera-radar {
          border-color: rgba(255, 255, 255, 0.22);
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .live-camera-marker:hover .live-camera-radar::before {
          background: conic-gradient(
            from var(--camera-heading),
            rgba(147, 197, 253, 0.48) 0deg,
            rgba(99, 102, 241, 0.3) 42deg,
            rgba(99, 102, 241, 0.08) 78deg,
            transparent 78deg 360deg
          );
        }

        .cam-stack {
          width: min(92vw, 26rem);
        }

        .cam-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cam-collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(18, 20, 28, 0.82);
          backdrop-filter: blur(20px) saturate(1.4);
          box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.35);
          cursor: pointer;
          transition: all 0.12s ease;
          flex-shrink: 0;
        }

        .cam-collapse-btn:hover {
          background: rgba(24, 26, 34, 0.92);
          border-color: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.7);
        }

        .cam-select-trigger {
          flex: 1;
          min-width: 0;
          height: 2.5rem;
          gap: 0.5rem;
          padding: 0 0.75rem;
          border-radius: 10px;
          background: rgba(18, 20, 28, 0.88);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .cam-select-trigger:hover {
          background: rgba(22, 24, 32, 0.92);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .cam-select-trigger[data-state="open"] {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .cam-select-content {
          min-width: 16rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(18, 20, 28, 0.95);
          color: rgba(255, 255, 255, 0.88);
          box-shadow: 0 20px 42px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(20px) saturate(1.4);
          overflow: hidden;
        }

        .cam-select-item {
          min-height: 2rem;
          margin: 0 4px;
          border-radius: 8px;
          padding: 0.5rem 2rem 0.5rem 0.7rem;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.78rem;
          font-weight: 500;
        }

        .cam-select-item[data-highlighted] {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.92);
        }

        .cam-select-item[data-state="checked"] {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .cam-panel {
          margin-top: 0.4rem;
          overflow: hidden;
          border-radius: 14px;
          background: rgba(18, 20, 28, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.45),
            0 6px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px) saturate(1.4);
        }

        .cam-panel__top {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
        }

        .cam-panel__live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(251, 191, 36, 0.9);
          flex-shrink: 0;
          animation: cam-pulse 2s ease-in-out infinite;
        }

        .cam-panel__label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.32);
          margin-right: 4px;
        }

        .cam-panel__title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.88);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cam-panel__frame {
          aspect-ratio: 16 / 9;
          margin: 0 6px 6px;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .cam-panel__frame iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
        }

        @keyframes cam-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .leaflet-tooltip.map-tooltip {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(7, 10, 16, 0.08);
          border-radius: 12px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,255,255,0.4);
          color: rgba(12, 16, 24, 0.92);
          padding: 0.55rem 0.75rem;
          backdrop-filter: blur(14px) saturate(1.15);
        }

        .leaflet-tooltip.map-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.96);
        }

        .map-tooltip--line {
          display: flex;
          flex-direction: column;
          gap: 0.22rem;
          min-width: 0;
        }

        .map-line-tooltip__name {
          display: block;
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        .map-line-tooltip__meta {
          display: block;
          color: rgba(12, 16, 24, 0.56);
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .leaflet-tooltip.map-tooltip.map-tooltip--train {
          min-width: 17rem;
          max-width: 19rem;
          padding: 0;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 24px 48px rgba(0, 0, 0, 0.55),
            0 8px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          background: rgba(18, 20, 28, 0.92);
          backdrop-filter: blur(20px) saturate(1.4);
          color: rgba(255, 255, 255, 0.92);
        }

        .leaflet-tooltip.map-tooltip.map-tooltip--train::before {
          border-top-color: rgba(18, 20, 28, 0.92);
        }

        .train-tooltip {
          position: relative;
          display: flex;
          flex-direction: column;
          color: rgba(255, 255, 255, 0.92);
        }

        .train-tooltip__header {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem 0.85rem 0.65rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .train-tooltip__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
        }

        .train-tooltip__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.32rem;
          color: rgba(255, 255, 255, 0.42);
          font-size: 0.54rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .train-tooltip__eyebrow::before {
          content: "";
          width: 0.32rem;
          height: 0.32rem;
          border-radius: 9999px;
          background: var(--train-accent);
          flex-shrink: 0;
          animation: train-tooltip-pulse 2s ease-in-out infinite;
        }

        .train-tooltip__badge {
          flex-shrink: 0;
          border-radius: 4px;
          padding: 0.22rem 0.5rem;
          font-size: 0.58rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .train-tooltip__identity {
          display: flex;
          align-items: baseline;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .train-tooltip__title {
          font-size: 1.1rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
          color: rgba(255, 255, 255, 0.96);
        }

        .train-tooltip__line {
          color: rgba(255, 255, 255, 0.36);
          font-size: 0.68rem;
          font-weight: 500;
          line-height: 1;
        }

        .train-tooltip__trip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.72rem;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.01em;
        }

        .train-tooltip__trip-arrow {
          color: var(--train-accent);
          font-size: 0.65rem;
        }

        .train-tooltip__body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.65rem 0.85rem 0.75rem;
        }

        .train-tooltip__progress {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .train-tooltip__progress-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .train-tooltip__progress-value {
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .train-tooltip__progress-label {
          color: rgba(255, 255, 255, 0.32);
          font-size: 0.52rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .train-tooltip__progress-track {
          position: relative;
          height: 3px;
          overflow: hidden;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
        }

        .train-tooltip__progress-fill {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--train-accent);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.12);
          transition: width 1s linear;
        }

        .train-tooltip__progress-dot {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--train-accent);
          border: 1.5px solid rgba(18, 20, 28, 0.9);
          box-shadow: 0 0 6px var(--train-accent);
        }

        .train-tooltip__status-row {
          display: flex;
          align-items: stretch;
          gap: 0.4rem;
        }

        .train-tooltip__status-cell {
          flex: 1;
          min-width: 0;
          padding: 0.45rem 0.55rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .train-tooltip__status-label {
          display: block;
          color: rgba(255, 255, 255, 0.32);
          font-size: 0.48rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 0.2rem;
        }

        .train-tooltip__status-value {
          display: flex;
          align-items: baseline;
          gap: 0.3rem;
          font-size: 0.7rem;
          font-weight: 600;
          line-height: 1.25;
          color: rgba(255, 255, 255, 0.82);
          min-width: 0;
        }

        .train-tooltip__status-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .train-tooltip__status-time {
          flex-shrink: 0;
          color: rgba(255, 255, 255, 0.52);
          font-variant-numeric: tabular-nums;
        }

        .train-tooltip__divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.05);
          margin: 0.1rem 0;
        }

        .train-tooltip__times {
          display: flex;
          align-items: stretch;
          gap: 0.4rem;
        }

        .train-tooltip__time {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 0.45rem;
          padding: 0.45rem 0.55rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .train-tooltip__time-detail {
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
          min-width: 0;
        }

        .train-tooltip__time-label {
          display: block;
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.48rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .train-tooltip__time-station {
          display: block;
          color: rgba(255, 255, 255, 0.58);
          font-size: 0.6rem;
          font-weight: 500;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .train-tooltip__time-value {
          font-size: 1.05rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.04em;
          line-height: 1;
          color: rgba(255, 255, 255, 0.94);
          flex-shrink: 0;
        }

        @keyframes train-tooltip-pulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 var(--train-accent);
          }
          50% {
            opacity: 0.5;
            box-shadow: 0 0 4px 1px var(--train-accent);
          }
        }

        .train-tooltip__eyebrow--warning {
          color: rgba(251, 191, 36, 0.9);
        }

        .train-tooltip__eyebrow--warning::before {
          background: rgba(251, 191, 36, 0.9);
          box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.4);
        }

        .train-tooltip__eyebrow--danger {
          color: rgba(239, 68, 68, 0.9);
        }

        .train-tooltip__eyebrow--danger::before {
          background: rgba(239, 68, 68, 0.9);
          box-shadow: 0 0 4px 1px rgba(239, 68, 68, 0.4);
        }

        .train-tooltip__warning {
          display: flex;
          align-items: flex-start;
          gap: 5px;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.12);
          font-size: 9px;
          font-weight: 500;
          line-height: 1.35;
          color: rgba(251, 191, 36, 0.8);
        }

        .train-tooltip__warning-icon {
          flex-shrink: 0;
          font-size: 10px;
          line-height: 1;
        }

        .leaflet-interactive:focus {
          outline: none;
        }

        .station-tag-icon {
          background: transparent;
          border: 0;
        }

        .jr-panel {
          background: var(--jr-panel-bg);
          backdrop-filter: blur(12px) saturate(1.2);
          border: 1px solid var(--jr-panel-border);
          border-radius: 8px;
          color: var(--jr-panel-text);
          box-shadow: 0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .jr-clock {
          font-family: var(--font-geist-mono), ui-monospace, monospace;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.08em;
        }

        .jr-separator { height: 1px; background: var(--jr-panel-border); }

        .jr-section-header {
          color: var(--jr-panel-text-muted);
          font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.16em;
        }

        /* ---- Time panel ---- */
        .time-panel {
          background: rgba(18, 20, 28, 0.88);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          color: rgba(255, 255, 255, 0.92);
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.45),
            0 6px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .time-panel__tabs {
          display: inline-flex;
          border-radius: 8px;
          padding: 2px;
          background: rgba(255, 255, 255, 0.05);
          gap: 1px;
        }

        .time-panel__tab {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.38);
          transition: all 0.15s ease;
          border: none;
          background: none;
          cursor: pointer;
        }

        .time-panel__tab:hover {
          color: rgba(255, 255, 255, 0.65);
        }

        .time-panel__tab--active {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.92);
        }

        .time-panel__badge {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.32);
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .time-panel__label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.28);
        }

        .time-panel__clock {
          margin-top: 6px;
          font-size: 2rem;
          line-height: 1;
          color: rgba(255, 255, 255, 0.94);
          letter-spacing: 0.04em;
        }

        .time-panel__stat {
          display: flex;
          align-items: baseline;
          gap: 5px;
          flex-shrink: 0;
        }

        .time-panel__stat-value {
          font-size: 1.4rem;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.88);
        }

        .time-panel__stat-label {
          font-size: 10px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.3);
        }

        .time-panel__playback {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 14px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .time-panel__slider-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .time-panel__slider {
          width: 100%;
          height: 3px;
          cursor: pointer;
          accent-color: rgba(255, 255, 255, 0.7);
          border-radius: 9999px;
        }

        .time-panel__slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.22);
        }

        .time-panel__slider-labels > :nth-child(2) {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
        }

        .time-panel__transport {
          display: inline-flex;
          align-items: center;
          gap: 1px;
          padding: 2px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .time-panel__transport-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px;
          border-radius: 6px;
          border: none;
          background: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .time-panel__transport-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
        }

        .time-panel__transport-btn--play {
          color: rgba(255, 255, 255, 0.88);
        }

        .time-panel__speeds {
          display: inline-flex;
          gap: 1px;
          padding: 2px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .time-panel__speed {
          padding: 4px 8px;
          border-radius: 6px;
          border: none;
          background: none;
          font-size: 10px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.35);
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .time-panel__speed:hover {
          color: rgba(255, 255, 255, 0.65);
        }

        .time-panel__speed--active {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.92);
        }

        .time-panel__disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 5px;
          padding: 7px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 8px;
          font-weight: 500;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.22);
        }

        .time-panel__disclaimer-icon {
          flex-shrink: 0;
          font-size: 9px;
          line-height: 1;
          margin-top: 1px;
        }

        .time-panel__night-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 12px;
          margin: 0 8px 8px;
          border-radius: 8px;
          background: rgba(255, 190, 60, 0.06);
          border: 1px solid rgba(255, 190, 60, 0.12);
        }

        .time-panel__night-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          margin-top: 1px;
          color: rgba(255, 200, 100, 0.55);
        }

        .time-panel__night-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .time-panel__night-title {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255, 200, 100, 0.8);
        }

        .time-panel__night-desc {
          font-size: 9.5px;
          font-weight: 450;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.35);
        }

        .time-panel__night-link {
          color: rgba(255, 200, 100, 0.75);
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-color: rgba(255, 200, 100, 0.3);
          font-weight: 600;
          background: none;
          border: none;
          padding: 0;
          font-size: inherit;
          cursor: pointer;
          transition: color 0.15s, text-decoration-color 0.15s;
        }

        .time-panel__night-link:hover {
          color: rgba(255, 200, 100, 1);
          text-decoration-color: rgba(255, 200, 100, 0.6);
        }

        .time-panel__night-note {
          font-size: 8.5px;
          font-weight: 450;
          color: rgba(255, 255, 255, 0.2);
          margin-top: 1px;
        }

        /* ---- Filter panel ---- */
        .filter-panel {
          background: rgba(18, 20, 28, 0.88);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          color: rgba(255, 255, 255, 0.92);
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.45),
            0 6px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }



        .filter-panel__header {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: none;
          color: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s ease;
        }

        .filter-panel__header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .filter-panel__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }

        .filter-panel__title {
          display: block;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          color: rgba(255, 255, 255, 0.88);
        }

        .filter-panel__subtitle {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.32);
        }

        .filter-panel__count {
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.5);
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
        }

        .filter-panel__chevron {
          color: rgba(255, 255, 255, 0.25);
        }

        .filter-panel__body {
          padding: 6px 10px 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .filter-panel__divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.05);
          margin: 6px 4px;
        }

        .filter-panel__group {
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          overflow: hidden;
        }

        .filter-panel__group-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .svc-toggle-all {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 8px;
          border: none;
          background: none;
          color: rgba(255, 255, 255, 0.88);
          cursor: pointer;
          border-radius: 6px;
          text-align: left;
          transition: background 0.1s;
        }

        .svc-toggle-all:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .svc-toggle-all__text {
          flex: 1;
          font-size: 11px;
          font-weight: 600;
        }

        .svc-toggle-all__count {
          font-size: 9px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.35);
        }

        .svc-group-header {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 7px 10px;
          border: none;
          background: none;
          color: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .svc-group-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .svc-group-header__label {
          flex: 1;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .svc-group-header__count {
          font-size: 9px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.28);
        }

        .svc-card {
          position: relative;
          min-height: 58px;
          cursor: pointer;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 6px;
          transition: all 0.12s ease;
          opacity: 0.4;
          background: transparent;
        }

        .svc-card:hover {
          border-color: rgba(255, 255, 255, 0.1);
          opacity: 0.75;
        }

        .svc-card--on {
          opacity: 1;
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
        }

        .svc-card__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }

        .svc-card__descriptor {
          font-size: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.28);
        }

        .svc-card__live-count {
          font-size: 9px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.88);
        }

        .svc-card__bottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 4px;
        }

        .svc-card__name {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.1;
        }

        .svc-card__img {
          height: 26px;
          width: auto;
          object-fit: contain;
          object-position: right;
          flex-shrink: 0;
          transition: opacity 0.12s, filter 0.12s;
        }

        .svc-card__img--off {
          opacity: 0.25;
          filter: grayscale(0.5);
        }

        .filter-panel__quick-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: none;
          color: inherit;
          cursor: pointer;
          text-align: left;
          transition: all 0.12s;
        }

        .filter-panel__quick-toggle:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .filter-panel__quick-toggle--active {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .line-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .line-toggle:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .line-toggle__swatch {
          width: 16px;
          height: 3px;
          border-radius: 9999px;
          flex-shrink: 0;
          transition: opacity 0.12s;
        }

        .line-toggle:not(.line-toggle--on) .line-toggle__swatch {
          opacity: 0.35;
        }

        .line-toggle__name {
          flex: 1;
          min-width: 0;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.2;
          transition: opacity 0.12s;
        }

        .line-toggle:not(.line-toggle--on) .line-toggle__name {
          opacity: 0.45;
        }

        .line-toggle__status {
          font-size: 7px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.2);
          flex-shrink: 0;
        }

        .line-toggle__switch {
          position: relative;
          width: 26px;
          height: 14px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .line-toggle__switch--on {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .line-toggle__knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transition: all 0.15s ease;
        }

        .line-toggle__switch--on .line-toggle__knob {
          left: 14px;
          background: rgba(255, 255, 255, 0.88);
        }

        /* ---- Layer picker ---- */
        .layer-picker {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .layer-picker__trigger {
          position: relative;
          width: 3rem;
          height: 3rem;
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          overflow: hidden;
          cursor: pointer;
          box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(0, 0, 0, 0.3);
          transition: all 0.12s ease;
          background: rgba(18, 20, 28, 0.9);
          padding: 0;
        }

        .layer-picker__trigger:hover {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .layer-picker__trigger--open {
          border-color: rgba(255, 255, 255, 0.35);
        }

        .layer-picker__trigger-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .layer-picker__trigger-icon {
          position: absolute;
          bottom: 3px;
          right: 3px;
          width: 12px;
          height: 12px;
          color: white;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
        }

        .layer-picker__panel {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          width: 240px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(18, 20, 28, 0.94);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.88);
        }

        .layer-picker__panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .layer-picker__panel-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
        }

        .layer-picker__close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.1s;
        }

        .layer-picker__close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .layer-picker__group-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.22);
          margin-bottom: 5px;
        }

        .layer-picker__divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 8px 0;
        }

        .layer-picker__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .layer-picker__tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.1s;
        }

        .layer-picker__tile:hover {
          color: rgba(255, 255, 255, 0.92);
        }

        .layer-picker__tile-img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 6px;
          border: 2px solid transparent;
          transition: border-color 0.1s;
        }

        .layer-picker__tile--active .layer-picker__tile-img {
          border-color: rgba(255, 255, 255, 0.5);
        }

        .layer-picker__tile--active {
          color: rgba(255, 255, 255, 0.95);
        }

        .layer-picker__tile-label {
          font-size: 8px;
          font-weight: 600;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .map-control-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          background: rgba(18, 20, 28, 0.82);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.4);
          transition: all 0.12s ease;
        }

        .map-control-button:hover {
          background: rgba(24, 26, 34, 0.92);
          border-color: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.8);
        }

        .map-control-button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.2);
          outline-offset: 2px;
        }

        .map-control-button--segmented {
          background: transparent;
          border-radius: 0;
          border: 0;
          box-shadow: none;
          width: 100%;
          height: 2.25rem;
        }

        .map-control-button--segmented:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .map-control-zoom {
          width: 2.25rem;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(18, 20, 28, 0.82);
          backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .map-control-zoom .map-control-button + .map-control-button {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .station-tag-label {
          position: relative;
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          border-radius: 9999px;
          letter-spacing: 0.01em;
          line-height: 1;
          pointer-events: none;
        }

        .station-tag-major {
          background: rgba(15, 20, 30, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          color: rgba(255, 255, 255, 0.92);
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
        }

        .station-tag-minor {
          background: rgba(15, 20, 30, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
          color: rgba(255, 255, 255, 0.72);
          font-size: 10px;
          font-weight: 500;
          padding: 3px 7px;
        }

        .station-tag-top {
          transform: translate(-50%, calc(-100% - 12px));
        }

        .station-tag-bottom {
          transform: translate(-50%, 12px);
        }

        .station-tag-left {
          transform: translate(calc(-100% - 12px), -50%);
        }

        .station-tag-right {
          transform: translate(12px, -50%);
        }
      `}</style>
    </div>
  );
}

function formatMinuteToTime(totalMinutes: number) {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  const minutes = Math.floor(clamped % 60);
  const seconds = Math.floor((clamped % 1) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTokyoScheduleTime(value: Date) {
  const parts = getTokyoTimeParts(value);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function getTokyoMinutes(value: Date) {
  const parts = getTokyoTimeParts(value);
  return (
    Number(parts.hour) * 60 +
    Number(parts.minute) +
    Number(parts.second) / 60
  );
}

function getTokyoTimeParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  return {
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
    second: parts.find((part) => part.type === "second")?.value ?? "00",
  };
}

type SelectionState = "none" | "some" | "all";

function getSelectionState(
  selectedValues: ReadonlySet<string>,
  values: readonly string[]
): SelectionState {
  const selectedCount = values.filter((value) => selectedValues.has(value)).length;

  if (selectedCount === 0) {
    return "none";
  }

  if (selectedCount === values.length) {
    return "all";
  }

  return "some";
}

function SelectionMark({
  state,
  color = "#666",
}: {
  state: SelectionState;
  color?: string;
}) {
  const isActive = state !== "none";

  return (
    <span
      className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0"
      style={{
        borderColor: color,
        backgroundColor: isActive ? color : "transparent",
      }}
    >
      {state === "all" && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <path
            d="M1.5 4L3.2 5.7L6.5 2.3"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {state === "some" && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <path
            d="M1.7 4H6.3"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

function formatLineStatusLabel(status: "planned" | "under-construction") {
  return status === "planned" ? "planned" : "under construction";
}

function createEmptyTrainCountsByType(): TrainCountsByType {
  return TRAIN_TYPES.reduce((counts, type) => {
    counts[type] = 0;
    return counts;
  }, {} as TrainCountsByType);
}

function getRouteKey(routeId: string, directionId: string) {
  return `${routeId}:${directionId}`;
}

function buildRouteTemplate(
  route: TrainAnimationRoute,
  lineCoordinatesById: Map<string, [number, number][]>,
  lineColorsById: Map<string, string>
): RouteTemplate {
  const lineCoordinateMap = new Map<string, [number, number][]>();

  for (const lineId of route.mapLineIds) {
    const coordinates = lineCoordinatesById.get(lineId);
    const firstStation = route.stations.find((station) => station.lineId === lineId);

    if (!coordinates || !firstStation) {
      continue;
    }

    lineCoordinateMap.set(
      lineId,
      orientCoordinatesToStart(coordinates, asLatLngTuple(firstStation.coordinate))
    );
  }

  const pathCoordinates = buildCombinedRoutePath(route, lineCoordinateMap);
  const metrics = buildPathMetrics(pathCoordinates);
  const stations = route.stations.map((station, routeIndex) => {
    const projection = projectCoordinateToPath(
      asLatLngTuple(station.coordinate),
      pathCoordinates,
      metrics
    );

    return {
      ...station,
      routeIndex,
      snappedCoordinate: projection.coordinate,
      pathDistance: projection.distanceFromStart,
    };
  });

  return {
    key: getRouteKey(route.routeId, route.directionId),
    route,
    color:
      lineColorsById.get(route.mapLineIds.find((lineId) => lineColorsById.has(lineId)) ?? "") ??
      "#ffffff",
    pathCoordinates,
    metrics,
    stations,
    stationByIndex: new Map(stations.map((station) => [station.routeIndex, station])),
    segmentRanges: route.segmentLineIds.map((lineId, index) => ({
      lineId,
      startDistance: stations[index]?.pathDistance ?? 0,
      endDistance: stations[index + 1]?.pathDistance ?? stations[index]?.pathDistance ?? 0,
    })),
  };
}

function buildCombinedRoutePath(
  route: TrainAnimationRoute,
  lineCoordinateMap: Map<string, [number, number][]>
) {
  const pathCoordinates: [number, number][] = [];

  for (let index = 0; index < route.stations.length - 1; index += 1) {
    const lineId = route.segmentLineIds[index];
    const startStation = route.stations[index];
    const endStation = route.stations[index + 1];
    const coordinates = lineCoordinateMap.get(lineId);

    if (!coordinates?.length || !startStation || !endStation) {
      continue;
    }

    const segmentCoordinates = trimLineBetweenStations(
      coordinates,
      asLatLngTuple(startStation.coordinate),
      asLatLngTuple(endStation.coordinate)
    );

    if (!segmentCoordinates.length) {
      continue;
    }

    if (pathCoordinates.length === 0) {
      pathCoordinates.push(...segmentCoordinates);
      continue;
    }

    const previousCoordinate = pathCoordinates.at(-1)!;
    const nextCoordinates =
      squaredDistance(previousCoordinate, segmentCoordinates[0]) <= 1e-10
        ? segmentCoordinates.slice(1)
        : segmentCoordinates;

    pathCoordinates.push(...nextCoordinates);
  }

  return pathCoordinates;
}

function trimLineBetweenStations(
  coordinates: [number, number][],
  start: [number, number],
  end: [number, number]
) {
  if (coordinates.length < 2) {
    return coordinates;
  }

  const orientedCoordinates = orientCoordinatesToStart(coordinates, start);
  const startIndex = nearestCoordinateIndex(orientedCoordinates, start);
  const endIndex = nearestCoordinateIndex(orientedCoordinates, end);

  if (startIndex === -1 || endIndex === -1) {
    return orientedCoordinates;
  }

  if (startIndex === endIndex) {
    return [orientedCoordinates[startIndex], orientedCoordinates[Math.min(startIndex + 1, orientedCoordinates.length - 1)]];
  }

  return startIndex < endIndex
    ? orientedCoordinates.slice(startIndex, endIndex + 1)
    : [...orientedCoordinates.slice(endIndex, startIndex + 1)].reverse();
}

function buildPathMetrics(coordinates: [number, number][]): PathMetrics {
  const segmentLengths: number[] = [];
  const cumulativeDistances = [0];

  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentLength = Math.sqrt(
      squaredDistance(coordinates[index - 1], coordinates[index])
    );
    segmentLengths.push(segmentLength);
    cumulativeDistances.push(cumulativeDistances[index - 1] + segmentLength);
  }

  return {
    segmentLengths,
    cumulativeDistances,
    totalDistance: cumulativeDistances.at(-1) ?? 0,
  };
}

function projectCoordinateToPath(
  coordinate: [number, number],
  pathCoordinates: [number, number][],
  metrics: PathMetrics
) {
  let bestCoordinate = pathCoordinates[0] ?? coordinate;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestDistanceFromStart = 0;

  for (let index = 1; index < pathCoordinates.length; index += 1) {
    const segmentStart = pathCoordinates[index - 1];
    const segmentEnd = pathCoordinates[index];
    const projected = projectPointToSegment(coordinate, segmentStart, segmentEnd);
    const distance = squaredDistance(coordinate, projected);

    if (distance >= bestDistance) {
      continue;
    }

    bestDistance = distance;
    bestCoordinate = projected;
    bestDistanceFromStart =
      (metrics.cumulativeDistances[index - 1] ?? 0) +
      Math.sqrt(squaredDistance(segmentStart, projected));
  }

  return {
    coordinate: bestCoordinate,
    distanceFromStart: bestDistanceFromStart,
  };
}

function interpolateAlongPath(
  pathCoordinates: [number, number][],
  metrics: PathMetrics,
  distanceFromStart: number
): [number, number] {
  if (!pathCoordinates.length) {
    return [0, 0];
  }

  if (distanceFromStart <= 0) {
    return pathCoordinates[0];
  }

  if (distanceFromStart >= metrics.totalDistance) {
    return pathCoordinates.at(-1)!;
  }

  for (let index = 1; index < pathCoordinates.length; index += 1) {
    const segmentStartDistance = metrics.cumulativeDistances[index - 1] ?? 0;
    const segmentEndDistance = metrics.cumulativeDistances[index] ?? 0;

    if (distanceFromStart > segmentEndDistance) {
      continue;
    }

    const segmentLength = metrics.segmentLengths[index - 1] ?? 0;

    if (segmentLength === 0) {
      return pathCoordinates[index];
    }

    const ratio = (distanceFromStart - segmentStartDistance) / segmentLength;
    const start = pathCoordinates[index - 1];
    const end = pathCoordinates[index];

    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }

  return pathCoordinates.at(-1)!;
}

function getTrainPosition(
  train: TrainAnimationTrain,
  template: RouteTemplate,
  currentMinute: number
) {
  const firstPoint = train.points[0];
  const lastPoint = train.points.at(-1);

  if (!firstPoint || !lastPoint) {
    return null;
  }

  const firstDeparture = getPointDepartureMinute(firstPoint);
  const lastArrival = getPointArrivalMinute(lastPoint);

  if (currentMinute < firstDeparture - 5 || currentMinute > lastArrival + 5) {
    return null;
  }

  const firstStation = template.stationByIndex.get(firstPoint.routeIndex);
  const lastStation = template.stationByIndex.get(lastPoint.routeIndex);

  if (!firstStation || !lastStation) {
    return null;
  }

  const origin = firstStation.name;
  const destination = lastStation.name;

  if (currentMinute <= firstDeparture) {
    const lineId = getLineIdAtDistance(template, firstStation.pathDistance);
    return {
      coordinate: firstStation.snappedCoordinate,
      lineId,
      color: getLineColor(lineId),
      status: `At ${origin}`,
      origin,
      destination,
    };
  }

  for (let index = 0; index < train.points.length; index += 1) {
    const currentPoint = train.points[index];
    const currentStation = template.stationByIndex.get(currentPoint.routeIndex);

    if (!currentStation) {
      continue;
    }

    const arrivalMinute = getPointArrivalMinute(currentPoint);
    const departureMinute = getPointDepartureMinute(currentPoint);

    if (currentMinute >= arrivalMinute && currentMinute <= departureMinute) {
      const lineId = getLineIdAtDistance(template, currentStation.pathDistance);
      return {
        coordinate: currentStation.snappedCoordinate,
        lineId,
        color: getLineColor(lineId),
        status: `At ${currentStation.name}`,
        origin,
        destination,
      };
    }

    const nextPoint = train.points[index + 1];

    if (!nextPoint) {
      continue;
    }

    const nextStation = template.stationByIndex.get(nextPoint.routeIndex);

    if (!nextStation) {
      continue;
    }

    const nextArrivalMinute = getPointArrivalMinute(nextPoint);

    if (currentMinute < departureMinute || currentMinute > nextArrivalMinute) {
      continue;
    }

    const duration = nextArrivalMinute - departureMinute;
    const ratio = duration <= 0 ? 1 : (currentMinute - departureMinute) / duration;
    const currentDistance =
      currentStation.pathDistance +
      (nextStation.pathDistance - currentStation.pathDistance) * ratio;
    const lineId = getLineIdAtDistance(template, currentDistance);

    return {
      coordinate: interpolateAlongPath(template.pathCoordinates, template.metrics, currentDistance),
      lineId,
      color: getLineColor(lineId),
      status: `${currentStation.name} → ${nextStation.name}`,
      origin,
      destination,
    };
  }

  const finalLineId = getLineIdAtDistance(template, lastStation.pathDistance);

  return {
    coordinate: lastStation.snappedCoordinate,
    lineId: finalLineId,
    color: getLineColor(finalLineId),
    status: `At ${destination}`,
    origin,
    destination,
  };
}

function getPointArrivalMinute(point: TrainAnimationPoint) {
  return point.arrivalMinute ?? point.passMinute ?? point.departureMinute ?? 0;
}

function getPointDepartureMinute(point: TrainAnimationPoint) {
  return point.departureMinute ?? point.passMinute ?? point.arrivalMinute ?? 0;
}

function createTrainTooltipContent({
  train,
  routeLineName,
  currentMinute,
  position,
  liveStatus,
}: {
  train: TrainAnimationTrain;
  routeLineName: string;
  currentMinute: number;
  position: {
    origin: string;
    destination: string;
    status: string;
    color: string;
  };
  liveStatus: TrainLiveStatus | null;
}) {
  const descriptor =
    TRAIN_SERVICE_DESCRIPTORS[train.name as TrainType] ?? "service";
  const nextEvent = getUpcomingTrainEvent(train, currentMinute);
  const progressPercent = getTripProgressPercent(train, currentMinute);

  const isNormal = !liveStatus || liveStatus.tone === "success" || liveStatus.tone === "neutral";
  const eyebrowText = isNormal ? "Live" : liveStatus.status;
  const eyebrowToneClass = isNormal ? "" : ` train-tooltip__eyebrow--${liveStatus.tone}`;

  return `
    <div class="train-tooltip" style="--train-accent:${escapeHtml(position.color)}">
      <div class="train-tooltip__header">
        <div class="train-tooltip__meta">
          <span class="train-tooltip__eyebrow${eyebrowToneClass}">${escapeHtml(eyebrowText)}</span>
          <span class="train-tooltip__badge" style="background:${escapeHtml(hexToRgba(position.color, 0.15))}; border:1px solid ${escapeHtml(hexToRgba(position.color, 0.3))}; color:${escapeHtml(position.color)}">${escapeHtml(descriptor)}</span>
        </div>
        <div class="train-tooltip__identity">
          <span class="train-tooltip__title">${escapeHtml(formatTrainLabel(train))}</span>
          <span class="train-tooltip__line">${escapeHtml(routeLineName)}</span>
        </div>
        <div class="train-tooltip__trip">
          <span>${escapeHtml(position.origin)}</span>
          <span class="train-tooltip__trip-arrow">→</span>
          <span>${escapeHtml(position.destination)}</span>
        </div>
      </div>
      <div class="train-tooltip__body">
        <div class="train-tooltip__progress">
          <div class="train-tooltip__progress-meta">
            <span class="train-tooltip__progress-value">${progressPercent}%</span>
            <span class="train-tooltip__progress-label">Complete</span>
          </div>
          <div class="train-tooltip__progress-track">
            <span class="train-tooltip__progress-fill" style="width:${progressPercent}%"></span>
            <span class="train-tooltip__progress-dot" style="left:${progressPercent}%"></span>
          </div>
        </div>${isNormal ? "" : `
        <div class="train-tooltip__warning">
          <span class="train-tooltip__warning-icon">⚠</span>
          Position is schedule-based — reported ${escapeHtml(liveStatus!.status.toLowerCase())}
        </div>`}
        <div class="train-tooltip__status-row">
          <div class="train-tooltip__status-cell">
            <span class="train-tooltip__status-label">Now</span>
            <span class="train-tooltip__status-value"><span class="train-tooltip__status-text">${escapeHtml(position.status)}</span></span>
          </div>
          <div class="train-tooltip__status-cell">
            <span class="train-tooltip__status-label">Next</span>
            <span class="train-tooltip__status-value"><span class="train-tooltip__status-text">${escapeHtml(
              nextEvent ? nextEvent.label : position.destination
            )}</span> <span class="train-tooltip__status-time">${escapeHtml(
              formatMinuteToClock(nextEvent ? nextEvent.minute : train.endMinute)
            )}</span></span>
          </div>
        </div>
        <div class="train-tooltip__divider"></div>
        <div class="train-tooltip__times">
          <div class="train-tooltip__time">
            <span class="train-tooltip__time-value">${escapeHtml(formatMinuteToClock(train.startMinute))}</span>
            <div class="train-tooltip__time-detail">
              <span class="train-tooltip__time-label">Depart</span>
              <span class="train-tooltip__time-station">${escapeHtml(position.origin)}</span>
            </div>
          </div>
          <div class="train-tooltip__time">
            <span class="train-tooltip__time-value">${escapeHtml(formatMinuteToClock(train.endMinute))}</span>
            <div class="train-tooltip__time-detail">
              <span class="train-tooltip__time-label">Arrive</span>
              <span class="train-tooltip__time-station">${escapeHtml(position.destination)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getTripProgressPercent(train: TrainAnimationTrain, currentMinute: number) {
  const duration = train.endMinute - train.startMinute;

  if (duration <= 0) {
    return currentMinute >= train.endMinute ? 100 : 0;
  }

  const rawPercent = ((currentMinute - train.startMinute) / duration) * 100;
  return Math.max(0, Math.min(100, Math.round(rawPercent)));
}

function getUpcomingTrainEvent(train: TrainAnimationTrain, currentMinute: number) {
  for (const point of train.points) {
    if (point.arrivalMinute != null && point.arrivalMinute > currentMinute) {
      return {
        label: `Arrives ${point.stationName}`,
        minute: point.arrivalMinute,
      };
    }

    if (point.departureMinute != null && point.departureMinute > currentMinute) {
      return {
        label: `Departs ${point.stationName}`,
        minute: point.departureMinute,
      };
    }

    if (point.passMinute != null && point.passMinute > currentMinute) {
      return {
        label: `Passes ${point.stationName}`,
        minute: point.passMinute,
      };
    }
  }

  return null;
}

function formatTrainLabel(train: TrainAnimationTrain) {
  return `${train.name} ${train.number}`.trim();
}

function hexToRgba(color: string, alpha: number) {
  const normalized = color.trim();

  if (!normalized.startsWith("#")) {
    return color;
  }

  const hex = normalized.slice(1);
  const value =
    hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex;

  if (value.length !== 6) {
    return color;
  }

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getLineIdAtDistance(template: RouteTemplate, pathDistance: number) {
  for (const segment of template.segmentRanges) {
    if (pathDistance >= segment.startDistance && pathDistance <= segment.endDistance) {
      return segment.lineId;
    }
  }

  return template.segmentRanges.at(-1)?.lineId ?? template.route.mapLineIds[0] ?? "tokaido";
}

function getLineColor(lineId: string) {
  const feature = ALL_FEATURES.find((item) => item.properties.id === lineId);
  const lineStatus = feature?.properties.status ?? LINE_STATUSES[lineId];

  if (!feature) {
    return "#ffffff";
  }

  return lineStatus ? "#888888" : feature.properties.color;
}

function asLatLngTuple(coordinate: number[]) {
  return [coordinate[0] ?? 0, coordinate[1] ?? 0] as [number, number];
}

function snapCoordinateToLine(
  coordinate: [number, number],
  lineCoordinates: [number, number][]
): SnappedCoordinate | null {
  if (!Array.isArray(lineCoordinates) || lineCoordinates.length < 2) {
    return null;
  }

  let bestCoordinate: [number, number] | null = null;
  let bestSegmentStart: [number, number] | null = null;
  let bestSegmentEnd: [number, number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < lineCoordinates.length; index += 1) {
    const segmentStart = lineCoordinates[index - 1];
    const segmentEnd = lineCoordinates[index];
    const projected = projectPointToSegment(coordinate, segmentStart, segmentEnd);
    const distance = squaredDistance(coordinate, projected);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCoordinate = projected;
      bestSegmentStart = segmentStart;
      bestSegmentEnd = segmentEnd;
    }
  }

  if (!bestCoordinate || !bestSegmentStart || !bestSegmentEnd) {
    return null;
  }

  return {
    coordinate: bestCoordinate,
    segmentStart: bestSegmentStart,
    segmentEnd: bestSegmentEnd,
  };
}

function getStationLabelPlacement(
  segmentStart: [number, number],
  segmentEnd: [number, number],
  stationIndex: number
) {
  const latDelta = segmentEnd[0] - segmentStart[0];
  const lngDelta = segmentEnd[1] - segmentStart[1];
  const preferAlternateSide = stationIndex % 2 === 1;

  if (Math.abs(latDelta) >= Math.abs(lngDelta)) {
    const primaryDirection = lngDelta >= 0 ? "right" : "left";
    const alternateDirection = primaryDirection === "right" ? "left" : "right";
    const direction = preferAlternateSide ? alternateDirection : primaryDirection;

    return {
      direction,
    } as const;
  }

  const primaryDirection = latDelta >= 0 ? "top" : "bottom";
  const alternateDirection = primaryDirection === "top" ? "bottom" : "top";
  const direction = preferAlternateSide ? alternateDirection : primaryDirection;

  return {
    direction,
  } as const;
}

function createStationLabelIcon(
  name: string,
  direction: StationLabelDirection,
  variant: StationLabelVariant
) {
  return L.divIcon({
    className: "station-tag-icon",
    html: `<span class="station-tag-label station-tag-${variant} station-tag-${direction}">${escapeHtml(name)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createLiveCameraIcon(heading: number) {
  const cssHeading = normalizeCameraHeading(heading);

  return L.divIcon({
    className: "live-camera-marker",
    html: `<div class="live-camera-radar" style="--camera-heading:${cssHeading}deg"><span class="live-camera-radar__core"></span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
}

function normalizeCameraHeading(heading: number) {
  const normalized = ((heading % 360) + 360) % 360;
  return normalized - 90;
}

function getYouTubeEmbedUrl(url: string, autoplay = false) {
  try {
    const parsed = new URL(url);
    const videoId =
      parsed.hostname.includes("youtu.be")
        ? parsed.pathname.replaceAll("/", "")
        : parsed.searchParams.get("v");

    if (!videoId) {
      return url;
    }

    const params = new URLSearchParams({
      rel: "0",
      playsinline: "1",
      autoplay: autoplay ? "1" : "0",
      mute: autoplay ? "1" : "0",
    });

    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return url;
  }
}

function formatMinuteToClock(totalMinutes: number) {
  const clamped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  const minutes = Math.floor(clamped % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getStationLabelVariant(name: string): StationLabelVariant {
  return MAJOR_STATION_NAMES.has(name) ? "major" : "minor";
}

function getStationKey(station: StationReference) {
  const [lat, lng] = station.coordinate;
  return `${station.name}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

function buildStationKeyCounts(stationsByLine: Record<string, StationReference[]>) {
  const counts = new Map<string, number>();

  for (const stations of Object.values(stationsByLine)) {
    for (const station of stations) {
      const key = getStationKey(station);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function normalizeTrainIdFromStatus(trainName: string): string | null {
  const cleaned = trainName.replace(/号$/, "").trim();
  const match = cleaned.match(/^(.+?)\s+(\d+)$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function trimLineToTerminals(
  coordinates: [number, number][],
  terminals?: TerminalCoordinatePair
): [number, number][] {
  if (!terminals || coordinates.length < 2) {
    return coordinates;
  }

  const orientedCoordinates = orientCoordinatesToStart(coordinates, terminals.start);
  const startIndex = nearestCoordinateIndex(orientedCoordinates, terminals.start);
  const endIndex = nearestCoordinateIndex(orientedCoordinates, terminals.end);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return orientedCoordinates;
  }

  return orientedCoordinates.slice(startIndex, endIndex + 1);
}

function orientCoordinatesToStart(
  coordinates: [number, number][],
  start: [number, number]
): [number, number][] {
  const forwardDistance = squaredDistance(coordinates[0], start);
  const reverseDistance = squaredDistance(coordinates[coordinates.length - 1], start);

  return forwardDistance <= reverseDistance ? coordinates : [...coordinates].reverse();
}

function nearestCoordinateIndex(
  coordinates: [number, number][],
  target: [number, number]
): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length; index += 1) {
    const distance = squaredDistance(coordinates[index], target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function projectPointToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): [number, number] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return start;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared)
  );

  return [start[0] + dx * t, start[1] + dy * t];
}

function squaredDistance(left: [number, number], right: [number, number]) {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  return dx * dx + dy * dy;
}
