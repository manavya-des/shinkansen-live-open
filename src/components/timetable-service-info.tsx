"use client";

import { useEffect, useState } from "react";
import { Clock3, TrainFront } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TRAIN_SERVICE_DESCRIPTORS,
  TRAIN_TYPES,
  type TrainType,
} from "@/lib/shinkansen-services";

type ServiceActivityWindow = {
  service: TrainType;
  startMinute: number;
  endMinute: number;
};

type ServiceGroupDisplay = {
  id: string;
  label: string;
  services: Array<{
    id: TrainType;
    label: string;
  }>;
};

type TrainCountsByType = Record<TrainType, number>;

export function TimetableServiceInfo({
  groups,
  serviceWindows,
  labels,
}: {
  groups: ServiceGroupDisplay[];
  serviceWindows: ServiceActivityWindow[];
  labels: {
    title: string;
    description: string;
    jst: string;
    activeServices: string;
    basedOnTimetable: string;
    serviceUnit: string;
  };
}) {
  const [currentTokyoTime, setCurrentTokyoTime] = useState(() => getTokyoTimeParts(new Date()));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTokyoTime(getTokyoTimeParts(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const currentMinute =
    Number(currentTokyoTime.hour) * 60 +
    Number(currentTokyoTime.minute) +
    Number(currentTokyoTime.second) / 60;
  const activeCounts = createEmptyTrainCountsByType();

  for (const serviceWindow of serviceWindows) {
    if (
      currentMinute >= serviceWindow.startMinute &&
      currentMinute <= serviceWindow.endMinute
    ) {
      activeCounts[serviceWindow.service] += 1;
    }
  }

  const totalActive = Object.values(activeCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="mb-8 overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/20 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrainFront className="h-4 w-4 text-muted-foreground" />
              {labels.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{labels.description}</p>
          </div>
          <div className="rounded-xl border bg-background px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {labels.jst}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">
              {currentTokyoTime.hour}:{currentTokyoTime.minute}:{currentTokyoTime.second}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{totalActive} {labels.activeServices}</span>
              <Badge variant="secondary" className="text-[10px] font-medium">
                {labels.basedOnTimetable}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const groupCount = group.services.reduce(
              (sum, service) => sum + activeCounts[service.id],
              0
            );

            return (
              <section
                key={group.id}
                className="rounded-xl border bg-card/60 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold leading-5">{group.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.services.length} {labels.serviceUnit}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {groupCount}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {group.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="text-sm font-medium">{service.label}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({TRAIN_SERVICE_DESCRIPTORS[service.id]})
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {activeCounts[service.id]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function createEmptyTrainCountsByType(): TrainCountsByType {
  return TRAIN_TYPES.reduce((counts, type) => {
    counts[type] = 0;
    return counts;
  }, {} as TrainCountsByType);
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
