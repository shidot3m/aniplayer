import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Film,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, CDN_BASE_URL } from "../lib/constants";
import { formatDurationMinutes, formatTotalWatchTime } from "../lib/utils";
import { useCatalogStore } from "../store/catalogStore";
import { usePlayerStore } from "../store/playerStore";
import type { BookmarkCategory, EpisodeItem, FranchiseItem, HistoryItem, Release } from "../types";
import { EpisodeCard } from "./EpisodeCard";
import { RelatedTab } from "./RelatedTab";
import { TorrentsTab } from "./TorrentsTab";
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
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${CDN_BASE_URL}${cleanPath}`;
}

interface ReleaseHeroProps {
  release: Release;
  isWatched: boolean;
  currentCategory: BookmarkCategory | null;
  startEpisode: EpisodeItem | null;
  playButtonText: string;
  onPlay: (ep: EpisodeItem) => void;
  onBookmarkChange: (cat: BookmarkCategory) => void;
  onRemoveBookmark: () => void;
  onOpenTorrents?: () => void;
}

function ReleaseHero({
  release,
  isWatched,
  currentCategory,
  startEpisode,
  playButtonText,
  onPlay,
  onBookmarkChange,
  onRemoveBookmark,
  onOpenTorrents,
}: ReleaseHeroProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const descText = release.description;
  useEffect(() => {
    const el = descRef.current;
    if (!el || !descText) return;

    const checkOverflow = () => {
      if (!el) return;
      if (el.scrollHeight > el.clientHeight + 1) {
        setCanExpand(true);
      }
    };

    checkOverflow();
    const timer = setTimeout(checkOverflow, 80);
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [descText]);

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
        {isWatched && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-xl shadow-lg shadow-black/50">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Просмотрено</span>
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
            {isWatched && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-950/40 text-emerald-400 flex items-center gap-1 font-semibold"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Просмотрено</span>
              </Badge>
            )}
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
                ref={descRef}
                className={`text-sm leading-relaxed text-slate-300 transition-all ${
                  isDescExpanded ? "" : "line-clamp-4"
                }`}
              >
                {release.description}
              </p>
              {canExpand && (
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
              <span>{playButtonText}</span>
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

          {onOpenTorrents && (
            <Button
              variant="outline"
              size="lg"
              onClick={onOpenTorrents}
              className="gap-2 border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500/50 hover:text-emerald-300 h-11 text-xs font-semibold rounded-xl"
            >
              <Download className="h-4 w-4" />
              <span>Торренты (HEVC)</span>
            </Button>
          )}
        </div>
      </div>
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
              releaseId,
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
  fallbackPoster?: string;
  history: HistoryItem[];
  downloadingEpIds: Record<string, boolean>;
  isDownloadingAll: boolean;
  onPlay: (ep: EpisodeItem) => void;
  onToggleWatched: (episodeId: string, ordinal: number, completed: boolean) => void;
  onDownload: (ep: EpisodeItem) => void;
  onDownloadAll: () => void;
}

function EpisodesTabContent({
  episodes,
  releaseId,
  fallbackPoster,
  history,
  downloadingEpIds,
  isDownloadingAll,
  onPlay,
  onToggleWatched,
  onDownload,
  onDownloadAll,
}: EpisodesTabContentProps) {
  if (!episodes || episodes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#12131A]/50 text-xs text-slate-400">
        Список эпизодов пуст или еще загружается
      </div>
    );
  }

  const watchedCount = episodes.filter((ep) =>
    history.some((h) => h.release_id === releaseId && h.episode_id === ep.id && h.is_completed),
  ).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
          <span>Всего эпизодов: {episodes.length}</span>
          {watchedCount > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Просмотрено: {watchedCount} из {episodes.length}
                </span>
              </span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDownloadingAll}
          onClick={onDownloadAll}
          className="gap-2 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isDownloadingAll ? "Загрузка..." : "Скачать все"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {episodes.map((ep) => {
          const epHistory = history.find(
            (h) => h.release_id === releaseId && h.episode_id === ep.id,
          );
          return (
            <EpisodeCard
              key={ep.id}
              ep={ep}
              fallbackPoster={fallbackPoster}
              isWatched={!!epHistory?.is_completed}
              isDownloading={!!downloadingEpIds[ep.id]}
              onPlay={() => onPlay(ep)}
              onToggleWatched={() => onToggleWatched(ep.id, ep.ordinal, !epHistory?.is_completed)}
              onDownload={() => onDownload(ep)}
            />
          );
        })}
      </div>
    </div>
  );
}

function useReleaseDownloader(release: Release) {
  const [downloadingEpIds, setDownloadingEpIds] = useState<Record<string, boolean>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownload = async (ep: EpisodeItem) => {
    try {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: true }));
      const hlsUrl = ep.hls_1080 || ep.hls_720 || ep.hls_480;
      if (!hlsUrl) {
        alert("Поток для скачивания не найден");
        return;
      }
      await invoke("downloader_start_episode", {
        episodeId: ep.id,
        releaseId: release.id,
        ordinal: ep.ordinal,
        m3u8Url: hlsUrl,
        quality: "1080p",
        opStart: ep.opening?.start ?? null,
        opStop: ep.opening?.stop ?? null,
        edStart: ep.ending?.start ?? null,
        edStop: ep.ending?.stop ?? null,
      });
      alert(`Загрузка эпизода ${ep.ordinal} начата. Опенинг и эндинг сохранены.`);
    } catch (err) {
      console.error("Failed to start download:", err);
      alert(`Ошибка: ${err}`);
    } finally {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: false }));
    }
  };

  const handleDownloadAll = async () => {
    const eps = release.episodes || [];
    const downloadable = eps.filter((ep) => ep.hls_1080 || ep.hls_720 || ep.hls_480);
    if (downloadable.length === 0) {
      alert("Нет доступных видеопотоков для скачивания этого тайтла");
      return;
    }

    try {
      setIsDownloadingAll(true);
      const payload = downloadable.map((ep) => ({
        episodeId: ep.id,
        ordinal: ep.ordinal,
        m3u8Url: ep.hls_1080 || ep.hls_720 || ep.hls_480 || "",
        quality: ep.hls_1080 ? "1080p" : ep.hls_720 ? "720p" : "480p",
        opStart: ep.opening?.start ?? null,
        opStop: ep.opening?.stop ?? null,
        edStart: ep.ending?.start ?? null,
        edStop: ep.ending?.stop ?? null,
      }));

      await invoke("downloader_start_release", {
        releaseId: release.id,
        episodes: payload,
      });

      alert(
        `Загрузка всех эпизодов (${payload.length} шт.) начата в фоновом режиме. Файлы сохраняются в папку downloads.`,
      );
    } catch (err) {
      console.error("Failed to start batch download:", err);
      alert(`Ошибка при запуске загрузки: ${err}`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return { downloadingEpIds, isDownloadingAll, handleDownload, handleDownloadAll };
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
  const { downloadingEpIds, isDownloadingAll, handleDownload, handleDownloadAll } =
    useReleaseDownloader(release);
  const { franchises, isLoading: isLoadingFranchises } = useFranchises(release.id);

  const fallbackPoster = formatPosterUrl(
    release.poster?.preview || release.poster?.src || release.poster?.thumbnail,
  );

  let currentCategory: BookmarkCategory | null = null;
  for (const [cat, list] of Object.entries(bookmarks)) {
    if (list.some((b) => b.release_id === release.id)) {
      currentCategory = cat as BookmarkCategory;
      break;
    }
  }

  const releaseHistory = history.filter((h) => h.release_id === release.id);

  const sortedEpisodes = useMemo(() => {
    return [...(release.episodes || [])].sort((a, b) => a.ordinal - b.ordinal);
  }, [release.episodes]);

  const { startEpisode, playButtonText } = useMemo(() => {
    if (!sortedEpisodes.length) {
      return { startEpisode: null, playButtonText: "Эпизоды недоступны" };
    }

    const completedEpIds = new Set(
      releaseHistory.filter((h) => h.is_completed).map((h) => h.episode_id),
    );

    // 1. If there is an in-progress episode (!is_completed && last_position > 0), continue it
    const inProgress = releaseHistory.find((h) => !h.is_completed && h.last_position > 0);
    if (inProgress) {
      const ep = sortedEpisodes.find((e) => e.id === inProgress.episode_id);
      if (ep) {
        return {
          startEpisode: ep,
          playButtonText: `Продолжить с ${ep.ordinal} эпизода`,
        };
      }
    }

    // 2. If the user has watched / completed episodes
    if (releaseHistory.length > 0) {
      const lastWatched = releaseHistory[0];
      if (lastWatched) {
        if (lastWatched.is_completed) {
          // Find next unwatched episode with higher ordinal
          const nextUnwatched = sortedEpisodes.find(
            (e) => e.ordinal > lastWatched.episode_ordinal && !completedEpIds.has(e.id),
          );
          if (nextUnwatched) {
            return {
              startEpisode: nextUnwatched,
              playButtonText: `Продолжить с ${nextUnwatched.ordinal} эпизода`,
            };
          }
          // Check for any remaining unwatched episode
          const anyUnwatched = sortedEpisodes.find((e) => !completedEpIds.has(e.id));
          if (anyUnwatched) {
            return {
              startEpisode: anyUnwatched,
              playButtonText: `Продолжить с ${anyUnwatched.ordinal} эпизода`,
            };
          }
          // All episodes completed
          return {
            startEpisode: sortedEpisodes[0],
            playButtonText: "Пересмотреть с 1 эпизода",
          };
        } else {
          const ep =
            sortedEpisodes.find((e) => e.id === lastWatched.episode_id) || sortedEpisodes[0];
          return {
            startEpisode: ep,
            playButtonText: `Продолжить с ${ep.ordinal} эпизода`,
          };
        }
      }
    }

    // 3. No watch history yet
    return {
      startEpisode: sortedEpisodes[0],
      playButtonText: "Смотреть с 1 эпизода",
    };
  }, [sortedEpisodes, releaseHistory]);

  const totalRelatedCount = franchises.reduce(
    (acc, f) => acc + (f.franchise_releases?.length || 0),
    0,
  );

  const isReleaseWatched =
    currentCategory === "WATCHED" ||
    Boolean(
      release.episodes &&
        release.episodes.length > 0 &&
        release.episodes.every((ep) =>
          history.some(
            (h) => h.release_id === release.id && h.episode_id === ep.id && h.is_completed,
          ),
        ),
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
        isWatched={isReleaseWatched}
        currentCategory={currentCategory}
        startEpisode={startEpisode}
        playButtonText={playButtonText}
        onPlay={(ep) => playEpisode(release, ep)}
        onBookmarkChange={(cat) => setBookmark(release.id, cat, release)}
        onRemoveBookmark={() => removeBookmark(release.id)}
        onOpenTorrents={() => setActiveTab("torrents")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="episodes" className="px-5">
            Эпизоды ({release.episodes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="torrents" className="px-5">
            Торренты (HEVC)
          </TabsTrigger>
          <TabsTrigger value="related" className="px-5">
            Связанное {totalRelatedCount > 0 ? `(${totalRelatedCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="episodes">
          <EpisodesTabContent
            episodes={release.episodes}
            releaseId={release.id}
            fallbackPoster={fallbackPoster}
            history={history}
            downloadingEpIds={downloadingEpIds}
            isDownloadingAll={isDownloadingAll}
            onPlay={(ep) => playEpisode(release, ep)}
            onToggleWatched={(episodeId, ordinal, completed) =>
              setEpisodeWatched(release.id, episodeId, ordinal, completed)
            }
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
          />
        </TabsContent>

        <TabsContent value="torrents">
          <TorrentsTab releaseId={release.id} />
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
