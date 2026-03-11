"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  CyberstationStatusDataset,
  StatusLanguage,
  StatusDirectionId,
  StatusTone,
} from "@/lib/jr-cyberstation-status";
import { AlertCircle, RefreshCw, Search, Train } from "lucide-react";

type StatusLabels = {
  statusHeading: string;
  statusDescription: string;
  networkOverview: string;
  liveSource: string;
  selectLine: string;
  inbound: string;
  outbound: string;
  search: string;
  refresh: string;
  refreshing: string;
  updatedAt: string;
  noTrainStatuses: string;
  trainName: string;
  trainStatus: string;
  update: string;
};

export function StatusView({
  language,
  labels,
}: {
  language: StatusLanguage;
  labels: StatusLabels;
}) {
  const [isPending, setIsPending] = useState(false);
  const [data, setData] = useState<CyberstationStatusDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("1");
  const [selectedDirectionId, setSelectedDirectionId] = useState<StatusDirectionId>("U");

  useEffect(() => {
    let cancelled = false;

    void loadStatusData(
      language,
      "1",
      "U",
      setData,
      setError,
      setIsPending,
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [language]);

  const refresh = () => {
    void loadStatusData(
      language,
      selectedLineId,
      selectedDirectionId,
      setData,
      setError,
      setIsPending
    );
  };

  const search = () => {
    void loadStatusData(
      language,
      selectedLineId,
      selectedDirectionId,
      setData,
      setError,
      setIsPending
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{labels.statusHeading}</CardTitle>
            <CardDescription className="mt-2">{labels.statusDescription}</CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            {data && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {labels.updatedAt}: {formatTimestamp(data.fetchedAt)}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isPending}
            >
              <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
              {isPending ? labels.refreshing : labels.refresh}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!data ? (
            <div className="rounded-xl border bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
              {labels.refreshing}
            </div>
          ) : (
            <>
              <div>
                <div className="mb-3 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  {labels.networkOverview}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.summary.map((item) => (
                    <div
                      key={item.lineId}
                      className="rounded-xl border bg-muted/20 px-4 py-3"
                    >
                      <div className="text-sm font-medium">{item.lineName}</div>
                      <div className={cn("mt-2 text-sm font-semibold", toneClassName(item.tone))}>
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-3 md:flex-row md:items-center">
                <label className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{labels.selectLine}</span>
                  <div className="relative">
                    <Train className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={selectedLineId}
                      onChange={(event) => setSelectedLineId(event.target.value)}
                      className="h-10 w-full appearance-none rounded-lg border bg-background pr-10 pl-10 text-sm outline-none transition-colors focus:border-ring"
                    >
                      {data.lineOptions.map((line) => (
                        <option key={line.lineId} value={line.lineId}>
                          {line.lineName}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <div className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedDirectionId("U")}
                    className={cn(
                      "rounded-full px-4 py-2 font-medium transition-colors",
                      selectedDirectionId === "U"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {labels.inbound}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDirectionId("D")}
                    className={cn(
                      "rounded-full px-4 py-2 font-medium transition-colors",
                      selectedDirectionId === "D"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {labels.outbound}
                  </button>
                </div>

                <Button type="button" size="sm" onClick={search} disabled={isPending}>
                  <Search className="h-4 w-4" />
                  {labels.search}
                </Button>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium">{labels.trainName}</th>
                      <th className="px-4 py-3 text-left font-medium">{labels.trainStatus}</th>
                      <th className="px-4 py-3 text-left font-medium">{labels.update}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trains.length ? (
                      data.trains.map((train) => (
                        <tr
                          key={`${data.selectedLineId}-${data.selectedDirectionId}-${train.trainName}`}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium">{train.trainName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{train.detail}</div>
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 align-top font-medium",
                              toneClassName(train.tone)
                            )}
                          >
                            {train.status}
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground tabular-nums">
                            {train.updatedAt}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-6 text-center text-sm text-muted-foreground"
                        >
                          {labels.noTrainStatuses}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground">
                {labels.liveSource}:{" "}
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  JR Cyber Station
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function toneClassName(tone: StatusTone) {
  if (tone === "success") return "text-emerald-500";
  if (tone === "warning") return "text-amber-500";
  if (tone === "danger") return "text-red-500";
  return "text-foreground";
}

async function loadStatusData(
  language: StatusLanguage,
  selectedLineId: string,
  selectedDirectionId: StatusDirectionId,
  setData: Dispatch<SetStateAction<CyberstationStatusDataset | null>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setIsPending: Dispatch<SetStateAction<boolean>>,
  isCancelled?: () => boolean
) {
  try {
    setIsPending(true);

    const response = await fetch(
      `/api/status?lang=${language}&lineId=${selectedLineId}&directionId=${selectedDirectionId}`,
      {
      cache: "no-store",
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Status request failed with ${response.status}`);
    }

    const nextData = (await response.json()) as CyberstationStatusDataset;

    if (isCancelled?.()) {
      return;
    }

    setData(nextData);
    setError(null);
  } catch (nextError) {
    if (!isCancelled?.()) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load status data");
    }
  } finally {
    if (!isCancelled?.()) {
      setIsPending(false);
    }
  }
}
