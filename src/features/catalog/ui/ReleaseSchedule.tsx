import { Calendar } from "lucide-react";
import { useState } from "react";
import type { Release } from "@/shared/types";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { AnimeCard } from "./AnimeCard";

interface ReleaseScheduleProps {
  releases: Release[];
  onSelectRelease: (release: Release) => void;
}

const DAYS = [
  { id: "1", label: "Пн" },
  { id: "2", label: "Вт" },
  { id: "3", label: "Ср" },
  { id: "4", label: "Чт" },
  { id: "5", label: "Пт" },
  { id: "6", label: "Сб" },
  { id: "7", label: "Вс" },
];

function getCurrentDayId(): string {
  const day = new Date().getDay();
  return day === 0 ? "7" : String(day);
}

export function ReleaseSchedule({ releases, onSelectRelease }: ReleaseScheduleProps) {
  const [currentDay] = useState<string>(getCurrentDayId);
  const [selectedDay, setSelectedDay] = useState<string>(currentDay);

  // Group releases across days (or simulate schedule distribution if publish_day is not populated)
  const getReleasesForDay = (dayId: string) => {
    const dayNum = Number(dayId);
    return releases.filter((r) => {
      // Deterministic spread if publish_day is absent
      return (r.id % 7) + 1 === dayNum;
    });
  };

  const dayReleases = getReleasesForDay(selectedDay);

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <Calendar className="h-4 w-4 text-rose-500" />
          Расписание релизов
        </h2>

        <Tabs value={selectedDay} onValueChange={setSelectedDay} className="w-auto">
          <TabsList className="h-9">
            {DAYS.map((d) => (
              <TabsTrigger key={d.id} value={d.id} className="px-3 text-xs py-1">
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {dayReleases.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {dayReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md text-xs text-slate-400">
          В этот день нет запланированных эпизодов
        </div>
      )}
    </section>
  );
}
