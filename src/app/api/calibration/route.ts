import { NextRequest, NextResponse } from "next/server";
import { getCalibrationBundle } from "@/lib/shinkansen-calibration";

export function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "lines";
  const lineId = request.nextUrl.searchParams.get("lineId");
  const service = request.nextUrl.searchParams.get("service");
  const bundle = getCalibrationBundle();

  if (scope === "segments") {
    const segments = bundle.segmentSummaries.filter((segment) => {
      if (lineId && segment.lineId !== lineId) {
        return false;
      }

      if (service && segment.service !== service) {
        return false;
      }

      return true;
    });

    return NextResponse.json({
      generatedAt: bundle.generatedAt,
      scope: "segments",
      count: segments.length,
      segments,
    });
  }

  if (scope === "trips") {
    const tripSegments = bundle.tripSegments.filter((segment) => {
      if (lineId && segment.lineId !== lineId) {
        return false;
      }

      if (service && segment.service !== service) {
        return false;
      }

      return true;
    });

    return NextResponse.json({
      generatedAt: bundle.generatedAt,
      scope: "trips",
      count: tripSegments.length,
      tripSegments,
    });
  }

  const lines = bundle.lines.filter((line) => (lineId ? line.lineId === lineId : true));

  return NextResponse.json({
    generatedAt: bundle.generatedAt,
    scope: "lines",
    count: lines.length,
    lines,
  });
}
