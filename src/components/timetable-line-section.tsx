"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type TimetableRow = {
  kind: "meta" | "station" | "trainIdentifier";
  label: string;
  values: string[];
};

type DirectionData = {
  directionId: string;
  directionLabel: string;
  rows: TimetableRow[];
};

export function TimetableLineSection({
  lineId,
  lineName,
  lineCodes,
  directions,
}: {
  lineId: string;
  lineName: string;
  lineCodes: string[];
  directions: DirectionData[];
}) {
  const [activeDirection, setActiveDirection] = useState(directions[0]?.directionId ?? "0");
  const current = directions.find((d) => d.directionId === activeDirection) ?? directions[0];

  return (
    <section id={`line-${lineId}`} className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{lineName}</h2>
        <Badge variant="secondary" className="text-[10px] font-mono">
          {lineCodes.join(" + ")}
        </Badge>

        {directions.length > 1 && (
          <div className="ml-auto inline-flex rounded-full border bg-muted/50 p-0.5 text-xs">
            {directions.map((direction) => (
              <button
                key={direction.directionId}
                onClick={() => setActiveDirection(direction.directionId)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  activeDirection === direction.directionId
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {direction.directionLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      {current && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <table className="min-w-max border-collapse text-xs">
                <tbody>
                  {current.rows.map((row) => (
                    <Row
                      key={`${lineId}-${current.directionId}-${row.kind}-${row.label}`}
                      label={row.label}
                      values={row.values}
                      kind={row.kind}
                    />
                  ))}
                </tbody>
              </table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Row({
  label,
  values,
  kind,
}: {
  label: string;
  values: string[];
  kind: TimetableRow["kind"];
}) {
  const isStation = kind === "station";
  const isTrain = kind === "trainIdentifier";
  const isMeta = kind === "meta";

  return (
    <tr
      className={`border-b border-border/50 align-top ${
        isTrain ? "bg-muted/40" : isStation ? "" : "bg-muted/20"
      }`}
    >
      <th className="sticky left-0 z-10 min-w-44 border-r border-border/50 bg-card px-3 py-2 text-left text-xs font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
        {isStation ? (
          <Badge variant="outline" className="text-[10px] font-semibold">
            {label}
          </Badge>
        ) : isTrain ? (
          <span className="font-semibold text-muted-foreground">{label}</span>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
      </th>
      {values.map((value, index) => (
        <td
          key={`${label}-${index}`}
          className={`min-w-24 border-r border-border/30 px-3 py-2 text-center whitespace-pre-line ${
            isTrain ? "font-medium" : ""
          }`}
        >
          {isTrain && value ? (
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {value}
            </Badge>
          ) : (
            <span className={isMeta ? "text-muted-foreground" : "tabular-nums"}>
              {value || "\u00a0"}
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}
