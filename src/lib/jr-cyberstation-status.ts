import { unstable_noStore as noStore } from "next/cache";

export type StatusLanguage = "en" | "ja";
export type StatusDirectionId = "U" | "D";
export type StatusTone = "success" | "warning" | "danger" | "neutral";

export type CyberstationSummaryRow = {
  lineId: string;
  lineName: string;
  status: string;
  tone: StatusTone;
};

export type CyberstationTrainStatusRow = {
  trainName: string;
  detail: string;
  status: string;
  tone: StatusTone;
  updatedAt: string;
};

export type CyberstationLineOption = {
  lineId: string;
  lineName: string;
};

export type CyberstationStatusDataset = {
  fetchedAt: string;
  language: StatusLanguage;
  sourceUrl: string;
  selectedLineId: string;
  selectedDirectionId: StatusDirectionId;
  lineOptions: CyberstationLineOption[];
  summary: CyberstationSummaryRow[];
  trains: CyberstationTrainStatusRow[];
};

const INFO_URL = "https://www.jr.cyberstation.ne.jp/jcs/Info.do";
const HOME_URLS: Record<StatusLanguage, string> = {
  en: "https://www.jr.cyberstation.ne.jp/index_en.html",
  ja: "https://www.jr.cyberstation.ne.jp/index.html",
};

const LINE_OPTIONS = [
  { lineId: "1", lineName: { en: "Tokaido, Sanyo Shinkansen", ja: "東海道・山陽新幹線" } },
  {
    lineId: "2",
    lineName: { en: "Tohoku, Yamagata, Akita Shinkansen", ja: "東北・山形・秋田新幹線" },
  },
  { lineId: "3", lineName: { en: "Joetsu Shinkansen", ja: "上越新幹線" } },
  { lineId: "4", lineName: { en: "Hokuriku Shinkansen", ja: "北陸新幹線" } },
  { lineId: "5", lineName: { en: "Kyushu Shinkansen", ja: "九州新幹線" } },
  { lineId: "7", lineName: { en: "Nishi-Kyushu Shinkansen", ja: "西九州新幹線" } },
  { lineId: "6", lineName: { en: "Hokkaido Shinkansen", ja: "北海道新幹線" } },
] as const;

export async function fetchCyberstationStatus({
  language,
  lineId,
  directionId,
}: {
  language: StatusLanguage;
  lineId?: string;
  directionId?: StatusDirectionId;
}): Promise<CyberstationStatusDataset> {
  noStore();

  const selectedLineId = LINE_OPTIONS.some((line) => line.lineId === lineId) ? lineId! : "1";
  const selectedDirectionId: StatusDirectionId = directionId === "D" ? "D" : "U";
  const html = await fetchStatusHtml({
    language,
    lineId: selectedLineId,
    directionId: selectedDirectionId,
  });

  return {
    fetchedAt: new Date().toISOString(),
    language,
    sourceUrl: language === "en" ? `${INFO_URL}?lang=en` : INFO_URL,
    selectedLineId,
    selectedDirectionId,
    lineOptions: LINE_OPTIONS.map((line) => ({
      lineId: line.lineId,
      lineName: line.lineName[language],
    })),
    summary: parseSummary(html),
    trains: parseTrainStatusRows(html),
  };
}

async function fetchStatusHtml({
  language,
  lineId,
  directionId,
}: {
  language: StatusLanguage;
  lineId: string;
  directionId: StatusDirectionId;
}) {
  const formData = new URLSearchParams({
    lang: language,
    train: lineId,
    up_down: directionId,
    script: "1",
    trigger: "batch",
  });

  const response = await fetch(INFO_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      referer: HOME_URLS[language],
      origin: "https://www.jr.cyberstation.ne.jp",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    body: formData.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`JR Cyber Station responded with ${response.status}`);
  }

  return response.text();
}

function parseSummary(html: string): CyberstationSummaryRow[] {
  const summaryBody = matchFirst(
    html,
    /<h2 class="title_bar">[\s\S]*?<\/h2>\s*<table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  );

  if (!summaryBody) {
    return [];
  }

  return Array.from(summaryBody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) => {
      const cells = Array.from(
        rowMatch[1].matchAll(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)
      );

      if (cells.length < 2) {
        return null;
      }

      const lineName = cleanHtml(cells[0][2]);
      const status = cleanHtml(cells[1][2]);

      return {
        lineId: summaryLineIdFromName(lineName),
        lineName,
        status,
        tone: toneFromClassName(cells[1][1]),
      };
    })
    .filter((row): row is CyberstationSummaryRow => Boolean(row));
}

function parseTrainStatusRows(html: string): CyberstationTrainStatusRow[] {
  const detailBody = matchFirst(
    html,
    /<table id="table_info_status_detail"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  );

  if (!detailBody) {
    return [];
  }

  return Array.from(detailBody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) => {
      const cells = Array.from(
        rowMatch[1].matchAll(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)
      );

      if (cells.length < 3) {
        return null;
      }

      const trainCell = cells[0][2];
      const trainName = cleanHtml(trainCell.replace(/<small[\s\S]*$/i, ""));
      const detail = cleanHtml(matchFirst(trainCell, /<small>([\s\S]*?)<\/small>/i) ?? "");
      const status = cleanHtml(cells[1][2]);
      const updatedAt = cleanHtml(cells[2][2]);

      if (!trainName) {
        return null;
      }

      return {
        trainName,
        detail,
        status,
        tone: toneFromClassName(cells[1][1]),
        updatedAt,
      };
    })
    .filter((row): row is CyberstationTrainStatusRow => Boolean(row));
}

function summaryLineIdFromName(lineName: string) {
  const matched = LINE_OPTIONS.find((line) =>
    Object.values(line.lineName).some((name) => name === lineName)
  );

  return matched?.lineId ?? lineName;
}

function toneFromClassName(value: string): StatusTone {
  if (value.includes("uk-text-success")) return "success";
  if (value.includes("uk-text-warning")) return "warning";
  if (value.includes("uk-text-danger")) return "danger";
  return "neutral";
}

function matchFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? null;
}

function cleanHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)));
}
