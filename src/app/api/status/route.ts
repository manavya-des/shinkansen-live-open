import { NextRequest, NextResponse } from "next/server";
import {
  fetchCyberstationStatus,
  type StatusLanguage,
} from "@/lib/jr-cyberstation-status";

export async function GET(request: NextRequest) {
  const langParam = request.nextUrl.searchParams.get("lang");
  const lineId = request.nextUrl.searchParams.get("lineId") ?? undefined;
  const directionIdParam = request.nextUrl.searchParams.get("directionId");
  const language: StatusLanguage = langParam === "ja" ? "ja" : "en";

  try {
    const data = await fetchCyberstationStatus({
      language,
      lineId,
      directionId: directionIdParam === "D" ? "D" : "U",
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status fetch error";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 502,
      }
    );
  }
}
