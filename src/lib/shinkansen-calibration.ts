import shinkansenLines from "../data/shinkansen-lines.json";
import trainAnimations from "../data/shinkansen-train-animations.json";
import {
  TRAIN_SERVICE_DESCRIPTORS,
  type TrainType,
} from "./shinkansen-services";

type LinesDataset = typeof shinkansenLines;
type TrainAnimationDataset = typeof trainAnimations;
type TrainAnimationRoute = TrainAnimationDataset["routes"][number];
type TrainAnimationStation = TrainAnimationRoute["stations"][number];
type TrainAnimationTrain = TrainAnimationRoute["trains"][number];
type TrainAnimationPoint = TrainAnimationTrain["points"][number];
type LineFeature = LinesDataset["features"][number];
type LatLng = [number, number];

type PathMetrics = {
  segmentLengths: number[];
  cumulativeDistances: number[];
  totalDistance: number;
};

type RouteTemplate = {
  key: string;
  route: TrainAnimationRoute;
  pathCoordinates: LatLng[];
  metrics: PathMetrics;
  stations: Array<
    TrainAnimationStation & {
      routeIndex: number;
      snappedCoordinate: LatLng;
      pathDistance: number;
    }
  >;
  stationByIndex: Map<
    number,
    TrainAnimationStation & {
      routeIndex: number;
      snappedCoordinate: LatLng;
      pathDistance: number;
    }
  >;
};

type TrainDynamicsProfile = {
  family: string;
  capKph: number;
  aEff: number;
  bEff: number;
};

type KinematicProfile = {
  runtimeS: number;
  distanceM: number;
  v0: number;
  v1: number;
  vPeak: number;
  cruiseSpeed: number;
  tAccel: number;
  tCruise: number;
  tBrake: number;
  sAccel: number;
  sCruise: number;
  sBrake: number;
};

export type CalibrationLineSummary = {
  lineId: string;
  lineName: string;
  sourceName: string;
  geometryLengthKm: number;
  geometryPointCount: number;
  lineSpeedCapKph: number | null;
  routeCount: number;
  stationCount: number;
  segmentCount: number;
  services: string[];
  trainFamilies: string[];
  trainsetCapsKph: number[];
};

export type CalibrationSegmentSummary = {
  key: string;
  lineId: string;
  lineName: string;
  routeId: string;
  directionId: string;
  fromStation: string;
  toStation: string;
  service: string;
  serviceDescriptor: string;
  sampleCount: number;
  directData: {
    distance_m: number;
    anchor_runtime_s: number;
    dwell_s: number;
    line_speed_cap_kph: number | null;
    trainset_speed_cap_kph: number;
  };
  inferred: {
    runtime_s: number;
    entry_speed_kph: number;
    exit_speed_kph: number;
    a_eff_mps2: number;
    b_eff_mps2: number;
    service_type_factor: number;
    reserve_slack_s: number;
    effective_peak_speed_kph: number;
  };
};

export type CalibrationTripSegment = {
  key: string;
  lineId: string;
  lineName: string;
  routeId: string;
  directionId: string;
  trainId: string;
  service: string;
  serviceDescriptor: string;
  trainFamily: string;
  fromStation: string;
  toStation: string;
  fromKind: TrainAnimationPoint["kind"];
  toKind: TrainAnimationPoint["kind"];
  timedAnchorStart: string;
  timedAnchorEnd: string;
  directData: {
    distance_m: number;
    anchor_runtime_s: number;
    dwell_s: number;
    line_speed_cap_kph: number | null;
    trainset_speed_cap_kph: number;
  };
  inferred: {
    runtime_s: number;
    entry_speed_kph: number;
    exit_speed_kph: number;
    a_eff_mps2: number;
    b_eff_mps2: number;
    service_type_factor: number;
    reserve_slack_s: number;
    effective_peak_speed_kph: number;
  };
  schedule: {
    startMinute: number;
    endMinute: number;
  };
  distances: {
    pathStart_m: number;
    pathEnd_m: number;
  };
  profile: KinematicProfile;
};

type TrainWindow = {
  routeId: string;
  directionId: string;
  trainId: string;
  service: string;
  serviceDescriptor: string;
  origin: string;
  destination: string;
  startMinute: number;
  endMinute: number;
  segments: CalibrationTripSegment[];
  template: RouteTemplate;
};

export type CalibrationPosition = {
  routeId: string;
  directionId: string;
  trainId: string;
  service: string;
  coordinate: LatLng;
  lineId: string;
  origin: string;
  destination: string;
  status: string;
};

export type CalibrationBundle = {
  generatedAt: string;
  lines: CalibrationLineSummary[];
  segmentSummaries: CalibrationSegmentSummary[];
  tripSegments: CalibrationTripSegment[];
};

const EARTH_RADIUS_M = 6371000;

const LINE_SPEED_CAPS: Record<string, number | null> = {
  tokaido: 285,
  sanyo: 300,
  tohoku: 320,
  joetsu: 275,
  hokuriku: 260,
  kyushu: 260,
  "nishi-kyushu": 260,
  hokkaido: 260,
  "gala-yuzawa": 200,
  yamagata: 130,
  akita: 130,
  chuo: null,
  "hokkaido-extension": null,
};

const TRAIN_DYNAMICS: Record<string, TrainDynamicsProfile> = {
  N700: { family: "N700", capKph: 300, aEff: 0.72, bEff: 0.82 },
  E5: { family: "E5", capKph: 320, aEff: 0.7, bEff: 0.8 },
  E6: { family: "E6", capKph: 320, aEff: 0.68, bEff: 0.79 },
  E7: { family: "E7", capKph: 275, aEff: 0.63, bEff: 0.74 },
  E2: { family: "E2", capKph: 275, aEff: 0.6, bEff: 0.72 },
  E8: { family: "E8", capKph: 300, aEff: 0.64, bEff: 0.75 },
  "800-series": { family: "800-series", capKph: 260, aEff: 0.68, bEff: 0.78 },
  Kamome: { family: "Kamome", capKph: 260, aEff: 0.7, bEff: 0.78 },
};

const SERVICE_TO_DYNAMICS_KEY: Record<TrainType, keyof typeof TRAIN_DYNAMICS> = {
  Nozomi: "N700",
  Hikari: "N700",
  "Hikari Rail Star": "N700",
  Kodama: "N700",
  Mizuho: "N700",
  Sakura: "N700",
  Tsubame: "800-series",
  Hayabusa: "E5",
  Hayate: "E5",
  Yamabiko: "E2",
  Nasuno: "E2",
  Komachi: "E6",
  Tsubasa: "E8",
  Toki: "E7",
  Tanigawa: "E7",
  Kagayaki: "E7",
  Hakutaka: "E7",
  Asama: "E7",
  Tsurugi: "E7",
  Kamome: "Kamome",
};

const SERVICE_TYPE_FACTORS: Record<string, number> = {
  express: 1,
  "limited-stop": 0.94,
  local: 0.88,
  service: 0.92,
};

const PASS_SPEED_FACTORS: Record<string, number> = {
  express: 0.82,
  "limited-stop": 0.72,
  local: 0.58,
  service: 0.64,
};

let cachedBundle: CalibrationBundle | null = null;
let cachedWindows: TrainWindow[] | null = null;

export function getCalibrationBundle(): CalibrationBundle {
  if (cachedBundle) {
    return cachedBundle;
  }

  const lineFeatures = (shinkansenLines as LinesDataset).features;
  const lineFeatureById = new Map(lineFeatures.map((feature) => [feature.properties.id, feature]));
  const routeTemplates = buildRouteTemplates(lineFeatures);
  const tripSegments: CalibrationTripSegment[] = [];
  const windows: TrainWindow[] = [];

  for (const route of (trainAnimations as TrainAnimationDataset).routes) {
    const template = routeTemplates.get(getRouteKey(route.routeId, route.directionId));

    if (!template) {
      continue;
    }

    for (const train of route.trains) {
      const trainWindows = buildTrainWindows(route, train, template, lineFeatureById);
      windows.push(...trainWindows);
      for (const window of trainWindows) {
        tripSegments.push(...window.segments);
      }
    }
  }

  cachedWindows = windows;
  cachedBundle = {
    generatedAt: new Date().toISOString(),
    lines: buildLineSummaries(lineFeatures, routeTemplates, tripSegments),
    segmentSummaries: buildSegmentSummaries(tripSegments),
    tripSegments,
  };

  return cachedBundle;
}

export function getCalibrationPositions(currentMinute: number) {
  const bundle = getCalibrationBundle();
  const positionsByTrain = new Map<string, CalibrationPosition>();

  for (const window of cachedWindows ?? []) {
    const position = getTrainPositionAtMinute(window, currentMinute);
    if (position) {
      positionsByTrain.set(position.trainId, position);
    }
  }

  return {
    generatedAt: bundle.generatedAt,
    currentMinute,
    positions: Array.from(positionsByTrain.values()),
  };
}

function buildLineSummaries(
  lineFeatures: LineFeature[],
  routeTemplates: Map<string, RouteTemplate>,
  tripSegments: CalibrationTripSegment[]
) {
  return lineFeatures
    .map((feature) => {
      const lineId = feature.properties.id;
      const segments = tripSegments.filter((segment) => segment.lineId === lineId);
      const routes = Array.from(routeTemplates.values()).filter((template) =>
        template.route.mapLineIds.includes(lineId)
      );
      const serviceSet = new Set(segments.map((segment) => segment.service));
      const familySet = new Set(segments.map((segment) => segment.trainFamily));
      const trainsetCaps = Array.from(
        new Set(segments.map((segment) => segment.directData.trainset_speed_cap_kph))
      ).sort((left, right) => left - right);
      const stationCount = Array.from(
        new Set(
          routes.flatMap((route) =>
            route.stations
              .filter((station) => station.lineId === lineId)
              .map((station) => station.name)
          )
        )
      ).length;

      return {
        lineId,
        lineName: feature.properties.name,
        sourceName: feature.properties.sourceName,
        geometryLengthKm: feature.properties.lengthKm,
        geometryPointCount: feature.geometry.coordinates.length,
        lineSpeedCapKph: LINE_SPEED_CAPS[lineId] ?? null,
        routeCount: routes.length,
        stationCount,
        segmentCount: segments.length,
        services: Array.from(serviceSet).sort((left, right) => left.localeCompare(right)),
        trainFamilies: Array.from(familySet).sort((left, right) => left.localeCompare(right)),
        trainsetCapsKph: trainsetCaps,
      } satisfies CalibrationLineSummary;
    })
    .sort((left, right) => left.lineName.localeCompare(right.lineName));
}

function buildSegmentSummaries(tripSegments: CalibrationTripSegment[]) {
  const grouped = new Map<string, CalibrationTripSegment[]>();

  for (const segment of tripSegments) {
    const key = [
      segment.lineId,
      segment.routeId,
      segment.directionId,
      segment.fromStation,
      segment.toStation,
      segment.service,
    ].join("|");
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(segment);
    } else {
      grouped.set(key, [segment]);
    }
  }

  return Array.from(grouped.entries())
    .map(([key, segments]) => {
      const sample = segments[0];

      return {
        key,
        lineId: sample.lineId,
        lineName: sample.lineName,
        routeId: sample.routeId,
        directionId: sample.directionId,
        fromStation: sample.fromStation,
        toStation: sample.toStation,
        service: sample.service,
        serviceDescriptor: sample.serviceDescriptor,
        sampleCount: segments.length,
        directData: {
          distance_m: roundNumber(median(segments.map((segment) => segment.directData.distance_m)), 1),
          anchor_runtime_s: roundNumber(
            median(segments.map((segment) => segment.directData.anchor_runtime_s)),
            1
          ),
          dwell_s: roundNumber(median(segments.map((segment) => segment.directData.dwell_s)), 1),
          line_speed_cap_kph: sample.directData.line_speed_cap_kph,
          trainset_speed_cap_kph: roundNumber(
            median(segments.map((segment) => segment.directData.trainset_speed_cap_kph)),
            0
          ),
        },
        inferred: {
          runtime_s: roundNumber(median(segments.map((segment) => segment.inferred.runtime_s)), 1),
          entry_speed_kph: roundNumber(
            median(segments.map((segment) => segment.inferred.entry_speed_kph)),
            1
          ),
          exit_speed_kph: roundNumber(
            median(segments.map((segment) => segment.inferred.exit_speed_kph)),
            1
          ),
          a_eff_mps2: roundNumber(median(segments.map((segment) => segment.inferred.a_eff_mps2)), 2),
          b_eff_mps2: roundNumber(median(segments.map((segment) => segment.inferred.b_eff_mps2)), 2),
          service_type_factor: roundNumber(
            median(segments.map((segment) => segment.inferred.service_type_factor)),
            2
          ),
          reserve_slack_s: roundNumber(
            median(segments.map((segment) => segment.inferred.reserve_slack_s)),
            1
          ),
          effective_peak_speed_kph: roundNumber(
            median(segments.map((segment) => segment.inferred.effective_peak_speed_kph)),
            1
          ),
        },
      } satisfies CalibrationSegmentSummary;
    })
    .sort((left, right) =>
      left.lineId.localeCompare(right.lineId) ||
      left.routeId.localeCompare(right.routeId) ||
      left.fromStation.localeCompare(right.fromStation) ||
      left.toStation.localeCompare(right.toStation) ||
      left.service.localeCompare(right.service)
    );
}

function buildRouteTemplates(lineFeatures: LineFeature[]) {
  const lineCoordinatesById = new Map(
    lineFeatures.map((feature) => [
      feature.properties.id,
      feature.geometry.coordinates.map(
        (coordinate) => [coordinate[1] ?? 0, coordinate[0] ?? 0] as LatLng
      ),
    ])
  );

  return new Map(
    (trainAnimations as TrainAnimationDataset).routes
      .map((route) => {
        const template = buildRouteTemplate(route, lineCoordinatesById);
        return template ? [template.key, template] : null;
      })
      .filter((value): value is [string, RouteTemplate] => value !== null)
  );
}

function buildRouteTemplate(
  route: TrainAnimationRoute,
  lineCoordinatesById: Map<string, LatLng[]>
) {
  const lineCoordinateMap = new Map<string, LatLng[]>();

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

  if (pathCoordinates.length < 2) {
    return null;
  }

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
    pathCoordinates,
    metrics,
    stations,
    stationByIndex: new Map(stations.map((station) => [station.routeIndex, station])),
  } satisfies RouteTemplate;
}

function buildTrainWindows(
  route: TrainAnimationRoute,
  train: TrainAnimationTrain,
  template: RouteTemplate,
  lineFeatureById: Map<string, LineFeature>
) {
  const windows: TrainWindow[] = [];
  const points = train.points;
  let anchorStart = 0;

  while (anchorStart < points.length - 1) {
    let anchorEnd = anchorStart + 1;

    while (anchorEnd < points.length && points[anchorEnd]?.kind === "pass") {
      anchorEnd += 1;
    }

    if (anchorEnd >= points.length) {
      break;
    }

    const subPoints = points.slice(anchorStart, anchorEnd + 1);
    const timedAnchorStart = subPoints[0];
    const timedAnchorEnd = subPoints.at(-1);

    if (!timedAnchorStart || !timedAnchorEnd) {
      anchorStart = anchorEnd;
      continue;
    }

    const anchorRuntimeS = Math.max(
      0,
      (getPointArrivalMinute(timedAnchorEnd) - getPointDepartureMinute(timedAnchorStart)) * 60
    );
    const segments = buildWindowSegments(
      route,
      train,
      template,
      lineFeatureById,
      subPoints,
      anchorRuntimeS
    );

    const origin = template.stationByIndex.get(points[0]?.routeIndex ?? -1)?.name ?? "";
    const destination = template.stationByIndex.get(points.at(-1)?.routeIndex ?? -1)?.name ?? "";

    windows.push({
      routeId: route.routeId,
      directionId: route.directionId,
      trainId: train.id,
      service: train.name,
      serviceDescriptor: TRAIN_SERVICE_DESCRIPTORS[train.name as TrainType] ?? "service",
      origin,
      destination,
      startMinute: getPointDepartureMinute(timedAnchorStart),
      endMinute: getPointArrivalMinute(timedAnchorEnd),
      segments,
      template,
    });

    anchorStart = anchorEnd;
  }

  return windows;
}

function buildWindowSegments(
  route: TrainAnimationRoute,
  train: TrainAnimationTrain,
  template: RouteTemplate,
  lineFeatureById: Map<string, LineFeature>,
  subPoints: TrainAnimationPoint[],
  anchorRuntimeS: number
) {
  const descriptor = TRAIN_SERVICE_DESCRIPTORS[train.name as TrainType] ?? "service";
  const dynamics = TRAIN_DYNAMICS[SERVICE_TO_DYNAMICS_KEY[train.name as TrainType]];
  const serviceFactor = SERVICE_TYPE_FACTORS[descriptor] ?? SERVICE_TYPE_FACTORS.service;
  const windowSegments = subPoints
    .slice(0, -1)
    .map((fromPoint, index) => {
      const toPoint = subPoints[index + 1];
      const fromStation = template.stationByIndex.get(fromPoint.routeIndex);
      const toStation = template.stationByIndex.get(toPoint.routeIndex);

      if (!fromStation || !toStation) {
        return null;
      }

      const lineId = route.segmentLineIds[fromPoint.routeIndex] ?? toPoint.lineId ?? fromPoint.lineId;
      const lineFeature = lineFeatureById.get(lineId);
      const lineSpeedCapKph = LINE_SPEED_CAPS[lineId] ?? null;
      const trainsetSpeedCapKph = dynamics.capKph;
      const directDistanceM = Math.max(0, toStation.pathDistance - fromStation.pathDistance);
      const dwellS = Math.max(
        0,
        (getPointDepartureMinute(fromPoint) - getPointArrivalMinute(fromPoint)) * 60
      );
      const entrySpeedKph = inferControlPointSpeedKph(
        fromPoint,
        lineSpeedCapKph,
        trainsetSpeedCapKph,
        descriptor
      );
      const exitSpeedKph = inferControlPointSpeedKph(
        toPoint,
        lineSpeedCapKph,
        trainsetSpeedCapKph,
        descriptor
      );

      const freeRunProfile = solveKinematicProfile({
        distanceM: directDistanceM,
        v0: kphToMps(entrySpeedKph),
        v1: kphToMps(exitSpeedKph),
        aEff: dynamics.aEff,
        bEff: dynamics.bEff,
        speedCapMps: kphToMps(Math.min(lineSpeedCapKph ?? dynamics.capKph, dynamics.capKph) * serviceFactor),
      });

      return {
        key: [
          route.routeId,
          route.directionId,
          train.id,
          fromStation.name,
          toStation.name,
        ].join("|"),
        routeId: route.routeId,
        directionId: route.directionId,
        trainId: train.id,
        service: train.name,
        serviceDescriptor: descriptor,
        trainFamily: dynamics.family,
        fromStation: fromStation.name,
        toStation: toStation.name,
        fromKind: fromPoint.kind,
        toKind: toPoint.kind,
        timedAnchorStart: subPoints[0]?.stationName ?? "",
        timedAnchorEnd: subPoints.at(-1)?.stationName ?? "",
        lineId,
        lineName: lineFeature?.properties.name ?? lineId,
        directData: {
          distance_m: directDistanceM,
          anchor_runtime_s: anchorRuntimeS,
          dwell_s: dwellS,
          line_speed_cap_kph: lineSpeedCapKph,
          trainset_speed_cap_kph: trainsetSpeedCapKph,
        },
        inferred: {
          runtime_s: 0,
          entry_speed_kph: entrySpeedKph,
          exit_speed_kph: exitSpeedKph,
          a_eff_mps2: dynamics.aEff,
          b_eff_mps2: dynamics.bEff,
          service_type_factor: serviceFactor,
          reserve_slack_s: 0,
          effective_peak_speed_kph: roundNumber(mpsToKph(freeRunProfile.vPeak), 1),
        },
        schedule: {
          startMinute: 0,
          endMinute: 0,
        },
        distances: {
          pathStart_m: fromStation.pathDistance,
          pathEnd_m: toStation.pathDistance,
        },
        profile: freeRunProfile,
      } satisfies CalibrationTripSegment;
    })
    .filter((segment): segment is CalibrationTripSegment => segment !== null);

  const freeRunTotal = windowSegments.reduce((sum, segment) => sum + segment.profile.runtimeS, 0);
  const slackS = Math.max(0, anchorRuntimeS - freeRunTotal);
  const weightTotal =
    windowSegments.reduce((sum, segment) => sum + buildSlackWeight(segment), 0) || 1;
  let cursorMinute = getPointDepartureMinute(subPoints[0] ?? ({} as TrainAnimationPoint));

  return windowSegments.map((segment) => {
    const reserveSlackS = slackS * (buildSlackWeight(segment) / weightTotal);
    const runtimeS = segment.profile.runtimeS + reserveSlackS;
    const profile = fitProfileToRuntime(segment.profile, runtimeS);
    const startMinute = cursorMinute;
    const endMinute = startMinute + runtimeS / 60;
    cursorMinute = endMinute;

    return {
      ...segment,
      inferred: {
        ...segment.inferred,
        runtime_s: roundNumber(runtimeS, 1),
        reserve_slack_s: roundNumber(reserveSlackS, 1),
        effective_peak_speed_kph: roundNumber(mpsToKph(profile.vPeak), 1),
      },
      schedule: {
        startMinute,
        endMinute,
      },
      profile,
    };
  });
}

function getTrainPositionAtMinute(window: TrainWindow, currentMinute: number) {
  const firstSegment = window.segments[0];
  const lastSegment = window.segments.at(-1);

  if (!firstSegment || !lastSegment) {
    return null;
  }

  if (currentMinute < window.startMinute - 5 || currentMinute > window.endMinute + 5) {
    return null;
  }

  const firstStation =
    window.template.stationByIndex.get(
      window.template.route.stations.findIndex((station) => station.name === firstSegment.fromStation)
    ) ?? window.template.stations[0];
  const lastStation =
    window.template.stationByIndex.get(
      window.template.route.stations.findIndex((station) => station.name === lastSegment.toStation)
    ) ?? window.template.stations.at(-1);

  if (!firstStation || !lastStation) {
    return null;
  }

  if (currentMinute <= window.startMinute) {
    return {
      routeId: window.routeId,
      directionId: window.directionId,
      trainId: window.trainId,
      service: window.service,
      coordinate: firstStation.snappedCoordinate,
      lineId: firstSegment.lineId,
      origin: window.origin,
      destination: window.destination,
      status: `At ${firstSegment.fromStation}`,
    } satisfies CalibrationPosition;
  }

  for (const segment of window.segments) {
    if (currentMinute < segment.schedule.startMinute || currentMinute > segment.schedule.endMinute) {
      continue;
    }

    const elapsedS = (currentMinute - segment.schedule.startMinute) * 60;
    const distanceWithinSegment = distanceAtTime(segment.profile, elapsedS);
    const pathDistance = segment.distances.pathStart_m + distanceWithinSegment;

    return {
      routeId: window.routeId,
      directionId: window.directionId,
      trainId: window.trainId,
      service: window.service,
      coordinate: interpolateAlongPath(
        window.template.pathCoordinates,
        window.template.metrics,
        pathDistance
      ),
      lineId: segment.lineId,
      origin: window.origin,
      destination: window.destination,
      status: `${segment.fromStation} → ${segment.toStation}`,
    } satisfies CalibrationPosition;
  }

  return {
    routeId: window.routeId,
    directionId: window.directionId,
    trainId: window.trainId,
    service: window.service,
    coordinate: lastStation.snappedCoordinate,
    lineId: lastSegment.lineId,
    origin: window.origin,
    destination: window.destination,
    status: `At ${lastSegment.toStation}`,
  } satisfies CalibrationPosition;
}

function buildCombinedRoutePath(
  route: TrainAnimationRoute,
  lineCoordinateMap: Map<string, LatLng[]>
) {
  const pathCoordinates: LatLng[] = [];

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

    const previousCoordinate = pathCoordinates.at(-1);

    if (!previousCoordinate) {
      pathCoordinates.push(...segmentCoordinates);
      continue;
    }

    const nextCoordinates =
      distanceMeters(previousCoordinate, segmentCoordinates[0]) < 1
        ? segmentCoordinates.slice(1)
        : segmentCoordinates;

    pathCoordinates.push(...nextCoordinates);
  }

  return pathCoordinates;
}

function trimLineBetweenStations(coordinates: LatLng[], start: LatLng, end: LatLng) {
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
    return [
      orientedCoordinates[startIndex],
      orientedCoordinates[Math.min(startIndex + 1, orientedCoordinates.length - 1)],
    ];
  }

  return startIndex < endIndex
    ? orientedCoordinates.slice(startIndex, endIndex + 1)
    : [...orientedCoordinates.slice(endIndex, startIndex + 1)].reverse();
}

function buildPathMetrics(coordinates: LatLng[]): PathMetrics {
  const segmentLengths: number[] = [];
  const cumulativeDistances = [0];

  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentLength = distanceMeters(coordinates[index - 1], coordinates[index]);
    segmentLengths.push(segmentLength);
    cumulativeDistances.push(cumulativeDistances[index - 1] + segmentLength);
  }

  return {
    segmentLengths,
    cumulativeDistances,
    totalDistance: cumulativeDistances.at(-1) ?? 0,
  };
}

function projectCoordinateToPath(coordinate: LatLng, pathCoordinates: LatLng[], metrics: PathMetrics) {
  let bestCoordinate = pathCoordinates[0] ?? coordinate;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestDistanceFromStart = 0;

  for (let index = 1; index < pathCoordinates.length; index += 1) {
    const segmentStart = pathCoordinates[index - 1];
    const segmentEnd = pathCoordinates[index];
    const projected = projectPointToSegmentMeters(coordinate, segmentStart, segmentEnd);
    const distance = distanceMeters(coordinate, projected);

    if (distance >= bestDistance) {
      continue;
    }

    bestDistance = distance;
    bestCoordinate = projected;
    bestDistanceFromStart =
      (metrics.cumulativeDistances[index - 1] ?? 0) + distanceMeters(segmentStart, projected);
  }

  return {
    coordinate: bestCoordinate,
    distanceFromStart: bestDistanceFromStart,
  };
}

function interpolateAlongPath(
  pathCoordinates: LatLng[],
  metrics: PathMetrics,
  distanceFromStart: number
) {
  if (!pathCoordinates.length) {
    return [0, 0] satisfies LatLng;
  }

  if (distanceFromStart <= 0) {
    return pathCoordinates[0];
  }

  if (distanceFromStart >= metrics.totalDistance) {
    return pathCoordinates.at(-1) ?? pathCoordinates[0];
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
    return interpolateCoordinate(pathCoordinates[index - 1], pathCoordinates[index], ratio);
  }

  return pathCoordinates.at(-1) ?? pathCoordinates[0];
}

function inferControlPointSpeedKph(
  point: TrainAnimationPoint,
  lineSpeedCapKph: number | null,
  trainsetSpeedCapKph: number,
  descriptor: string
) {
  if (point.kind === "stop" || point.kind === "timed") {
    return 0;
  }

  const cap = Math.min(lineSpeedCapKph ?? trainsetSpeedCapKph, trainsetSpeedCapKph);
  return roundNumber(cap * (PASS_SPEED_FACTORS[descriptor] ?? PASS_SPEED_FACTORS.service), 1);
}

function buildSlackWeight(segment: CalibrationTripSegment) {
  let weight = Math.max(segment.directData.distance_m, 2500);

  if (segment.toKind !== "pass") {
    weight += 1500;
  }

  if (segment.fromKind !== "pass") {
    weight += 750;
  }

  return weight;
}

function solveKinematicProfile({
  distanceM,
  v0,
  v1,
  aEff,
  bEff,
  speedCapMps,
}: {
  distanceM: number;
  v0: number;
  v1: number;
  aEff: number;
  bEff: number;
  speedCapMps: number;
}) {
  const sAccelToCap = Math.max(0, (speedCapMps ** 2 - v0 ** 2) / (2 * aEff));
  const sBrakeFromCap = Math.max(0, (speedCapMps ** 2 - v1 ** 2) / (2 * bEff));

  if (sAccelToCap + sBrakeFromCap <= distanceM) {
    const sCruise = distanceM - sAccelToCap - sBrakeFromCap;
    const tAccel = Math.max(0, (speedCapMps - v0) / aEff);
    const tCruise = speedCapMps > 0 ? sCruise / speedCapMps : 0;
    const tBrake = Math.max(0, (speedCapMps - v1) / bEff);

    return {
      runtimeS: tAccel + tCruise + tBrake,
      distanceM,
      v0,
      v1,
      vPeak: speedCapMps,
      cruiseSpeed: speedCapMps,
      tAccel,
      tCruise,
      tBrake,
      sAccel: sAccelToCap,
      sCruise,
      sBrake: sBrakeFromCap,
    } satisfies KinematicProfile;
  }

  const vPeakSq =
    (2 * aEff * bEff * distanceM + bEff * v0 ** 2 + aEff * v1 ** 2) / (aEff + bEff);
  const vPeak = Math.sqrt(Math.max(vPeakSq, Math.max(v0 ** 2, v1 ** 2)));
  const sAccel = Math.max(0, (vPeak ** 2 - v0 ** 2) / (2 * aEff));
  const sBrake = Math.max(0, (vPeak ** 2 - v1 ** 2) / (2 * bEff));
  const tAccel = Math.max(0, (vPeak - v0) / aEff);
  const tBrake = Math.max(0, (vPeak - v1) / bEff);

  return {
    runtimeS: tAccel + tBrake,
    distanceM,
    v0,
    v1,
    vPeak,
    cruiseSpeed: vPeak,
    tAccel,
    tCruise: 0,
    tBrake,
    sAccel,
    sCruise: 0,
    sBrake,
  } satisfies KinematicProfile;
}

function fitProfileToRuntime(profile: KinematicProfile, runtimeS: number) {
  if (runtimeS <= profile.runtimeS || profile.runtimeS === 0) {
    return {
      ...profile,
      runtimeS,
    };
  }

  const extraRuntime = runtimeS - profile.runtimeS;

  if (profile.sCruise > 0) {
    const tCruise = profile.tCruise + extraRuntime;
    const cruiseSpeed = profile.sCruise > 0 ? profile.sCruise / tCruise : profile.cruiseSpeed;
    const vPeak = Math.max(cruiseSpeed, Math.max(profile.v0, profile.v1));

    return {
      ...profile,
      runtimeS,
      tCruise,
      cruiseSpeed,
      vPeak,
    };
  }

  const scale = runtimeS / profile.runtimeS;
  return {
    ...profile,
    runtimeS,
    tAccel: profile.tAccel * scale,
    tBrake: profile.tBrake * scale,
    cruiseSpeed: profile.vPeak / scale,
    vPeak: profile.vPeak / scale,
  };
}

function distanceAtTime(profile: KinematicProfile, elapsedS: number) {
  if (elapsedS <= 0) {
    return 0;
  }

  if (elapsedS >= profile.runtimeS) {
    return profile.distanceM;
  }

  const accelEnd = profile.tAccel;
  const cruiseEnd = accelEnd + profile.tCruise;

  if (elapsedS <= accelEnd && profile.tAccel > 0) {
    const ratio = elapsedS / profile.tAccel;
    return profile.sAccel * ratio * ratio;
  }

  if (elapsedS <= cruiseEnd && profile.tCruise > 0) {
    const cruiseElapsed = elapsedS - accelEnd;
    return profile.sAccel + profile.cruiseSpeed * cruiseElapsed;
  }

  if (profile.tBrake <= 0) {
    return profile.distanceM;
  }

  const brakeElapsed = elapsedS - cruiseEnd;
  const brakeRatio = clamp(brakeElapsed / profile.tBrake, 0, 1);
  return profile.sAccel + profile.sCruise + profile.sBrake * (1 - (1 - brakeRatio) ** 2);
}

function getPointArrivalMinute(point: TrainAnimationPoint) {
  return point.arrivalMinute ?? point.departureMinute ?? point.passMinute ?? 0;
}

function getPointDepartureMinute(point: TrainAnimationPoint) {
  return point.departureMinute ?? point.arrivalMinute ?? point.passMinute ?? 0;
}

function getRouteKey(routeId: string, directionId: string) {
  return `${routeId}:${directionId}`;
}

function asLatLngTuple(coordinate: number[]) {
  return [coordinate[0] ?? 0, coordinate[1] ?? 0] as LatLng;
}

function orientCoordinatesToStart(coordinates: LatLng[], start: LatLng) {
  const forwardDistance = distanceMeters(coordinates[0], start);
  const reverseDistance = distanceMeters(coordinates[coordinates.length - 1], start);
  return forwardDistance <= reverseDistance ? coordinates : [...coordinates].reverse();
}

function nearestCoordinateIndex(coordinates: LatLng[], target: LatLng) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length; index += 1) {
    const distance = distanceMeters(coordinates[index], target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function distanceMeters(left: LatLng, right: LatLng) {
  const lat1 = degreesToRadians(left[0]);
  const lng1 = degreesToRadians(left[1]);
  const lat2 = degreesToRadians(right[0]);
  const lng2 = degreesToRadians(right[1]);
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function projectPointToSegmentMeters(point: LatLng, start: LatLng, end: LatLng) {
  const referenceLat = degreesToRadians((start[0] + end[0]) / 2);
  const pointXY = toXYMeters(point, referenceLat);
  const startXY = toXYMeters(start, referenceLat);
  const endXY = toXYMeters(end, referenceLat);
  const dx = endXY[0] - startXY[0];
  const dy = endXY[1] - startXY[1];
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return start;
  }

  const t = clamp(
    ((pointXY[0] - startXY[0]) * dx + (pointXY[1] - startXY[1]) * dy) / lengthSquared,
    0,
    1
  );

  const projectedX = startXY[0] + dx * t;
  const projectedY = startXY[1] + dy * t;
  return fromXYMeters([projectedX, projectedY], referenceLat);
}

function interpolateCoordinate(start: LatLng, end: LatLng, ratio: number) {
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ] satisfies LatLng;
}

function toXYMeters(coordinate: LatLng, referenceLatRad: number) {
  const latRad = degreesToRadians(coordinate[0]);
  const lngRad = degreesToRadians(coordinate[1]);
  return [
    EARTH_RADIUS_M * lngRad * Math.cos(referenceLatRad),
    EARTH_RADIUS_M * latRad,
  ] as const;
}

function fromXYMeters(coordinate: readonly [number, number], referenceLatRad: number) {
  return [
    radiansToDegrees(coordinate[1] / EARTH_RADIUS_M),
    radiansToDegrees(coordinate[0] / (EARTH_RADIUS_M * Math.cos(referenceLatRad))),
  ] satisfies LatLng;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function roundNumber(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function kphToMps(value: number) {
  return value / 3.6;
}

function mpsToKph(value: number) {
  return value * 3.6;
}
