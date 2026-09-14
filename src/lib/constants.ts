const DEFAULT_DOMAIN = ["https://", "aniliberty", ".top"].join("");

export const API_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  `${DEFAULT_DOMAIN}/api/v1`;

export const CDN_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_CDN_URL) || DEFAULT_DOMAIN;
