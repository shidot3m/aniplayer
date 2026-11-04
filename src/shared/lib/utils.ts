import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Whether the page runs inside the Tauri shell, where `invoke` reaches the Rust backend. */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function formatTime(seconds: number): string {
  if (Number.isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mStr = m < 10 ? `0${m}` : `${m}`;
  const sStr = s < 10 ? `0${s}` : `${s}`;
  return `${mStr}:${sStr}`;
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (!minutes) return "~24 мин";
  return `${minutes} мин`;
}

export function formatTotalWatchTime(episodesCount: number, avgMinutes: number): string {
  const totalMin = episodesCount * (avgMinutes || 24);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} мин`;
  return `${hours} ч ${mins} мин`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 Б";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / k ** i;
  return `${val.toFixed(val < 10 ? 1 : 0)} ${sizes[i]}`;
}
