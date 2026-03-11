import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const outputPath = path.join(rootDir, "src/data/shinkansen-lines.json")

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]

const GALA_YUZAWA_TERMINAL_NODE_IDS = {
  echigoYuzawa: 3548915150,
  galaYuzawa: 9013930719,
}

const CHUO_SHINKANSEN_RELATION_ID = 12373739
const CHUO_SHINKANSEN_TERMINAL_NODE_IDS = {
  shinagawa: 7792004174,
  nagoya: 8244604803,
}

const HOKKAIDO_EXTENSION_TERMINAL_NODE_IDS = {
  shinHakodateHokuto: 4299276513,
  sapporo: 2662698485,
}

const LINES = [
  {
    id: "tokaido",
    name: "Tokaido",
    queryNames: ["東海道新幹線"],
    terminals: ["東京", "新大阪"],
    color: "#f28c28",
  },
  {
    id: "sanyo",
    name: "Sanyo",
    queryNames: ["山陽新幹線"],
    terminals: ["新大阪", "博多"],
    color: "#0072ce",
  },
  {
    id: "tohoku",
    name: "Tohoku",
    queryNames: ["東北新幹線"],
    terminals: ["東京", "新青森"],
    color: "#4caf50",
  },
  {
    id: "joetsu",
    name: "Joetsu",
    queryNames: ["上越新幹線"],
    terminals: ["大宮", "新潟"],
    terminalCoordinates: [
      [139.6243304, 35.9063869],
      [139.0613294, 37.9122444],
    ],
    color: "#ef5350",
    clipToTerminalCoordinates: true,
  },
  {
    id: "hokuriku",
    name: "Hokuriku",
    queryNames: ["北陸新幹線"],
    terminals: ["高崎", "敦賀"],
    terminalCoordinates: [
      [139.0127191, 36.3223804],
      [136.0763837, 35.644899],
    ],
    color: "#3f51b5",
    clipToTerminalCoordinates: true,
  },
  {
    id: "kyushu",
    name: "Kyushu",
    queryNames: ["九州新幹線"],
    terminals: ["博多", "鹿児島中央"],
    color: "#d81b60",
  },
  {
    id: "chuo",
    name: "Chuo",
    queryNames: [],
    terminals: ["品川", "名古屋"],
    terminalNodeIds: [
      CHUO_SHINKANSEN_TERMINAL_NODE_IDS.shinagawa,
      CHUO_SHINKANSEN_TERMINAL_NODE_IDS.nagoya,
    ],
    color: "#00acc1",
    preferTerminalPath: true,
    minimumPathNodes: 2,
    queryBuilders: [buildChuoShinkansenQuery],
  },
  {
    id: "nishi-kyushu",
    name: "Nishi-Kyushu",
    queryNames: ["西九州新幹線"],
    terminals: ["武雄温泉", "長崎"],
    color: "#ff7043",
  },
  {
    id: "hokkaido",
    name: "Hokkaido",
    queryNames: ["北海道新幹線"],
    terminals: ["新青森", "新函館北斗"],
    color: "#26c6da",
    queryBuilders: [
      () =>
        buildWayRegexQuery(
          [
            "北海道新幹線",
            "北海道新幹線・JR海峡線",
            "青函トンネル",
            "津軽トンネル",
          ],
          ["新青森", "新函館北斗"]
      ),
    ],
  },
  {
    id: "hokkaido-extension",
    name: "Hokkaido Extension",
    queryNames: [],
    terminals: ["新函館北斗", "札幌"],
    terminalCoordinates: [
      [140.647787, 41.905249],
      [141.351103, 43.0683021],
    ],
    terminalNodeIds: [
      HOKKAIDO_EXTENSION_TERMINAL_NODE_IDS.shinHakodateHokuto,
      HOKKAIDO_EXTENSION_TERMINAL_NODE_IDS.sapporo,
    ],
    color: "#80deea",
    preferTerminalPath: true,
    minimumPathNodes: 2,
    queryBuilders: [buildHokkaidoExtensionQuery],
  },
  {
    id: "yamagata",
    name: "Yamagata",
    queryNames: ["山形新幹線"],
    terminals: ["福島", "新庄"],
    color: "#8e24aa",
  },
  {
    id: "akita",
    name: "Akita",
    queryNames: ["秋田新幹線"],
    terminals: ["盛岡", "秋田"],
    color: "#ec407a",
  },
  {
    id: "gala-yuzawa",
    name: "Gala-Yuzawa",
    queryNames: [],
    terminals: ["越後湯沢", "ガーラ湯沢"],
    terminalNodeIds: [
      GALA_YUZAWA_TERMINAL_NODE_IDS.echigoYuzawa,
      GALA_YUZAWA_TERMINAL_NODE_IDS.galaYuzawa,
    ],
    color: "#ffb300",
    preferTerminalPath: true,
    minimumPathNodes: 2,
    queryBuilders: [buildGalaYuzawaQuery],
  },
]

async function main() {
  const requestedLineIds = new Set(
    (process.env.SHINKANSEN_FILTER ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const lines = requestedLineIds.size > 0
    ? LINES.filter((line) => requestedLineIds.has(line.id))
    : LINES
  const features = []
  const existingFeatures = requestedLineIds.size > 0
    ? await readExistingFeatures(requestedLineIds)
    : []

  for (const line of lines) {
    process.stdout.write(`Fetching ${line.name}... `)
    const result = await fetchLine(line)
    features.push(result.feature)
    console.log(
      `ok (${result.meta.sourceName}, ${result.meta.segments} segments, ${result.meta.coordinates} points)`
    )
  }

  await mkdir(path.dirname(outputPath), { recursive: true })

  const collection = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    source: "OpenStreetMap via Overpass API",
    features: [...existingFeatures, ...features].sort(
      (left, right) => lineIndex(left.properties.id) - lineIndex(right.properties.id)
    ),
  }

  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8")
  console.log(`Wrote ${outputPath}`)
}

async function readExistingFeatures(requestedLineIds) {
  try {
    const raw = await readFile(outputPath, "utf8")
    const parsed = JSON.parse(raw)
    const existing = Array.isArray(parsed?.features) ? parsed.features : []

    return existing.filter((feature) => {
      const id = feature?.properties?.id
      return !requestedLineIds.has(id)
    })
  } catch {
    return []
  }
}

function lineIndex(lineId) {
  const index = LINES.findIndex((line) => line.id === lineId)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

async function fetchLine(line) {
  if (Array.isArray(line.queryBuilders) && line.queryBuilders.length > 0) {
    for (const queryBuilder of line.queryBuilders) {
      const data = await fetchOverpass(queryBuilder())
      const feature = await buildFeatureFromElements({ data, line, sourceName: line.name })

      if (feature) {
        return feature
      }
    }
  }

  for (const queryName of line.queryNames) {
    for (const strategy of [buildRelationQuery, buildWayQuery]) {
      const query = strategy(queryName, line)
      const data = await fetchOverpass(query)
      const feature = await buildFeatureFromElements({ data, line, sourceName: queryName })

      if (feature) {
        return feature
      }
    }
  }

  throw new Error(`Unable to resolve ${line.name} from OSM`)
}

function buildRelationQuery(name, line) {
  const terminalQueries = (line.terminals ?? [])
    .map((terminalName, index) => `node["name"="${terminalName}"]->.terminal${index};`)
    .join("\n")
  const terminalSet = (line.terminals ?? [])
    .map((_, index) => `.terminal${index};`)
    .join("\n  ")

  return `
[out:json][timeout:120];
relation["type"="route"]["route"="railway"]["name"="${name}"]->.route;
way(r.route)->.routeWays;
${terminalQueries}
(
  .route;
  .routeWays;
  ${terminalSet}
  node(r.route);
  node(w.routeWays);
);
out body;
`.trim()
}

function buildWayQuery(name) {
  return `
[out:json][timeout:120];
way["railway"="rail"]["name"="${name}"]->.line;
(
  .line;
  node(w.line);
);
out body;
`.trim()
}

function buildWayRegexQuery(names, terminalNames = []) {
  const escapedNames = names.map(escapeOverpassRegex)
  const terminalQueries = terminalNames
    .map((terminalName, index) => `node["name"="${terminalName}"]->.terminal${index};`)
    .join("\n")
  const terminalSet = terminalNames
    .map((_, index) => `.terminal${index};`)
    .join("\n  ")

  return `
[out:json][timeout:120];
(
  way["railway"="rail"][~"^(name|name:ja)$"~"^(${escapedNames.join("|")})$"]->.line;
  ${terminalQueries}
);
(
  .line;
  ${terminalSet}
  node(w.line);
);
out body;
`.trim()
}

function buildChuoShinkansenQuery() {
  return `
[out:json][timeout:120];
relation(${CHUO_SHINKANSEN_RELATION_ID})->.route;
way(r.route)->.routeWays;
node["name"="品川"]->.terminal0;
node["name"="名古屋"]->.terminal1;
(
  .route;
  .routeWays;
  .terminal0;
  .terminal1;
  node(r.route);
  node(w.routeWays);
);
out body;
`.trim()
}

function buildHokkaidoExtensionQuery() {
  return `
[out:json][timeout:120];
node["name"="新函館北斗"]->.terminal0;
node["name"="札幌"]->.terminal1;
way["railway"="construction"][~"^(name|name:ja)$"~"^北海道新幹線$"]->.line;
(
  .line;
  .terminal0;
  .terminal1;
  node(w.line);
);
out body;
`.trim()
}

function buildLocalRailGapQuery({ minLat, minLon, maxLat, maxLon }) {
  return `
[out:json][timeout:120];
(
  way(${minLat},${minLon},${maxLat},${maxLon})["railway"="rail"];
);
(
  ._;
  >;
);
out body;
`.trim()
}

function buildGalaYuzawaQuery() {
  return `
[out:json][timeout:60];
node(${GALA_YUZAWA_TERMINAL_NODE_IDS.echigoYuzawa})->.from;
node(${GALA_YUZAWA_TERMINAL_NODE_IDS.galaYuzawa})->.to;
way(36.92,138.79,36.97,138.83)["railway"="rail"]["gauge"="1435"]["usage"="branch"]->.tracks;
(
  .from;
  .to;
  .tracks;
  node(w.tracks);
);
out body;
`.trim()
}

async function fetchOverpass(query) {
  let lastError

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "user-agent": "shinkansen-live/0.1",
          },
          body: query,
        })

        const body = await response.text()

        if (!response.ok) {
          throw new Error(`${endpoint} responded with ${response.status}: ${body.slice(0, 200)}`)
        }

        if (body.trim().startsWith("<")) {
          throw new Error(`${endpoint} returned a non-JSON response: ${body.slice(0, 200)}`)
        }

        return JSON.parse(body)
      } catch (error) {
        lastError = error
        await delay(750 * attempt)
      }
    }
  }

  throw lastError
}

async function buildFeatureFromElements({ data, line, sourceName }) {
  const elements = data?.elements ?? []
  if (elements.length === 0) {
    return null
  }

  const relation = elements.find((element) => element.type === "relation")
  const allWays = elements.filter((element) => element.type === "way")
  const nodes = new Map(
    elements
      .filter((element) => element.type === "node")
      .map((element) => [element.id, element])
  )

  if (allWays.length === 0) {
    return null
  }

  const orderedWayIds = relation
    ? relation.members
        .filter((member) => member.type === "way" && isTrackMemberRole(member.role))
        .map((member) => member.ref)
    : allWays.map((way) => way.id)

  const seenWayIds = new Set()
  const segments = []

  for (const wayId of orderedWayIds) {
    if (seenWayIds.has(wayId)) {
      continue
    }

    const way = allWays.find((item) => item.id === wayId)
    if (!way || !Array.isArray(way.nodes) || way.nodes.length < 2) {
      continue
    }

    if (!isLineWay(way)) {
      continue
    }

    const coordinates = []
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId)
      if (node) {
        coordinates.push([node.lon, node.lat])
      }
    }

    if (coordinates.length < 2) {
      continue
    }

    seenWayIds.add(wayId)
    segments.push({
      id: way.id,
      order: segments.length,
      nodeIds: dedupeConsecutive(way.nodes),
      coordinates: dedupeConsecutiveCoordinates(coordinates),
    })
  }

  if (segments.length === 0) {
    return null
  }

  const orderedChainCoordinates = buildOrderedChainCoordinates(segments, line, nodes)
  const graph = buildGraph(segments, nodes)
  let pathNodeIds = null

  if (graph.size > 0) {
    const terminalNodeIds =
      resolveConfiguredTerminalNodeIds({ line, graph, nodes }) ??
      resolveTerminalNodeIds({
        relation,
        graph,
        nodes,
        fallbackTerminalNames: line.terminals ?? null,
      })
    const diameterPathNodeIds = approximateLongestComponentPath(graph)

    if (terminalNodeIds) {
      const terminalPathNodeIds = shortestPath(graph, terminalNodeIds.startNodeId, terminalNodeIds.endNodeId)
      pathNodeIds = line.preferTerminalPath
        ? terminalPathNodeIds ?? diameterPathNodeIds
        : pickLongerPath(terminalPathNodeIds, diameterPathNodeIds, nodes)
    } else {
      pathNodeIds = diameterPathNodeIds
    }

    if (!pathNodeIds || pathNodeIds.length < (line.minimumPathNodes ?? 50)) {
      pathNodeIds = diameterPathNodeIds
    }
  }

  if (!pathNodeIds || pathNodeIds.length < 2) {
    pathNodeIds = stitchSegments(segments).nodeIds
  }

  if (!pathNodeIds || pathNodeIds.length < 2) {
    throw new Error(`${line.name} could not be resolved into a continuous path`)
  }

  const graphCoordinates = dedupeConsecutiveCoordinates(
    pathNodeIds
      .map((nodeId) => nodes.get(nodeId))
      .filter(Boolean)
      .map((node) => [node.lon, node.lat])
  )
  let coordinates = shouldUseOrderedChainCoordinates({
    line,
    graphCoordinates,
    orderedChainCoordinates,
  })
    ? orderedChainCoordinates
    : graphCoordinates

  if (line.clipToTerminalCoordinates) {
    coordinates = trimCoordinatesToTerminalCoordinates(
      coordinates,
      resolveConfiguredTerminalCoordinates({ line, nodes })
    )
  }

  const feature = {
    type: "Feature",
    properties: {
      id: line.id,
      name: line.name,
      sourceName,
      color: line.color,
      relationId: relation?.id ?? null,
      terminalFrom: relation?.tags?.from ?? null,
      terminalTo: relation?.tags?.to ?? null,
      trackSegments: segments.length,
      pathNodes: coordinates.length,
      lengthKm: Number(lineLengthKm(coordinates).toFixed(2)),
    },
    geometry: {
      type: "LineString",
      coordinates,
    },
  }

  if (line.id === "yamagata") {
    feature.geometry.coordinates = await fillLargeCoordinateGaps(feature.geometry.coordinates, {
      maxGapKm: 1,
      bboxPaddingDegrees: 0.03,
      allowedServiceTags: new Set(["crossover", "siding"]),
    })
    feature.geometry.coordinates = trimLeadingLoop(feature.geometry.coordinates, {
      maxReturnDistanceKm: 0.05,
      minLoopLengthKm: 0.5,
      minIndex: 4,
    })
    feature.properties.pathNodes = feature.geometry.coordinates.length
    feature.properties.lengthKm = Number(lineLengthKm(feature.geometry.coordinates).toFixed(2))
  }

  if (line.id === "kyushu") {
    feature.geometry.coordinates = await fillLargeCoordinateGaps(feature.geometry.coordinates, {
      maxGapKm: 1,
      bboxPaddingDegrees: 0.04,
      allowedServiceTags: new Set(["crossover", "siding"]),
    })
    feature.properties.pathNodes = feature.geometry.coordinates.length
    feature.properties.lengthKm = Number(lineLengthKm(feature.geometry.coordinates).toFixed(2))
  }

  if (line.id === "hokkaido-extension") {
    feature.geometry.coordinates = ensureStartsNearCoordinate(
      feature.geometry.coordinates,
      line.terminalCoordinates?.[0] ?? null
    )
    feature.properties.pathNodes = feature.geometry.coordinates.length
    feature.properties.lengthKm = Number(lineLengthKm(feature.geometry.coordinates).toFixed(2))
  }

  return {
    feature,
    meta: {
      sourceName,
      segments: segments.length,
      coordinates: coordinates.length,
    },
  }
}

function stitchSegments(segments) {
  const endpointCounts = new Map()
  for (const segment of segments) {
    const first = segment.nodeIds[0]
    const last = segment.nodeIds[segment.nodeIds.length - 1]
    endpointCounts.set(first, (endpointCounts.get(first) ?? 0) + 1)
    endpointCounts.set(last, (endpointCounts.get(last) ?? 0) + 1)
  }

  const unused = new Map(segments.map((segment) => [segment.id, segment]))
  let seed = null

  for (const segment of segments) {
    const first = segment.nodeIds[0]
    const last = segment.nodeIds[segment.nodeIds.length - 1]
    if ((endpointCounts.get(first) ?? 0) === 1 || (endpointCounts.get(last) ?? 0) === 1) {
      seed = segment
      break
    }
  }

  if (!seed) {
    seed = segments[0]
  }

  unused.delete(seed.id)

  const chain = orientSeed(seed, endpointCounts)

  extendChain({
    chain,
    unused,
    endpointSelector: (segment, endpoint) => {
      const start = segment.nodeIds[0]
      const end = segment.nodeIds[segment.nodeIds.length - 1]
      if (end === endpoint) {
        return segment
      }
      if (start === endpoint) {
        return reverseSegment(segment)
      }
      return null
    },
  })

  extendChain({
    chain,
    unused,
    endpointSelector: (segment, endpoint) => {
      const start = segment.nodeIds[0]
      const end = segment.nodeIds[segment.nodeIds.length - 1]
      if (start === endpoint) {
        return segment
      }
      if (end === endpoint) {
        return reverseSegment(segment)
      }
      return null
    },
    prepend: true,
  })

  return {
    nodeIds: chain.nodeIds,
    coordinates: chain.coordinates,
  }
}

function buildOrderedChainCoordinates(segments, line, nodes) {
  if (line.id === "hokkaido-extension") {
    const chains = buildConnectedChains(segments)
    const terminalCoordinates =
      resolveConfiguredTerminalCoordinates({ line, nodes }) ??
      resolveChainTerminalCoordinates(nodes, line.terminals ?? [], chains)

    if (!terminalCoordinates) {
      return null
    }

    return orientCoordinatesToTerminals(
      buildProjectedChainPath(chains, terminalCoordinates),
      terminalCoordinates
    )
  }

  if (!lineUsesOrderedChains(line) && !lineUsesConnectedChains(line)) {
    return null
  }

  const chains = buildOrderedChains(segments)

  if (chains.length === 0) {
    return null
  }

  if (line.id === "tohoku") {
    return buildBestNorthboundChainPath(chains, 2)
  }

  if (line.id === "hokuriku") {
    return buildBestSequentialChainPath(chains, 2)
  }

  if (line.id === "chuo") {
    const coordinates = buildBestSequentialChainPath(chains, 25)

    if (!coordinates) {
      return null
    }

    const terminalCoordinates = resolveChainTerminalCoordinates(nodes, line.terminals ?? [], chains)
    return orientCoordinatesToTerminals(coordinates, terminalCoordinates)
  }

  if (line.id === "akita") {
    const terminalCoordinates = resolveChainTerminalCoordinates(nodes, line.terminals ?? [], chains)

    if (!terminalCoordinates) {
      return null
    }

    return buildBestTerminalConnectedChainPath(chains, {
      ...terminalCoordinates,
      maxGapKm: 5,
      terminalGapKm: 5,
    })
  }

  if (line.id === "kyushu") {
    const terminalCoordinates = resolveChainTerminalCoordinates(nodes, line.terminals ?? [], chains)

    if (!terminalCoordinates) {
      return null
    }

    return buildBestTerminalConnectedChainPath(chains, {
      ...terminalCoordinates,
      maxGapKm: 5,
      terminalGapKm: 5,
    })
  }

  if (line.id === "yamagata") {
    const terminalCoordinates = resolveChainTerminalCoordinates(nodes, line.terminals ?? [], chains)

    if (!terminalCoordinates) {
      return null
    }

    return buildBestTerminalConnectedChainPath(chains, {
      ...terminalCoordinates,
      maxGapKm: 5,
      terminalGapKm: 5,
    })
  }

  return null
}

function lineUsesOrderedChains(line) {
  return new Set(["tohoku", "hokuriku", "akita", "kyushu", "yamagata", "chuo"]).has(line.id)
}

function lineUsesConnectedChains(line) {
  return line.id === "hokkaido-extension"
}

function buildOrderedChains(segments) {
  const chains = []
  let current = null

  for (const originalSegment of segments) {
    let segment = originalSegment

    if (!current) {
      current = {
        segmentIds: [segment.id],
        nodeIds: [...segment.nodeIds],
        coordinates: [...segment.coordinates],
      }
      continue
    }

    const currentStart = current.nodeIds[0]
    const currentEnd = current.nodeIds[current.nodeIds.length - 1]
    const segmentStart = segment.nodeIds[0]
    const segmentEnd = segment.nodeIds[segment.nodeIds.length - 1]

    if (currentEnd === segmentStart) {
      current.nodeIds.push(...segment.nodeIds.slice(1))
      current.coordinates.push(...segment.coordinates.slice(1))
      current.segmentIds.push(segment.id)
      continue
    }

    if (currentEnd === segmentEnd) {
      segment = reverseSegment(segment)
      current.nodeIds.push(...segment.nodeIds.slice(1))
      current.coordinates.push(...segment.coordinates.slice(1))
      current.segmentIds.push(segment.id)
      continue
    }

    if (currentStart === segmentEnd) {
      current.nodeIds.unshift(...segment.nodeIds.slice(0, -1))
      current.coordinates.unshift(...segment.coordinates.slice(0, -1))
      current.segmentIds.unshift(segment.id)
      continue
    }

    if (currentStart === segmentStart) {
      segment = reverseSegment(segment)
      current.nodeIds.unshift(...segment.nodeIds.slice(0, -1))
      current.coordinates.unshift(...segment.coordinates.slice(0, -1))
      current.segmentIds.unshift(segment.id)
      continue
    }

    chains.push(current)
    current = {
      segmentIds: [segment.id],
      nodeIds: [...segment.nodeIds],
      coordinates: [...segment.coordinates],
    }
  }

  if (current) {
    chains.push(current)
  }

  return chains
}

function buildConnectedChains(segments) {
  const nodeToSegmentIds = new Map()

  for (const segment of segments) {
    for (const nodeId of [segment.nodeIds[0], segment.nodeIds[segment.nodeIds.length - 1]]) {
      if (!nodeToSegmentIds.has(nodeId)) {
        nodeToSegmentIds.set(nodeId, [])
      }

      nodeToSegmentIds.get(nodeId).push(segment.id)
    }
  }

  const segmentById = new Map(segments.map((segment) => [segment.id, segment]))
  const visited = new Set()
  const chains = []

  for (const segment of segments) {
    if (visited.has(segment.id)) {
      continue
    }

    const componentSegmentIds = new Set()
    const stack = [segment.id]
    visited.add(segment.id)

    while (stack.length > 0) {
      const currentSegmentId = stack.pop()
      componentSegmentIds.add(currentSegmentId)
      const currentSegment = segmentById.get(currentSegmentId)

      for (const nodeId of [currentSegment.nodeIds[0], currentSegment.nodeIds[currentSegment.nodeIds.length - 1]]) {
        const neighboringSegmentIds = nodeToSegmentIds.get(nodeId) ?? []

        for (const neighboringSegmentId of neighboringSegmentIds) {
          if (visited.has(neighboringSegmentId)) {
            continue
          }

          visited.add(neighboringSegmentId)
          stack.push(neighboringSegmentId)
        }
      }
    }

    const componentSegments = [...componentSegmentIds]
      .map((segmentId) => segmentById.get(segmentId))
      .filter(Boolean)

    const chain = stitchSegments(componentSegments)
    chains.push({
      segmentIds: componentSegments.map((item) => item.id),
      nodeIds: chain.nodeIds,
      coordinates: chain.coordinates,
    })
  }

  return chains
}

function buildProjectedChainPath(chains, terminalCoordinates) {
  if (!Array.isArray(chains) || chains.length === 0) {
    return null
  }

  const startCoordinate = terminalCoordinates.startCoordinate
  const endCoordinate = terminalCoordinates.endCoordinate
  const orientedChains = chains
    .map((chain) => orientChainTowardRoute(chain, startCoordinate, endCoordinate))
    .sort((left, right) => left.startProjection - right.startProjection)

  return dedupeConsecutiveCoordinates(
    orientedChains.flatMap((chain, index) =>
      index === 0 ? chain.coordinates : chain.coordinates.slice(1)
    )
  )
}

function orientChainTowardRoute(chain, routeStartCoordinate, routeEndCoordinate) {
  const forward = {
    coordinates: chain.coordinates,
    startCoordinate: chain.coordinates[0],
    endCoordinate: chain.coordinates[chain.coordinates.length - 1],
  }
  const reverseCoordinates = [...chain.coordinates].reverse()
  const reverse = {
    coordinates: reverseCoordinates,
    startCoordinate: reverseCoordinates[0],
    endCoordinate: reverseCoordinates[reverseCoordinates.length - 1],
  }

  const oriented = scoreChainOrientation(forward, routeStartCoordinate, routeEndCoordinate) <=
      scoreChainOrientation(reverse, routeStartCoordinate, routeEndCoordinate)
    ? forward
    : reverse

  return {
    ...oriented,
    startProjection: routeProjection(oriented.startCoordinate, routeStartCoordinate, routeEndCoordinate),
    endProjection: routeProjection(oriented.endCoordinate, routeStartCoordinate, routeEndCoordinate),
  }
}

function scoreChainOrientation(chain, routeStartCoordinate, routeEndCoordinate) {
  return (
    coordinateDistanceKm(chain.startCoordinate, routeStartCoordinate) +
    coordinateDistanceKm(chain.endCoordinate, routeEndCoordinate) +
    Math.max(
      0,
      routeProjection(chain.startCoordinate, routeStartCoordinate, routeEndCoordinate) -
        routeProjection(chain.endCoordinate, routeStartCoordinate, routeEndCoordinate)
    ) *
      10
  )
}

function routeProjection(coordinate, routeStartCoordinate, routeEndCoordinate) {
  const dx = routeEndCoordinate[0] - routeStartCoordinate[0]
  const dy = routeEndCoordinate[1] - routeStartCoordinate[1]
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return 0
  }

  const px = coordinate[0] - routeStartCoordinate[0]
  const py = coordinate[1] - routeStartCoordinate[1]
  return (px * dx + py * dy) / lengthSquared
}

function buildBestNorthboundChainPath(chains, maxGapKm) {
  const orientedChains = chains
    .map((chain, chainIndex) => orientChainNorthbound(chain, chainIndex))
    .sort((left, right) => left.startLat - right.startLat || left.endLat - right.endLat)

  if (orientedChains.length === 0) {
    return null
  }

  const bestDistance = new Array(orientedChains.length).fill(0)
  const previousIndex = new Array(orientedChains.length).fill(-1)

  for (let index = 0; index < orientedChains.length; index += 1) {
    bestDistance[index] = orientedChains[index].lengthKm

    for (let previous = 0; previous < index; previous += 1) {
      if (!canFollowNorthbound(orientedChains[previous], orientedChains[index], maxGapKm)) {
        continue
      }

      const candidateDistance =
        bestDistance[previous] +
        orientedChains[index].lengthKm +
        coordinateDistanceKm(orientedChains[previous].endCoordinate, orientedChains[index].startCoordinate)

      if (candidateDistance > bestDistance[index]) {
        bestDistance[index] = candidateDistance
        previousIndex[index] = previous
      }
    }
  }

  let bestIndex = 0
  for (let index = 1; index < orientedChains.length; index += 1) {
    if (bestDistance[index] > bestDistance[bestIndex]) {
      bestIndex = index
    }
  }

  const selectedChains = []
  let cursor = bestIndex

  while (cursor !== -1) {
    selectedChains.push(orientedChains[cursor])
    cursor = previousIndex[cursor]
  }

  selectedChains.reverse()

  return dedupeConsecutiveCoordinates(
    selectedChains.flatMap((chain, index) =>
      index === 0 ? chain.coordinates : chain.coordinates.slice(1)
    )
  )
}

function buildBestSequentialChainPath(chains, maxGapKm) {
  if (chains.length === 0) {
    return null
  }

  let coordinates = [...chains[0].coordinates]
  let currentEnd = coordinates[coordinates.length - 1]

  for (let index = 1; index < chains.length; index += 1) {
    const chain = chains[index]
    const forwardGapKm = coordinateDistanceKm(currentEnd, chain.coordinates[0])
    const reversedCoordinates = [...chain.coordinates].reverse()
    const reverseGapKm = coordinateDistanceKm(currentEnd, reversedCoordinates[0])

    const nextCoordinates = forwardGapKm <= reverseGapKm ? chain.coordinates : reversedCoordinates
    const gapKm = Math.min(forwardGapKm, reverseGapKm)

    if (gapKm > maxGapKm) {
      return null
    }

    coordinates = [...coordinates, ...nextCoordinates.slice(1)]
    currentEnd = coordinates[coordinates.length - 1]
  }

  return dedupeConsecutiveCoordinates(coordinates)
}

function buildBestTerminalConnectedChainPath(
  chains,
  { startCoordinate, endCoordinate, maxGapKm, terminalGapKm }
) {
  if (!startCoordinate || !endCoordinate) {
    return null
  }

  const orientedChains = chains.flatMap((chain, chainIndex) => {
    const reversedCoordinates = [...chain.coordinates].reverse()

    return [
      {
        chainIndex,
        coordinates: chain.coordinates,
        startCoordinate: chain.coordinates[0],
        endCoordinate: chain.coordinates[chain.coordinates.length - 1],
        lengthKm: lineLengthKm(chain.coordinates),
      },
      {
        chainIndex,
        coordinates: reversedCoordinates,
        startCoordinate: reversedCoordinates[0],
        endCoordinate: reversedCoordinates[reversedCoordinates.length - 1],
        lengthKm: lineLengthKm(reversedCoordinates),
      },
    ]
  })

  const startCandidates = orientedChains.filter(
    (chain) => coordinateDistanceKm(startCoordinate, chain.startCoordinate) <= terminalGapKm
  )

  if (startCandidates.length === 0) {
    return null
  }

  const cache = new Map()

  function search(chain, usedMask) {
    const cacheKey = `${usedMask}:${chain.chainIndex}:${chain.startCoordinate[0]}:${chain.startCoordinate[1]}`
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)
    }

    let best = null
    const distanceToEndKm = coordinateDistanceKm(chain.endCoordinate, endCoordinate)

    if (distanceToEndKm <= terminalGapKm) {
      best = {
        totalGapKm: distanceToEndKm,
        lengthKm: chain.lengthKm,
        chains: [chain],
      }
    }

    for (const nextChain of orientedChains) {
      if (usedMask & (1 << nextChain.chainIndex)) {
        continue
      }

      const gapKm = coordinateDistanceKm(chain.endCoordinate, nextChain.startCoordinate)
      if (gapKm > maxGapKm) {
        continue
      }

      const candidate = search(nextChain, usedMask | (1 << nextChain.chainIndex))
      if (!candidate) {
        continue
      }

      const candidateGapKm = gapKm + candidate.totalGapKm
      const candidateLengthKm = chain.lengthKm + candidate.lengthKm
      if (
        !best ||
        candidateGapKm < best.totalGapKm - 1e-9 ||
        (Math.abs(candidateGapKm - best.totalGapKm) <= 1e-9 && candidateLengthKm > best.lengthKm)
      ) {
        best = {
          totalGapKm: candidateGapKm,
          lengthKm: candidateLengthKm,
          chains: [chain, ...candidate.chains],
        }
      }
    }

    cache.set(cacheKey, best)
    return best
  }

  let bestPath = null

  for (const startChain of startCandidates) {
    const startGapKm = coordinateDistanceKm(startCoordinate, startChain.startCoordinate)
    const candidate = search(startChain, 1 << startChain.chainIndex)
    if (!candidate) {
      continue
    }

    const candidateGapKm = startGapKm + candidate.totalGapKm
    if (
      !bestPath ||
      candidateGapKm < bestPath.totalGapKm - 1e-9 ||
      (Math.abs(candidateGapKm - bestPath.totalGapKm) <= 1e-9 && candidate.lengthKm > bestPath.lengthKm)
    ) {
      bestPath = {
        totalGapKm: candidateGapKm,
        lengthKm: candidate.lengthKm,
        chains: candidate.chains,
      }
    }
  }

  if (!bestPath) {
    return null
  }

  return dedupeConsecutiveCoordinates(
    bestPath.chains.flatMap((chain, index) =>
      index === 0 ? chain.coordinates : chain.coordinates.slice(1)
    )
  )
}

function orientChainNorthbound(chain, chainIndex) {
  const startCoordinate = chain.coordinates[0]
  const endCoordinate = chain.coordinates[chain.coordinates.length - 1]

  if (startCoordinate[1] <= endCoordinate[1]) {
    return {
      chainIndex,
      coordinates: chain.coordinates,
      startCoordinate,
      endCoordinate,
      startLat: startCoordinate[1],
      endLat: endCoordinate[1],
      lengthKm: lineLengthKm(chain.coordinates),
    }
  }

  const reversedCoordinates = [...chain.coordinates].reverse()

  return {
    chainIndex,
    coordinates: reversedCoordinates,
    startCoordinate: reversedCoordinates[0],
    endCoordinate: reversedCoordinates[reversedCoordinates.length - 1],
    startLat: reversedCoordinates[0][1],
    endLat: reversedCoordinates[reversedCoordinates.length - 1][1],
    lengthKm: lineLengthKm(reversedCoordinates),
  }
}

function resolveChainTerminalCoordinates(nodes, terminalNames, chains = []) {
  if (!Array.isArray(terminalNames) || terminalNames.length < 2) {
    return null
  }

  const candidateNodes = [...nodes.values()].filter((node) => node.tags?.name || node.tags?.["name:ja"])
  const chainEndpoints = chains.flatMap((chain) => [
    chain.coordinates[0],
    chain.coordinates[chain.coordinates.length - 1],
  ])
  const distanceResolver = (node) =>
    nearestCoordinateDistanceKm([node.lon, node.lat], chainEndpoints)
  const startNode = findBestTerminalNode(candidateNodes, terminalNames[0], distanceResolver)
  const endNode = findBestTerminalNode(candidateNodes, terminalNames[1], distanceResolver)

  if (!startNode || !endNode) {
    return null
  }

  return {
    startCoordinate: [startNode.lon, startNode.lat],
    endCoordinate: [endNode.lon, endNode.lat],
  }
}

function canFollowNorthbound(currentChain, nextChain, maxGapKm) {
  if (nextChain.endLat <= currentChain.endLat) {
    return false
  }

  return coordinateDistanceKm(currentChain.endCoordinate, nextChain.startCoordinate) <= maxGapKm
}

function shouldUseOrderedChainCoordinates({ line, graphCoordinates, orderedChainCoordinates }) {
  if (!orderedChainCoordinates || orderedChainCoordinates.length < 2) {
    return false
  }

  const orderedLengthKm = lineLengthKm(orderedChainCoordinates)
  const graphLengthKm = lineLengthKm(graphCoordinates)

  if (line.id === "tohoku") {
    return orderedLengthKm > 600 && orderedLengthKm < 800
  }

  if (line.id === "hokuriku") {
    return orderedLengthKm > 500 && orderedLengthKm < 650
  }

  if (line.id === "chuo") {
    return orderedLengthKm > 250 && orderedLengthKm < 350
  }

  if (line.id === "akita") {
    return orderedLengthKm > 120 && orderedLengthKm < 170
  }

  if (line.id === "kyushu") {
    return orderedLengthKm > 220 && orderedLengthKm < 300
  }

  if (line.id === "gala-yuzawa") {
    return false
  }

  if (line.id === "yamagata") {
    return orderedLengthKm > 130 && orderedLengthKm < 170
  }

  return orderedLengthKm > graphLengthKm * 1.15
}

function extendChain({ chain, unused, endpointSelector, prepend = false }) {
  while (true) {
    const endpoint = prepend ? chain.nodeIds[0] : chain.nodeIds[chain.nodeIds.length - 1]
    const candidates = []

    for (const segment of unused.values()) {
      const oriented = endpointSelector(segment, endpoint)
      if (oriented) {
        candidates.push(oriented)
      }
    }

    if (candidates.length === 0) {
      return
    }

    candidates.sort((left, right) => left.order - right.order)
    const next = candidates[0]
    unused.delete(next.id)

    if (prepend) {
      chain.nodeIds = [...next.nodeIds.slice(0, -1), ...chain.nodeIds]
      chain.coordinates = [...next.coordinates.slice(0, -1), ...chain.coordinates]
      chain.usedSegments = [next.id, ...chain.usedSegments]
    } else {
      chain.nodeIds = [...chain.nodeIds, ...next.nodeIds.slice(1)]
      chain.coordinates = [...chain.coordinates, ...next.coordinates.slice(1)]
      chain.usedSegments.push(next.id)
    }
  }
}

function orientSeed(segment, endpointCounts) {
  const first = segment.nodeIds[0]
  const last = segment.nodeIds[segment.nodeIds.length - 1]

  if ((endpointCounts.get(last) ?? 0) === 1 && (endpointCounts.get(first) ?? 0) !== 1) {
    return {
      nodeIds: [...segment.nodeIds].reverse(),
      coordinates: [...segment.coordinates].reverse(),
      usedSegments: [segment.id],
    }
  }

  return {
    nodeIds: [...segment.nodeIds],
    coordinates: [...segment.coordinates],
    usedSegments: [segment.id],
  }
}

function reverseSegment(segment) {
  return {
    ...segment,
    nodeIds: [...segment.nodeIds].reverse(),
    coordinates: [...segment.coordinates].reverse(),
  }
}

function isTrackMemberRole(role) {
  return role === "" || role === "forward" || role === "backward" || role === "alternate"
}

function isLineWay(way) {
  return !way.tags?.service
}

function buildGraph(segments, nodes) {
  const adjacency = new Map()

  for (const segment of segments) {
    for (let index = 1; index < segment.nodeIds.length; index += 1) {
      const fromId = segment.nodeIds[index - 1]
      const toId = segment.nodeIds[index]
      const fromNode = nodes.get(fromId)
      const toNode = nodes.get(toId)

      if (!fromNode || !toNode || fromId === toId) {
        continue
      }

      const weight = haversineKm(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon)
      addGraphEdge(adjacency, fromId, toId, weight)
      addGraphEdge(adjacency, toId, fromId, weight)
    }
  }

  return adjacency
}

function addGraphEdge(adjacency, fromId, toId, weight) {
  if (!adjacency.has(fromId)) {
    adjacency.set(fromId, [])
  }

  adjacency.get(fromId).push({ toId, weight })
}

function resolveTerminalNodeIds({ relation, graph, nodes, fallbackTerminalNames = null }) {
  const fromName = relation?.tags?.from ?? fallbackTerminalNames?.[0] ?? null
  const toName = relation?.tags?.to ?? fallbackTerminalNames?.[1] ?? null

  if (!fromName || !toName) {
    return null
  }

  const graphNodeIds = [...graph.keys()]
  if (graphNodeIds.length === 0) {
    return null
  }

  const candidateNodes = [...nodes.values()].filter((node) => node.tags?.name || node.tags?.["name:ja"])

  const fromNode = findBestTerminalNode(candidateNodes, fromName, (node) =>
    nearestGraphNode(graphNodeIds, nodes, node).distanceKm
  )
  const toNode = findBestTerminalNode(candidateNodes, toName, (node) =>
    nearestGraphNode(graphNodeIds, nodes, node).distanceKm
  )

  if (!fromNode || !toNode) {
    return null
  }

  const startGraphNode = nearestGraphNode(graphNodeIds, nodes, fromNode)
  const endGraphNode = nearestGraphNode(graphNodeIds, nodes, toNode)

  return {
    startNodeId: startGraphNode.nodeId,
    endNodeId: endGraphNode.nodeId,
  }
}

function resolveConfiguredTerminalNodeIds({ line, graph, nodes }) {
  if (!Array.isArray(line.terminalNodeIds) || line.terminalNodeIds.length < 2) {
    return null
  }

  const [startTerminalNodeId, endTerminalNodeId] = line.terminalNodeIds
  const startTerminalNode = nodes.get(startTerminalNodeId)
  const endTerminalNode = nodes.get(endTerminalNodeId)

  if (!startTerminalNode || !endTerminalNode) {
    return null
  }

  const graphNodeIds = [...graph.keys()]
  if (graphNodeIds.length === 0) {
    return null
  }

  const startGraphNode = nearestGraphNode(graphNodeIds, nodes, startTerminalNode)
  const endGraphNode = nearestGraphNode(graphNodeIds, nodes, endTerminalNode)

  if (!startGraphNode.nodeId || !endGraphNode.nodeId) {
    return null
  }

  return {
    startNodeId: startGraphNode.nodeId,
    endNodeId: endGraphNode.nodeId,
  }
}

function resolveConfiguredTerminalCoordinates({ line, nodes }) {
  if (Array.isArray(line.terminalCoordinates) && line.terminalCoordinates.length >= 2) {
    const [startCoordinate, endCoordinate] = line.terminalCoordinates

    return {
      startCoordinate,
      endCoordinate,
    }
  }

  if (!Array.isArray(line.terminalNodeIds) || line.terminalNodeIds.length < 2) {
    return null
  }

  const [startTerminalNodeId, endTerminalNodeId] = line.terminalNodeIds
  const startTerminalNode = nodes.get(startTerminalNodeId)
  const endTerminalNode = nodes.get(endTerminalNodeId)

  if (!startTerminalNode || !endTerminalNode) {
    return null
  }

  return {
    startCoordinate: [startTerminalNode.lon, startTerminalNode.lat],
    endCoordinate: [endTerminalNode.lon, endTerminalNode.lat],
  }
}

function findBestTerminalNode(memberNodes, terminalName, distanceResolver) {
  const exactMatches = memberNodes.filter((node) => {
    const name = node?.tags?.name ?? node?.tags?.["name:ja"] ?? ""
    return name === terminalName
  })

  const partialMatches = memberNodes.filter((node) => {
    const name = node?.tags?.name ?? node?.tags?.["name:ja"] ?? ""
    return name.includes(terminalName) || terminalName.includes(name)
  })

  const candidates = exactMatches.length > 0 ? exactMatches : partialMatches

  if (candidates.length === 0) {
    return null
  }

  let bestNode = candidates[0]
  let bestDistance = distanceResolver(bestNode)

  for (const candidate of candidates.slice(1)) {
    const distance = distanceResolver(candidate)
    if (distance < bestDistance) {
      bestNode = candidate
      bestDistance = distance
    }
  }

  return bestNode
}

function nearestGraphNode(graphNodeIds, nodes, terminalNode) {
  let nearestNodeId = null
  let shortestDistance = Number.POSITIVE_INFINITY

  for (const nodeId of graphNodeIds) {
    const candidate = nodes.get(nodeId)
    if (!candidate) {
      continue
    }

    const distance = haversineKm(terminalNode.lat, terminalNode.lon, candidate.lat, candidate.lon)
    if (distance < shortestDistance) {
      shortestDistance = distance
      nearestNodeId = nodeId
    }
  }

  return {
    nodeId: nearestNodeId,
    distanceKm: shortestDistance,
  }
}

function orientCoordinatesToTerminals(coordinates, terminalCoordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !terminalCoordinates) {
    return coordinates
  }

  const forwardDistance =
    coordinateDistanceKm(coordinates[0], terminalCoordinates.startCoordinate) +
    coordinateDistanceKm(coordinates[coordinates.length - 1], terminalCoordinates.endCoordinate)
  const reversedCoordinates = [...coordinates].reverse()
  const reverseDistance =
    coordinateDistanceKm(reversedCoordinates[0], terminalCoordinates.startCoordinate) +
    coordinateDistanceKm(reversedCoordinates[reversedCoordinates.length - 1], terminalCoordinates.endCoordinate)

  return forwardDistance <= reverseDistance ? coordinates : reversedCoordinates
}

function trimCoordinatesToTerminalCoordinates(coordinates, terminalCoordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !terminalCoordinates) {
    return coordinates
  }

  const orientedCoordinates = orientCoordinatesToTerminals(coordinates, terminalCoordinates)
  const startIndex = nearestCoordinateIndex(orientedCoordinates, terminalCoordinates.startCoordinate)
  const endIndex = nearestCoordinateIndex(orientedCoordinates, terminalCoordinates.endCoordinate)

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return orientedCoordinates
  }

  return dedupeConsecutiveCoordinates(orientedCoordinates.slice(startIndex, endIndex + 1))
}

function nearestCoordinateIndex(coordinates, targetCoordinate) {
  if (!Array.isArray(coordinates) || coordinates.length === 0 || !targetCoordinate) {
    return -1
  }

  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < coordinates.length; index += 1) {
    const distance = coordinateDistanceKm(coordinates[index], targetCoordinate)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

function ensureStartsNearCoordinate(coordinates, startCoordinate) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !startCoordinate) {
    return coordinates
  }

  const forwardDistance = coordinateDistanceKm(coordinates[0], startCoordinate)
  const reverseDistance = coordinateDistanceKm(coordinates[coordinates.length - 1], startCoordinate)

  return forwardDistance <= reverseDistance ? coordinates : [...coordinates].reverse()
}

function shortestPath(graph, startNodeId, endNodeId) {
  if (!startNodeId || !endNodeId) {
    return null
  }

  const distances = new Map([[startNodeId, 0]])
  const previous = new Map()
  const queue = new MinPriorityQueue()
  queue.push(startNodeId, 0)

  while (!queue.isEmpty()) {
    const current = queue.pop()

    if (!current) {
      break
    }

    if (current.priority > (distances.get(current.value) ?? Number.POSITIVE_INFINITY)) {
      continue
    }

    if (current.value === endNodeId) {
      return rebuildPath(previous, endNodeId)
    }

    const neighbors = graph.get(current.value) ?? []
    for (const neighbor of neighbors) {
      const nextDistance = current.priority + neighbor.weight
      if (nextDistance >= (distances.get(neighbor.toId) ?? Number.POSITIVE_INFINITY)) {
        continue
      }

      distances.set(neighbor.toId, nextDistance)
      previous.set(neighbor.toId, current.value)
      queue.push(neighbor.toId, nextDistance)
    }
  }

  return null
}

function approximateLongestComponentPath(graph) {
  const visited = new Set()
  let bestPath = null
  let bestDistance = -1

  for (const nodeId of graph.keys()) {
    if (visited.has(nodeId)) {
      continue
    }

    const componentNodes = collectComponentNodes(graph, nodeId, visited)
    if (componentNodes.size < 2) {
      continue
    }

    const [seedNodeId] = componentNodes
    const firstSweep = dijkstra(graph, seedNodeId, componentNodes)
    const secondSweep = dijkstra(graph, firstSweep.farthestNodeId, componentNodes)

    if (!secondSweep.farthestNodeId || secondSweep.farthestDistance <= bestDistance) {
      continue
    }

    bestDistance = secondSweep.farthestDistance
    bestPath = rebuildPath(secondSweep.previous, secondSweep.farthestNodeId)
  }

  return bestPath
}

function collectComponentNodes(graph, startNodeId, visited) {
  const componentNodes = new Set()
  const stack = [startNodeId]

  visited.add(startNodeId)

  while (stack.length > 0) {
    const nodeId = stack.pop()
    componentNodes.add(nodeId)

    const neighbors = graph.get(nodeId) ?? []
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.toId)) {
        continue
      }

      visited.add(neighbor.toId)
      stack.push(neighbor.toId)
    }
  }

  return componentNodes
}

function dijkstra(graph, startNodeId, allowedNodes = null) {
  const distances = new Map([[startNodeId, 0]])
  const previous = new Map()
  const queue = new MinPriorityQueue()
  let farthestNodeId = startNodeId
  let farthestDistance = 0

  queue.push(startNodeId, 0)

  while (!queue.isEmpty()) {
    const current = queue.pop()

    if (!current) {
      break
    }

    if (current.priority > (distances.get(current.value) ?? Number.POSITIVE_INFINITY)) {
      continue
    }

    if (current.priority > farthestDistance) {
      farthestDistance = current.priority
      farthestNodeId = current.value
    }

    const neighbors = graph.get(current.value) ?? []
    for (const neighbor of neighbors) {
      if (allowedNodes && !allowedNodes.has(neighbor.toId)) {
        continue
      }

      const nextDistance = current.priority + neighbor.weight
      if (nextDistance >= (distances.get(neighbor.toId) ?? Number.POSITIVE_INFINITY)) {
        continue
      }

      distances.set(neighbor.toId, nextDistance)
      previous.set(neighbor.toId, current.value)
      queue.push(neighbor.toId, nextDistance)
    }
  }

  return {
    distances,
    previous,
    farthestNodeId,
    farthestDistance,
  }
}

function pickLongerPath(pathA, pathB, nodes) {
  if (!pathA) {
    return pathB
  }

  if (!pathB) {
    return pathA
  }

  return pathLengthKmFromNodeIds(pathA, nodes) >= pathLengthKmFromNodeIds(pathB, nodes) ? pathA : pathB
}

function rebuildPath(previous, endNodeId) {
  const path = [endNodeId]
  let cursor = endNodeId

  while (previous.has(cursor)) {
    cursor = previous.get(cursor)
    path.push(cursor)
  }

  return path.reverse()
}

class MinPriorityQueue {
  constructor() {
    this.heap = []
  }

  push(value, priority) {
    this.heap.push({ value, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  pop() {
    if (this.heap.length === 0) {
      return null
    }

    const top = this.heap[0]
    const tail = this.heap.pop()

    if (this.heap.length > 0 && tail) {
      this.heap[0] = tail
      this.bubbleDown(0)
    }

    return top
  }

  isEmpty() {
    return this.heap.length === 0
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.heap[parentIndex].priority <= this.heap[index].priority) {
        return
      }

      ;[this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]]
      index = parentIndex
    }
  }

  bubbleDown(index) {
    const lastIndex = this.heap.length - 1

    while (true) {
      const leftChildIndex = index * 2 + 1
      const rightChildIndex = index * 2 + 2
      let smallestIndex = index

      if (
        leftChildIndex <= lastIndex &&
        this.heap[leftChildIndex].priority < this.heap[smallestIndex].priority
      ) {
        smallestIndex = leftChildIndex
      }

      if (
        rightChildIndex <= lastIndex &&
        this.heap[rightChildIndex].priority < this.heap[smallestIndex].priority
      ) {
        smallestIndex = rightChildIndex
      }

      if (smallestIndex === index) {
        return
      }

      ;[this.heap[index], this.heap[smallestIndex]] = [this.heap[smallestIndex], this.heap[index]]
      index = smallestIndex
    }
  }
}

function dedupeConsecutive(values) {
  return values.filter((value, index) => index === 0 || value !== values[index - 1])
}

function escapeOverpassRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function dedupeConsecutiveCoordinates(coordinates) {
  return coordinates.filter(([lon, lat], index) => {
    if (index === 0) {
      return true
    }

    const [previousLon, previousLat] = coordinates[index - 1]
    return lon !== previousLon || lat !== previousLat
  })
}

function coordinateDistanceKm(left, right) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY
  }

  return haversineKm(left[1], left[0], right[1], right[0])
}

function nearestCoordinateDistanceKm(coordinate, coordinates) {
  if (!coordinate || !Array.isArray(coordinates) || coordinates.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  let shortestDistance = Number.POSITIVE_INFINITY

  for (const candidate of coordinates) {
    const distance = coordinateDistanceKm(coordinate, candidate)
    if (distance < shortestDistance) {
      shortestDistance = distance
    }
  }

  return shortestDistance
}

async function fillLargeCoordinateGaps(
  coordinates,
  { maxGapKm, bboxPaddingDegrees, allowedServiceTags = new Set() }
) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return coordinates
  }

  const refinedCoordinates = [coordinates[0]]

  for (let index = 1; index < coordinates.length; index += 1) {
    const startCoordinate = refinedCoordinates[refinedCoordinates.length - 1]
    const endCoordinate = coordinates[index]
    const gapKm = coordinateDistanceKm(startCoordinate, endCoordinate)

    if (gapKm <= maxGapKm) {
      refinedCoordinates.push(endCoordinate)
      continue
    }

    const bridgedCoordinates = await findLocalRailBridgeCoordinates({
      startCoordinate,
      endCoordinate,
      bboxPaddingDegrees,
      allowedServiceTags,
    })

    if (bridgedCoordinates && bridgedCoordinates.length > 1) {
      refinedCoordinates.push(...bridgedCoordinates.slice(1))
      continue
    }

    refinedCoordinates.push(endCoordinate)
  }

  return dedupeConsecutiveCoordinates(refinedCoordinates)
}

async function findLocalRailBridgeCoordinates({
  startCoordinate,
  endCoordinate,
  bboxPaddingDegrees,
  allowedServiceTags,
}) {
  const minLat = Math.min(startCoordinate[1], endCoordinate[1]) - bboxPaddingDegrees
  const maxLat = Math.max(startCoordinate[1], endCoordinate[1]) + bboxPaddingDegrees
  const minLon = Math.min(startCoordinate[0], endCoordinate[0]) - bboxPaddingDegrees
  const maxLon = Math.max(startCoordinate[0], endCoordinate[0]) + bboxPaddingDegrees
  const data = await fetchOverpass(buildLocalRailGapQuery({ minLat, minLon, maxLat, maxLon }))
  const elements = data?.elements ?? []
  const nodes = new Map(
    elements
      .filter((element) => element.type === "node")
      .map((element) => [element.id, element])
  )
  const ways = elements.filter((element) => element.type === "way")
  const segments = ways
    .filter((way) => {
      if (!Array.isArray(way.nodes) || way.nodes.length < 2) {
        return false
      }

      return !way.tags?.service || allowedServiceTags.has(way.tags.service)
    })
    .map((way) => ({
      id: way.id,
      nodeIds: dedupeConsecutive(way.nodes),
      coordinates: dedupeConsecutiveCoordinates(
        way.nodes
          .map((nodeId) => nodes.get(nodeId))
          .filter(Boolean)
          .map((node) => [node.lon, node.lat])
      ),
    }))
    .filter((segment) => segment.coordinates.length >= 2)

  if (segments.length === 0) {
    return null
  }

  const graph = buildGraph(segments, nodes)
  const graphNodeIds = [...graph.keys()]
  if (graphNodeIds.length === 0) {
    return null
  }

  const startGraphNode = nearestGraphNode(graphNodeIds, nodes, {
    lat: startCoordinate[1],
    lon: startCoordinate[0],
  })
  const endGraphNode = nearestGraphNode(graphNodeIds, nodes, {
    lat: endCoordinate[1],
    lon: endCoordinate[0],
  })

  if (startGraphNode.distanceKm > 0.5 || endGraphNode.distanceKm > 0.5) {
    return null
  }

  const pathNodeIds = shortestPath(graph, startGraphNode.nodeId, endGraphNode.nodeId)
  if (!pathNodeIds || pathNodeIds.length < 2) {
    return null
  }

  const bridgedCoordinates = dedupeConsecutiveCoordinates(
    pathNodeIds
      .map((nodeId) => nodes.get(nodeId))
      .filter(Boolean)
      .map((node) => [node.lon, node.lat])
  )

  if (bridgedCoordinates.length < 2) {
    return null
  }

  return bridgedCoordinates
}

function trimLeadingLoop(
  coordinates,
  { maxReturnDistanceKm, minLoopLengthKm, minIndex }
) {
  if (!Array.isArray(coordinates) || coordinates.length <= minIndex) {
    return coordinates
  }

  let traversedKm = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    traversedKm += coordinateDistanceKm(coordinates[index - 1], coordinates[index])

    if (index < minIndex || traversedKm < minLoopLengthKm) {
      continue
    }

    if (coordinateDistanceKm(coordinates[0], coordinates[index]) <= maxReturnDistanceKm) {
      return coordinates.slice(index)
    }
  }

  return coordinates
}

function lineLengthKm(coordinates) {
  let total = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    const [lon1, lat1] = coordinates[index - 1]
    const [lon2, lat2] = coordinates[index]
    total += haversineKm(lat1, lon1, lat2, lon2)
  }

  return total
}

function pathLengthKmFromNodeIds(nodeIds, nodes) {
  let total = 0

  for (let index = 1; index < nodeIds.length; index += 1) {
    const previousNode = nodes.get(nodeIds[index - 1])
    const currentNode = nodes.get(nodeIds[index])

    if (!previousNode || !currentNode) {
      continue
    }

    total += haversineKm(previousNode.lat, previousNode.lon, currentNode.lat, currentNode.lon)
  }

  return total
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

await main()
