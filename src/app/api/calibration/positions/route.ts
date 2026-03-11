import { NextRequest, NextResponse } from "next/server";
import { getCalibrationPositions } from "@/lib/shinkansen-calibration";

export function GET(request: NextRequest) {
  const minuteParam = request.nextUrl.searchParams.get("minute");
  const currentMinute = Number.isFinite(Number(minuteParam))
    ? Number(minuteParam)
    : new Date().getHours() * 60 + new Date().getMinutes();

  return NextResponse.json(getCalibrationPositions(currentMinute));
}
