import Link from "next/link";
import timetableData from "@/data/shinkansen-timetables.json";
import { StatusView } from "@/components/status-view";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TimetableLineSection } from "@/components/timetable-line-section";
import { TimetableServiceInfo } from "@/components/timetable-service-info";
import {
  TRAIN_SERVICE_GROUPS,
  TRAIN_TYPES,
  normalizeTrainServiceName,
  type TrainType,
} from "@/lib/shinkansen-services";
import { ArrowLeft, Globe, Train } from "lucide-react";

type TimetableDataset = typeof timetableData;
type Language = "en" | "ja";
type ViewMode = "status" | "timetable";
type TimetableRow = {
  kind: "meta" | "station" | "trainIdentifier";
  label: string;
  values: string[];
};
type RenderLine = {
  lineId: string;
  lineName: string;
  lineCodes: string[];
  directions: {
    directionId: string;
    directionLabel: string;
    mergedDirection: ReturnType<typeof normalizeDirection>;
  }[];
};
type ServiceActivityWindow = {
  service: TrainType;
  startMinute: number;
  endMinute: number;
};

// Format the schedule date for display in both languages
const scheduleDate = timetableData.date; // e.g. "2026-03-10"
const [schedYear, schedMonth, schedDay] = scheduleDate.split("-");
const schedDateEn = new Date(`${scheduleDate}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const schedDateJa = `${schedYear}年${Number(schedMonth)}月${Number(schedDay)}日`;

const UI_LABELS = {
  en: {
    title: "Shinkansen Timetable",
    description:
      `Shinkansen timetable for ${schedDateEn}. All directions and lines displayed in full, with source pages merged into one table.`,
    source: "Source",
    lineCode: "Line code",
    mergedPages: "source pages merged into one table below",
    trainName: "Train name",
    issue: "Issue",
    vehicleModel: "Vehicle model",
    noteOnServiceDates: "Note on service dates",
    operatingDays: "Operating days",
    english: "English",
    japanese: "Japanese",
    language: "Language",
    backToMap: "Back to map",
    status: "Status",
    timetable: "Timetable",
    statusHeading: "Shinkansen Status",
    statusDescription:
      "Live JR Cyber Station service data. Refresh to pull the latest line and train status.",
    networkOverview: "Network overview",
    liveSource: "Live source",
    selectLine: "Select a line",
    inbound: "Inbound",
    outbound: "Outbound",
    search: "Search",
    refresh: "Refresh",
    refreshing: "Refreshing",
    updatedAt: "Updated",
    noTrainStatuses: "No live train statuses are available for this selection.",
    trainStatus: "Status",
    update: "Update",
    timetableActivityTitle: "Service activity",
    timetableActivityDescription:
      "Current JST snapshot derived from the March 10, 2026 timetable data shown below.",
    activeFromTimetable: "active services",
    timetableBasis: "March 10 timetable",
    jst: "JST",
    serviceUnit: "services",
  },
  ja: {
    title: "新幹線時刻表",
    description:
      `${schedDateJa}の新幹線時刻表です。全路線・全方向を表示し、複数ページを1つの表にまとめています。`,
    source: "出典",
    lineCode: "路線コード",
    mergedPages: "ページ分を1つの表に統合して表示",
    trainName: "列車名",
    issue: "号",
    vehicleModel: "車両型式",
    noteOnServiceDates: "運行日注意",
    operatingDays: "運転曜日",
    english: "English",
    japanese: "日本語",
    language: "Language",
    backToMap: "地図に戻る",
    status: "運行状況",
    timetable: "時刻表",
    statusHeading: "新幹線運行状況",
    statusDescription: "JR CYBER STATIONの最新運行データです。更新ボタンで再取得できます。",
    networkOverview: "路線一覧",
    liveSource: "参照元",
    selectLine: "路線を選択",
    inbound: "上り",
    outbound: "下り",
    search: "検索",
    refresh: "更新",
    refreshing: "更新中",
    updatedAt: "取得時刻",
    noTrainStatuses: "この条件では運転情報がありません。",
    trainStatus: "状態",
    update: "更新",
    timetableActivityTitle: "列車種別の運行状況",
    timetableActivityDescription:
      "下記の2026年3月10日時刻表データをもとに、現在のJST時刻で走行中の本数を集計しています。",
    activeFromTimetable: "運転中",
    timetableBasis: "3月10日時刻表",
    jst: "JST",
    serviceUnit: "種別",
  },
} satisfies Record<Language, Record<string, string>>;


const LINE_NAME_TRANSLATIONS: Record<string, string> = {
  "東海道・山陽・九州新幹線": "Tokaido, Sanyo and Kyushu Shinkansen",
  "東海道新幹線・山陽新幹線": "Tokaido Shinkansen and Sanyo Shinkansen",
  "東北新幹線・北海道新幹線": "Tohoku Shinkansen and Hokkaido Shinkansen",
  山形新幹線: "Yamagata Shinkansen",
  秋田新幹線: "Akita Shinkansen",
  上越新幹線: "Joetsu Shinkansen",
  北陸新幹線: "Hokuriku Shinkansen",
  "山陽新幹線・九州新幹線": "Sanyo Shinkansen and Kyushu Shinkansen",
  西九州新幹線: "Nishi-Kyushu Shinkansen",
};

const DIRECTION_TRANSLATIONS: Record<string, string> = {
  "下り（鹿児島中央方面）": "Downbound (towards Kagoshima-Chuo)",
  "下り（博多方面）": "Downbound (towards Hakata)",
  "上り（東京方面）": "Upbound (towards Tokyo)",
  "下り（新函館北斗方面）": "Downbound (towards Shin-Hakodate-Hokuto)",
  "下り（新庄方面）": "Downbound (towards Shinjo)",
  "下り（秋田方面）": "Downbound (towards Akita)",
  "下り（新潟方面）": "Downbound (towards Niigata)",
  "下り（敦賀方面）": "Downbound (towards Tsuruga)",
  "上り（新大阪方面）": "Upbound (towards Shin-Osaka)",
  "下り（長崎方面）": "Downbound (towards Nagasaki)",
  "上り（武雄温泉方面）": "Upbound (towards Takeo-Onsen)",
};

const TRAIN_NAME_TRANSLATIONS: Record<string, string> = {
  Asama: "あさま",
  Hakutaka: "はくたか",
  Hayabusa: "はやぶさ",
  Hayate: "はやて",
  Hikari: "ひかり",
  "Hikari Rail Star": "ひかりレールスター",
  Kagayaki: "かがやき",
  Kamome: "かもめ",
  Kodama: "こだま",
  Komachi: "こまち",
  Mizuho: "みずほ",
  Nasuno: "なすの",
  Nozomi: "のぞみ",
  Sakura: "さくら",
  Tanigawa: "たにがわ",
  Toki: "とき",
  Tsubame: "つばめ",
  Tsubasa: "つばさ",
  Tsurugi: "つるぎ",
  Yamabiko: "やまびこ",
};

const SERVICE_GROUP_LABELS: Record<string, Record<Language, string>> = {
  "tokaido-sanyo-kyushu": {
    en: "Tokaido + Sanyo + Kyushu",
    ja: "東海道・山陽・九州",
  },
  "nishi-kyushu": {
    en: "Nishi Kyushu",
    ja: "西九州",
  },
  "tohoku-hokkaido-akita-yamagata": {
    en: "Tohoku + Hokkaido + Akita + Yamagata",
    ja: "東北・北海道・秋田・山形",
  },
  "joetsu-gala-yuzawa": {
    en: "Joetsu + Gala Yuzawa",
    ja: "上越・ガーラ湯沢",
  },
  hokuriku: {
    en: "Hokuriku",
    ja: "北陸",
  },
};

const STATION_TRANSLATIONS: Record<string, string> = {
  いわて沼宮内: "Iwate-Numakunai",
  かみのやま温泉: "Kaminoyama-Onsen",
  くりこま高原: "Kurikoma-Kogen",
  さくらんぼ東根: "Sakurambo-Higashine",
  ガーラ湯沢: "Gala-Yuzawa",
  一ノ関: "Ichinoseki",
  七戸十和田: "Shichinohe-Towada",
  三原: "Mihara",
  三島: "Mishima",
  三河安城: "Mikawa-Anjo",
  上毛高原: "Jomo-Kogen",
  上田: "Ueda",
  上越妙高: "Joetsumyoko",
  上野: "Ueno",
  久留米: "Kurume",
  二戸: "Ninohe",
  京都: "Kyoto",
  仙台: "Sendai",
  佐久平: "Sakudaira",
  八戸: "Hachinohe",
  出水: "Izumi",
  加賀温泉: "Kagaonsen",
  北上: "Kitakami",
  博多: "Hakata",
  厚狭: "Asa",
  古川: "Furukawa",
  名古屋: "Nagoya",
  品川: "Shinagawa",
  大宮: "Omiya",
  大曲: "Omagari",
  大石田: "Oishida",
  天童: "Tendo",
  奥津軽いまべつ: "Okutsugaru-Imabetsu",
  姫路: "Himeji",
  嬉野温泉: "Ureshino-Onsen",
  宇都宮: "Utsunomiya",
  安中榛名: "Annaka-Haruna",
  富山: "Toyama",
  小倉: "Kokura",
  小山: "Oyama",
  小松: "Komatsu",
  小田原: "Odawara",
  山形: "Yamagata",
  岐阜羽島: "Gifu-Hashima",
  岡山: "Okayama",
  川内: "Sendai",
  広島: "Hiroshima",
  徳山: "Tokuyama",
  掛川: "Kakegawa",
  敦賀: "Tsuruga",
  新下関: "Shin-Shimonoseki",
  新倉敷: "Shin-Kurashiki",
  新八代: "Shin-Yatsushiro",
  新函館北斗: "Shin-Hakodate-Hokuto",
  新大村: "Shin-Omura",
  新大牟田: "Shin-Omuta",
  新大阪: "Shin-Osaka",
  新富士: "Shin-Fuji",
  新尾道: "Shin-Onomichi",
  新山口: "Shin-Yamaguchi",
  新岩国: "Shin-Iwakuni",
  新庄: "Shinjo",
  新横浜: "Shin-Yokohama",
  新水俣: "Shin-Minamata",
  新潟: "Niigata",
  新玉名: "Shin-Tamana",
  新白河: "Shin-Shirakawa",
  新神戸: "Shin-Kobe",
  新花巻: "Shin-Hanamaki",
  新青森: "Shin-Aomori",
  新高岡: "Shin-Takaoka",
  新鳥栖: "Shin-Tosu",
  木古内: "Kikonai",
  本庄早稲田: "Honjo-Waseda",
  村山: "Murayama",
  東京: "Tokyo",
  東広島: "Higashi-Hiroshima",
  武雄温泉: "Takeo-Onsen",
  水沢江刺: "Mizusawa-Esashi",
  浜松: "Hamamatsu",
  浦佐: "Urasa",
  熊本: "Kumamoto",
  熊谷: "Kumagaya",
  熱海: "Atami",
  燕三条: "Tsubame-Sanjo",
  田沢湖: "Tazawako",
  白石蔵王: "Shiroishi-Zao",
  盛岡: "Morioka",
  相生: "Aioi",
  福井: "Fukui",
  福山: "Fukuyama",
  福島: "Fukushima",
  秋田: "Akita",
  筑後船小屋: "Chikugo-Funagoya",
  米原: "Maibara",
  米沢: "Yonezawa",
  糸魚川: "Itoigawa",
  芦原温泉: "Awaraonsen",
  西明石: "Nishi-Akashi",
  角館: "Kakunodate",
  諫早: "Isahaya",
  豊橋: "Toyohashi",
  赤湯: "Akayu",
  越前たけふ: "Echizen-Takefu",
  越後湯沢: "Echigo-Yuzawa",
  軽井沢: "Karuizawa",
  那須塩原: "Nasu-Shiobara",
  郡山: "Koriyama",
  金沢: "Kanazawa",
  長岡: "Nagaoka",
  長崎: "Nagasaki",
  長野: "Nagano",
  雫石: "Shizukuishi",
  静岡: "Shizuoka",
  飯山: "Iiyama",
  高崎: "Takasaki",
  高畠: "Takahata",
  鹿児島中央: "Kagoshima-Chuo",
  黒部宇奈月温泉: "Kurobe-Unazukionsen",
};

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const language: Language = resolvedSearchParams.lang === "ja" ? "ja" : "en";
  const view: ViewMode =
    resolvedSearchParams.view === "status" ? "status" : "timetable";
  const labels = UI_LABELS[language];
  const data = timetableData as TimetableDataset;
  const lines = buildRenderableLines(data.lines);
  const timetableServiceWindows = buildTimetableServiceWindows(lines);
  const timetableServiceGroups = TRAIN_SERVICE_GROUPS.map((group) => ({
    id: group.id,
    label: translateServiceGroupLabel(group.id, language),
    services: group.services.map((service) => ({
      id: service,
      label: translateTrainName(service, language),
    })),
  }));
  const makeTimetableHref = (nextView: ViewMode, nextLanguage: Language) =>
    `/timetable?lang=${nextLanguage}&view=${nextView}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {labels.backToMap}
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Train className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold tracking-tight sm:text-base">{labels.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
              <Link
                href={makeTimetableHref("status", language)}
                className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                  view === "status"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels.status}
              </Link>
              <Link
                href={makeTimetableHref("timetable", language)}
                className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                  view === "timetable"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels.timetable}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
                <Link
                  href={makeTimetableHref(view, "en")}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    language === "en"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {labels.english}
                </Link>
                <Link
                  href={makeTimetableHref(view, "ja")}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                    language === "ja"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {labels.japanese}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {view === "timetable" ? (
          <>
            {/* Description */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">{labels.description}</p>
            </div>

            <TimetableServiceInfo
              groups={timetableServiceGroups}
              serviceWindows={timetableServiceWindows}
              labels={{
                title: labels.timetableActivityTitle,
                description: labels.timetableActivityDescription,
                jst: labels.jst,
                activeServices: labels.activeFromTimetable,
                basedOnTimetable: labels.timetableBasis,
                serviceUnit: labels.serviceUnit,
              }}
            />

            {/* Line jump nav */}
            <ScrollArea className="mb-8 w-full">
              <div className="flex gap-1.5 pb-2">
                {lines.map((line) => (
                  <a
                    key={line.lineId}
                    href={`#line-${line.lineId}`}
                    className="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {translateLineName(line.lineName, language)}
                  </a>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <Separator className="mb-8" />

            {/* Lines */}
            <div className="space-y-14">
              {lines.map((line) => (
                <TimetableLineSection
                  key={line.lineId}
                  lineId={line.lineId}
                  lineName={translateLineName(line.lineName, language)}
                  lineCodes={line.lineCodes}
                  directions={line.directions.map((direction) => ({
                    directionId: direction.directionId,
                    directionLabel: translateDirection(direction.directionLabel, language),
                    rows: buildDirectionRows({
                      mergedDirection: direction.mergedDirection,
                      language,
                      labels,
                    }),
                  }))}
                />
              ))}
            </div>
          </>
        ) : (
          <StatusView
            language={language}
            labels={{
              statusHeading: labels.statusHeading,
              statusDescription: labels.statusDescription,
              networkOverview: labels.networkOverview,
              liveSource: labels.liveSource,
              selectLine: labels.selectLine,
              inbound: labels.inbound,
              outbound: labels.outbound,
              search: labels.search,
              refresh: labels.refresh,
              refreshing: labels.refreshing,
              updatedAt: labels.updatedAt,
              noTrainStatuses: labels.noTrainStatuses,
              trainName: labels.trainName,
              trainStatus: labels.trainStatus,
              update: labels.update,
            }}
          />
        )}
      </div>
    </div>
  );
}

function translateLineName(value: string, language: Language) {
  if (language === "ja") return value;
  return LINE_NAME_TRANSLATIONS[value] ?? value;
}

function normalizeDirection(
  direction: TimetableDataset["lines"][number]["directions"][number]
) {
  return {
    trains: direction.trains.map((train) => ({
      ...train,
      name: normalizeTrainServiceName(train.name, train.number),
    })),
    stations: direction.stations,
  };
}

function buildRenderableLines(lines: TimetableDataset["lines"]): RenderLine[] {
  const combinedLine = buildCombinedWesternLine(lines);
  const remainingLines = lines
    .filter((line) => !["601", "901"].includes(line.lineId))
    .map((line) => ({
      lineId: line.lineId,
      lineName: line.lineName,
      lineCodes: [line.lineId],
      directions: line.directions.map((direction) => ({
        directionId: direction.directionId,
        directionLabel: direction.directionLabel,
        mergedDirection: postProcessDirection({
          lineId: line.lineId,
          directionId: direction.directionId,
          mergedDirection: normalizeDirection(direction),
        }),
      })),
    }));

  return combinedLine ? [combinedLine, ...remainingLines] : remainingLines;
}

function buildCombinedWesternLine(lines: TimetableDataset["lines"]): RenderLine | null {
  const tokaidoSanyo = lines.find((line) => line.lineId === "601");
  const sanyoKyushu = lines.find((line) => line.lineId === "901");

  if (!tokaidoSanyo || !sanyoKyushu) {
    return null;
  }

  const downbound601 = tokaidoSanyo.directions.find((direction) => direction.directionId === "0");
  const upbound601 = tokaidoSanyo.directions.find((direction) => direction.directionId === "1");
  const downbound901 = sanyoKyushu.directions.find((direction) => direction.directionId === "0");
  const upbound901 = sanyoKyushu.directions.find((direction) => direction.directionId === "1");

  if (!downbound601 || !upbound601 || !downbound901 || !upbound901) {
    return null;
  }

  return {
    lineId: "601-901",
    lineName: "東海道・山陽・九州新幹線",
    lineCodes: ["601", "901"],
    directions: [
      {
        directionId: "0",
        directionLabel: "下り（鹿児島中央方面）",
        mergedDirection: dedupeMergedDirectionByIdentifier(
          mergeMergedDirections([
            normalizeDirection(downbound601),
            normalizeDirection(downbound901),
          ])
        ),
      },
      {
        directionId: "1",
        directionLabel: "上り（東京方面）",
        mergedDirection: dedupeMergedDirectionByIdentifier(
          mergeMergedDirections([
            normalizeDirection(upbound901),
            normalizeDirection(upbound601),
          ])
        ),
      },
    ],
  };
}

function postProcessDirection({
  lineId,
  directionId,
  mergedDirection,
}: {
  lineId: string;
  directionId: string;
  mergedDirection: ReturnType<typeof normalizeDirection>;
}) {
  if (lineId === "101" && directionId === "1") {
    return removeTrainByIdentifier(mergedDirection, "Komachi-32");
  }

  return mergedDirection;
}

function mergeMergedDirections(
  directions: ReturnType<typeof normalizeDirection>[]
): ReturnType<typeof normalizeDirection> {
  const stationOrder: string[] = [];
  const seenStations = new Set<string>();

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
      if (targetIndex === undefined) continue;

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

function firstTimeValue(values: string[]) {
  for (const value of values) {
    if (/^\d{2}:\d{2}/.test(value)) {
      return value;
    }
  }

  return "99:99";
}

function dedupeMergedDirectionByIdentifier(
  mergedDirection: ReturnType<typeof normalizeDirection>
): ReturnType<typeof normalizeDirection> {
  const groupedIndexes = new Map<string, number[]>();

  mergedDirection.trains.forEach((train, index) => {
    const identifier = trainIdentifierKey(train);
    const key = identifier === "-" ? `__blank__${index}` : identifier;

    if (!groupedIndexes.has(key)) {
      groupedIndexes.set(key, []);
    }

    groupedIndexes.get(key)!.push(index);
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

function buildMergedTrainColumn(
  mergedDirection: ReturnType<typeof normalizeDirection>,
  indexes: number[]
) {
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
      pickRicherValue(
        rankedIndexes.map((index) => station.times[index] ?? "")
      )
    ),
  };
}

function trainColumnScore(
  mergedDirection: ReturnType<typeof normalizeDirection>,
  index: number
) {
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

function mergeTrainMetadata(
  current: ReturnType<typeof createEmptyTrain>,
  candidate: ReturnType<typeof createEmptyTrain>
) {
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

function pickRicherValue(values: string[]) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return "";
}

function removeTrainByIdentifier(
  mergedDirection: ReturnType<typeof normalizeDirection>,
  identifierToRemove: string
): ReturnType<typeof normalizeDirection> {
  const keepIndexes = mergedDirection.trains
    .map((train, index) => ({ train, index }))
    .filter(({ train }) => trainIdentifierKey(train) !== identifierToRemove)
    .map(({ index }) => index);

  return pickTrainIndexes(mergedDirection, keepIndexes);
}

function pickTrainIndexes(
  mergedDirection: ReturnType<typeof normalizeDirection>,
  indexes: number[]
): ReturnType<typeof normalizeDirection> {
  return {
    trains: indexes.map((index) => mergedDirection.trains[index]),
    stations: mergedDirection.stations.map((station) => ({
      stationName: station.stationName,
      times: indexes.map((index) => station.times[index] ?? ""),
    })),
  };
}

function buildDirectionRows({
  mergedDirection,
  language,
  labels,
}: {
  mergedDirection: ReturnType<typeof normalizeDirection>;
  language: Language;
  labels: (typeof UI_LABELS)[Language];
}): TimetableRow[] {
  return [
    {
      kind: "trainIdentifier",
      label: labels.trainName,
      values: mergedDirection.trains.map((train) => formatTrainIdentifier(train, language)),
    },
    {
      kind: "meta",
      label: labels.vehicleModel,
      values: mergedDirection.trains.map((train) =>
        translateValue(train.vehicleType, language)
      ),
    },
    {
      kind: "meta",
      label: labels.noteOnServiceDates,
      values: mergedDirection.trains.map((train) => translateValue(train.caution, language)),
    },
    {
      kind: "meta",
      label: labels.operatingDays,
      values: mergedDirection.trains.map((train) =>
        translateValue(train.serviceDay, language)
      ),
    },
    ...mergedDirection.stations.map((station) => ({
      kind: "station" as const,
      label: translateStationName(station.stationName, language),
      values: station.times.map((value) => translateValue(value, language)),
    })),
  ];
}

function translateDirection(value: string, language: Language) {
  if (language === "ja") return value;
  return DIRECTION_TRANSLATIONS[value] ?? value;
}

function translateTrainName(value: string, language: Language) {
  if (language === "en") return value;
  return TRAIN_NAME_TRANSLATIONS[value] ?? value;
}

function translateServiceGroupLabel(value: string, language: Language) {
  return SERVICE_GROUP_LABELS[value]?.[language] ?? value;
}

function formatTrainIdentifier(
  train: ReturnType<typeof normalizeDirection>["trains"][number],
  language: Language
) {
  const name = translateTrainName(train.name, language);
  const number = normalizeTrainNumber(train.number);
  return number ? `${name}-${number}` : name;
}

function normalizeTrainNumber(value: string) {
  return value.replace(/号$/u, "");
}

function trainIdentifierKey(train: ReturnType<typeof normalizeDirection>["trains"][number]) {
  const name = String(train.name || "").trim();
  const number = normalizeTrainNumber(train.number).trim();

  if (!name && !number) {
    return "-";
  }

  return `${name}-${number}`;
}

function translateStationName(value: string, language: Language) {
  if (language === "ja") return value;
  return STATION_TRANSLATIONS[value] ?? value;
}

function translateValue(value: string, language: Language) {
  if (!value || language === "ja") {
    return value;
  }

  if (value === "毎日") {
    return "Every day";
  }

  if (value === "◆") {
    return "◆";
  }

  if (/系$/.test(value)) {
    return value.replace("Ｎ", "N").replace(/系$/, " series");
  }

  return value;
}

function buildTimetableServiceWindows(lines: RenderLine[]): ServiceActivityWindow[] {
  const windows: ServiceActivityWindow[] = [];

  for (const line of lines) {
    for (const direction of line.directions) {
      const mergedDirection = direction.mergedDirection;

      for (let trainIndex = 0; trainIndex < mergedDirection.trains.length; trainIndex += 1) {
        const train = mergedDirection.trains[trainIndex];

        if (!isKnownTrainType(train.name)) {
          continue;
        }

        const scheduleMinutes = mergedDirection.stations.flatMap((station) =>
          extractScheduleMinutes(station.times[trainIndex] ?? "")
        );

        if (scheduleMinutes.length === 0) {
          continue;
        }

        windows.push({
          service: train.name,
          startMinute: scheduleMinutes[0],
          endMinute: scheduleMinutes[scheduleMinutes.length - 1],
        });
      }
    }
  }

  return windows;
}

function extractScheduleMinutes(value: string): number[] {
  const matches = [...value.matchAll(/\b(\d{2}):(\d{2})\b/g)];

  return matches.map((match) => Number(match[1]) * 60 + Number(match[2]));
}

function isKnownTrainType(value: string): value is TrainType {
  return TRAIN_TYPES.includes(value as TrainType);
}
