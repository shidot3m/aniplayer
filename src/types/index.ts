export type BookmarkCategory =
  | "WATCHING"
  | "PLANNED"
  | "POSTPONED"
  | "ABANDONED"
  | "NOT_INTERESTED"
  | "FAVORITES"
  | "WATCHED";

export interface ReleaseName {
  main: string;
  english?: string | null;
  alternative?: string | null;
}

export interface ReleaseType {
  value?: string | null;
  description?: string | null;
}

export interface ImageOptimized {
  src?: string | null;
  thumbnail?: string | null;
}

export interface ImageSource {
  src?: string | null;
  preview?: string | null;
  thumbnail?: string | null;
  optimized?: ImageOptimized | null;
}

export interface SkipTimecode {
  start?: number | null;
  stop?: number | null;
}

export interface EpisodeItem {
  id: string;
  name?: string | null;
  ordinal: number;
  duration?: number | null;
  preview?: ImageSource | null;
  hls_480?: string | null;
  hls_720?: string | null;
  hls_1080?: string | null;
  opening?: SkipTimecode | null;
  ending?: SkipTimecode | null;
}

export interface GenreItem {
  id: number;
  name: string;
}

export interface ReleasePreview {
  id: number;
  name: ReleaseName;
  type?: ReleaseType | null;
  year?: number | null;
  episodes_total?: number | null;
  poster?: ImageSource | null;
  description?: string | null;
  is_ongoing?: boolean | null;
}

export interface ReleaseDetails extends ReleasePreview {
  average_duration_of_episode?: number | null;
  genres?: GenreItem[] | null;
  episodes: EpisodeItem[];
}

export interface TorrentCodec {
  value: string;
  label: string;
}

export interface TorrentItem {
  id: number;
  hash: string;
  size?: number | null;
  label?: string | null;
  codec?: TorrentCodec | null;
  filename?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  magnet?: string | null;
}

export interface BookmarkItem {
  release_id: number;
  category: BookmarkCategory;
  release_data_json: string;
  updated_at?: string | null;
}

export interface HistoryItem {
  release_id: number;
  episode_id: string;
  episode_ordinal: number;
  last_position: number;
  duration: number;
  is_completed: boolean;
  updated_at?: string | null;
}

export interface DownloadedEpisodeMeta {
  episode_id: string;
  release_id: number;
  episode_ordinal: number;
  file_path: string;
  file_size: number;
  quality: string;
  opening_start?: number | null;
  opening_stop?: number | null;
  ending_start?: number | null;
  ending_stop?: number | null;
  download_status: "PENDING" | "DOWNLOADING" | "COMPLETED" | "FAILED";
}
