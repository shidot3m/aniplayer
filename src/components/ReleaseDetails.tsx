import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Film,
  Loader2,
  MoreVertical,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL, CDN_BASE_URL } from "../lib/constants";
import { formatDurationMinutes, formatTotalWatchTime } from "../lib/utils";
import { useCatalogStore } from "../store/catalogStore";
import { usePlayerStore } from "../store/playerStore";
import type { BookmarkCategory, EpisodeItem, FranchiseItem, HistoryItem, Release } from "../types";
import { AnimeCard } from "./AnimeCard";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface ReleaseDetailsProps {
  release: Release;
  onBack: () => void;
}

const CATEGORY_NAMES: Record<BookmarkCategory, string> = {
  WATCHING: "Смотрю",
  PLANNED: "В планах",
  POSTPONED: "Отложено",
  ABANDONED: "Брошено",
  NOT_INTERESTED: "Не интересно",
  FAVORITES: "Любимое",
  WATCHED: "Просмотрено",
};

function formatPosterUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  return `${CDN_BASE_URL}${rawUrl}`;
}

interface ReleaseHeroProps {
  release: Release;
  currentCategory: BookmarkCategory | null;
  lastWatchedItem: HistoryItem | null;
  startEpisode: EpisodeItem | null;
  onPlay: (ep: EpisodeItem) => void;
  onBookmarkChange: (cat: BookmarkCategory) => void;
  onRemoveBookmark: () => void;
}

function ReleaseHero({
  release,
  currentCategory,
  lastWatchedItem,
  startEpisode,
  onPlay,
  onBookmarkChange,
  onRemoveBookmark,
}: ReleaseHeroProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const formattedPoster = formatPosterUrl(
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail,
  );
  const totalEpisodesCount = release.episodes_total || release.episodes?.length || 0;
  const avgDuration = release.average_duration_of_episode || 24;
  const watchTimeStr = formatTotalWatchTime(totalEpisodesCount, avgDuration);

  return (
    <div className="mb-10 flex flex-col gap-8 md:flex-row">
      <div className="relative aspect-[2/3] w-full max-w-[280px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#12131A] shadow-2xl mx-auto md:mx-0">
        {formattedPoster ? (
          <img
            src={formattedPoster}
            alt={release.name.main}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            Нет постера
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {release.name.main}
          </h1>
          {release.name.alternative && (
            <p className="mt-1 text-sm text-slate-400 font-medium">{release.name.alternative}</p>
          )}
          {release.name.english && <p className="text-xs text-slate-400">{release.name.english}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {release.type?.description && <Badge variant="rose">{release.type.description}</Badge>}
            {release.year && <Badge variant="secondary">{release.year}</Badge>}
            <Badge variant="outline" className="border-white/10 text-slate-300">
              <Clock className="mr-1 h-3 w-3 text-slate-400" />
              {formatDurationMinutes(release.average_duration_of_episode)}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              <Film className="mr-1 h-3 w-3 text-slate-400" />
              {totalEpisodesCount > 0 ? `${totalEpisodesCount} эп.` : "Онгоинг"}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              Время: {watchTimeStr}
            </Badge>
          </div>

          {release.genres && release.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {release.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300 border border-white/5"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {release.description && (
            <div className="mt-5 max-w-3xl">
              <p
                className={`text-sm leading-relaxed text-slate-300 transition-all ${
                  isDescExpanded ? "" : "line-clamp-4"
                }`}
              >
                {release.description}
              </p>
              {release.description.length > 200 && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-md py-0.5"
                >
                  <span>{isDescExpanded ? "Свернуть" : "Развернуть описание"}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isDescExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {startEpisode ? (
            <Button
              variant="default"
              size="lg"
              onClick={() => onPlay(startEpisode)}
              className="gap-2.5 px-6"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>
                {lastWatchedItem
                  ? `Продолжить с ${lastWatchedItem.episode_ordinal} серии`
                  : "Смотреть с 1 серии"}
              </span>
            </Button>
          ) : (
            <Button disabled variant="secondary" size="lg">
              Эпизоды недоступны
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div
                className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold border transition-all cursor-pointer ${
                  currentCategory
                    ? "bg-rose-600/20 border-rose-500/40 text-rose-400"
                    : "bg-[#12131A] border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <Bookmark className="h-4 w-4" />
                <span>
                  {currentCategory ? CATEGORY_NAMES[currentCategory] : "Добавить в закладки"}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="left" className="w-48">
              {Object.entries(CATEGORY_NAMES).map(([cat, label]) => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => {
                    if (currentCategory === cat) {
                      onRemoveBookmark();
                    } else {
                      onBookmarkChange(cat as BookmarkCategory);
                    }
                  }}
                  className={currentCategory === cat ? "text-rose-400 font-bold" : ""}
                >
                  <span>{label}</span>
                  {currentCategory === cat && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface EpisodeCardProps {
  ep: EpisodeItem;
  isWatched: boolean;
  isDownloading: boolean;
  onPlay: () => void;
  onToggleWatched: () => void;
  onDownload: () => void;
}

function EpisodeCard({
  ep,
  isWatched,
  isDownloading,
  onPlay,
  onToggleWatched,
  onDownload,
}: EpisodeCardProps) {
  const thumb = formatPosterUrl(ep.preview?.thumbnail || ep.preview?.preview || ep.preview?.src);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#12131A] p-3 transition-all hover:border-white/20 hover:bg-[#161822]">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/40">
        {thumb ? (
          <img
            src={thumb}
            alt={`Серия ${ep.ordinal}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            Серия {ep.ordinal}
          </div>
        )}

        <button
          type="button"
          aria-label={`Воспроизвести серию ${ep.ordinal}`}
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
        >
          <Play className="h-8 w-8 fill-rose-500 text-rose-500" />
        </button>

        {isWatched && (
          <div className="absolute right-2 top-2 rounded-md bg-black/70 p-1 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-white">Серия {ep.ordinal}</h4>
          <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
            {ep.name || `Эпизод ${ep.ordinal}`}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <div
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Действия"
            >
              <MoreVertical className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-48">
            <DropdownMenuItem onClick={onToggleWatched}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              <span>{isWatched ? "Снять отметку" : "Отметить просмотренным"}</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1 text-sky-400" />
              <span>{isDownloading ? "Загрузка..." : "Скачать серию (HLS)"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface RelatedTabProps {
  isLoading: boolean;
  franchises: FranchiseItem[];
  currentReleaseId: number;
  onSelectRelease: (r: Release) => void;
}

function RelatedTab({ isLoading, franchises, currentReleaseId, onSelectRelease }: RelatedTabProps) {
  if (isLoading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
        <p className="text-xs text-slate-400">Загрузка связанных релизов...</p>
      </div>
    );
  }

  const hasReleases = franchises.some((f) => (f.franchise_releases?.length || 0) > 0);
  if (!hasReleases) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#12131A]/40 p-6 text-center text-slate-400">
        <Film className="mb-2 h-10 w-10 text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-300">Нет связанных сезонов</h4>
        <p className="mt-1 text-xs text-slate-500">
          Для этого аниме нет других частей или фильмов в базе
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {franchises.map((f) => (
        <div key={f.id || f.name} className="space-y-4">
          {f.name && (
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Film className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-bold text-white">{f.name}</h3>
              {f.name_english && <span className="text-xs text-slate-400">({f.name_english})</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {f.franchise_releases?.map((fr) => {
              if (!fr.release) return null;
              const isCurrent = fr.release.id === currentReleaseId;
              return (
                <div key={fr.id || fr.release.id} className="relative">
                  <AnimeCard
                    release={fr.release}
                    onClick={() => {
                      if (!isCurrent && fr.release) {
                        onSelectRelease(fr.release);
                      }
                    }}
                  />
                  {isCurrent && (
                    <div className="pointer-events-none absolute left-2 top-2 z-20">
                      <Badge variant="rose" className="text-[10px] shadow-lg">
                        Текущий
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function useFranchises(releaseId: number) {
  const [franchises, setFranchises] = useState<FranchiseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadFranchises() {
      setIsLoading(true);
      try {
        let data: FranchiseItem[] = [];
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          try {
            data = await invoke<FranchiseItem[]>("api_get_release_franchises", {
              release_id: releaseId,
            });
          } catch (_err) {
            const res = await fetch(`${API_BASE_URL}/anime/franchises/release/${releaseId}`);
            if (res.ok) data = await res.json();
          }
        } else {
          const res = await fetch(`${API_BASE_URL}/anime/franchises/release/${releaseId}`);
          if (res.ok) data = await res.json();
        }
        if (isMounted) setFranchises(data || []);
      } catch (e) {
        console.error("Failed to load franchises:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadFranchises();
    return () => {
      isMounted = false;
    };
  }, [releaseId]);

  return { franchises, isLoading };
}

interface EpisodesTabContentProps {
  episodes?: EpisodeItem[];
  releaseId: number;
  history: HistoryItem[];
  downloadingEpIds: Record<string, boolean>;
  onPlay: (ep: EpisodeItem) => void;
  onToggleWatched: (episodeId: string, ordinal: number, completed: boolean) => void;
  onDownload: (ep: EpisodeItem) => void;
}

function EpisodesTabContent({
  episodes,
  releaseId,
  history,
  downloadingEpIds,
  onPlay,
  onToggleWatched,
  onDownload,
}: EpisodesTabContentProps) {
  if (!episodes || episodes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#12131A]/50 text-xs text-slate-400">
        Список эпизодов пуст или еще загружается
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {episodes.map((ep) => {
        const epHistory = history.find((h) => h.release_id === releaseId && h.episode_id === ep.id);
        return (
          <EpisodeCard
            key={ep.id}
            ep={ep}
            isWatched={!!epHistory?.is_completed}
            isDownloading={!!downloadingEpIds[ep.id]}
            onPlay={() => onPlay(ep)}
            onToggleWatched={() => onToggleWatched(ep.id, ep.ordinal, !epHistory?.is_completed)}
            onDownload={() => onDownload(ep)}
          />
        );
      })}
    </div>
  );
}

export function ReleaseDetails({ release, onBack }: ReleaseDetailsProps) {
  const {
    bookmarks,
    setBookmark,
    removeBookmark,
    history,
    setEpisodeWatched,
    selectReleaseWithDetails,
  } = useCatalogStore();
  const { playEpisode } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<string>("episodes");
  const [downloadingEpIds, setDownloadingEpIds] = useState<Record<string, boolean>>({});
  const { franchises, isLoading: isLoadingFranchises } = useFranchises(release.id);

  let currentCategory: BookmarkCategory | null = null;
  for (const [cat, list] of Object.entries(bookmarks)) {
    if (list.some((b) => b.release_id === release.id)) {
      currentCategory = cat as BookmarkCategory;
      break;
    }
  }

  const releaseHistory = history.filter((h) => h.release_id === release.id);
  const lastWatchedItem = releaseHistory.length > 0 ? releaseHistory[0] : null;

  const startEpisode = (() => {
    if (lastWatchedItem) {
      const ep = release.episodes?.find((e) => e.id === lastWatchedItem.episode_id);
      if (ep) return ep;
    }
    return release.episodes?.[0] || null;
  })();

  const handleDownload = async (ep: EpisodeItem) => {
    try {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: true }));
      const hlsUrl = ep.hls_1080 || ep.hls_720 || ep.hls_480;
      if (!hlsUrl) {
        alert("Поток для скачивания не найден");
        return;
      }
      await invoke("downloader_start_hls", {
        request: {
          release_id: release.id,
          episode_id: ep.id,
          episode_ordinal: ep.ordinal,
          hls_url: hlsUrl,
          quality: "1080p",
          output_dir: null,
          opening_start: ep.opening?.start || null,
          opening_stop: ep.opening?.stop || null,
          ending_start: ep.ending?.start || null,
          ending_stop: ep.ending?.stop || null,
        },
      });
      alert(`Загрузка серии ${ep.ordinal} начата. Опенинг и эндинг сохранены.`);
    } catch (err) {
      console.error("Failed to start download:", err);
      alert(`Ошибка: ${err}`);
    } finally {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: false }));
    }
  };

  const totalRelatedCount = franchises.reduce(
    (acc, f) => acc + (f.franchise_releases?.length || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад в каталог</span>
        </Button>
      </div>

      <ReleaseHero
        release={release}
        currentCategory={currentCategory}
        lastWatchedItem={lastWatchedItem}
        startEpisode={startEpisode}
        onPlay={(ep) => playEpisode(release, ep)}
        onBookmarkChange={(cat) => setBookmark(release.id, cat, release)}
        onRemoveBookmark={() => removeBookmark(release.id)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="episodes" className="px-5">
            Эпизоды ({release.episodes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="related" className="px-5">
            Связанное {totalRelatedCount > 0 ? `(${totalRelatedCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="episodes">
          <EpisodesTabContent
            episodes={release.episodes}
            releaseId={release.id}
            history={history}
            downloadingEpIds={downloadingEpIds}
            onPlay={(ep) => playEpisode(release, ep)}
            onToggleWatched={(episodeId, ordinal, completed) =>
              setEpisodeWatched(release.id, episodeId, ordinal, completed)
            }
            onDownload={handleDownload}
          />
        </TabsContent>

        <TabsContent value="related">
          <RelatedTab
            isLoading={isLoadingFranchises}
            franchises={franchises}
            currentReleaseId={release.id}
            onSelectRelease={selectReleaseWithDetails}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
