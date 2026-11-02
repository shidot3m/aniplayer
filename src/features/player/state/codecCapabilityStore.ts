import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { CodecCapabilityReport } from "@/shared/types";
import { probeCodecCapabilities } from "../lib/codecCapability";

interface CodecCapabilityState {
  report: CodecCapabilityReport | null;
  probed: boolean;
  probe: () => Promise<void>;
}

/**
 * What this WebView can actually decode. The report is handed to the backend as
 * soon as it exists: the torrent scanner indexes on completion, and an episode
 * indexed for a codec nobody can decode opens on a black frame.
 */
export const useCodecCapabilityStore = create<CodecCapabilityState>((set, get) => ({
  report: null,
  probed: false,

  probe: async () => {
    if (get().probed) return;

    const report = await probeCodecCapabilities();
    set({ report, probed: true });

    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      await invoke("app_report_codec_capability", { report });
    } catch (err) {
      console.error("Failed to report codec capabilities to the backend:", err);
    }
  },
}));
