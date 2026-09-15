# Aniplayer Handoff Document

**Date:** 2026-09-15  
**Workspace:** `E:/Coding/Aniplayer`  
**Latest Git Commit:** `HEAD`  
**Target Focus:** WebGPU Anime4K Implementation, UI/State Stabilization, and Build Packaging.

---

## 1. Executive Summary

Aniplayer is a high-performance anime player for Windows built with **Tauri v2 (Rust)** and **React 19 + TypeScript + Tailwind CSS v4**.

In this implementation session, the focus shifted towards finalizing the WebGPU hardware-accelerated Anime4K upscaling, stabilizing the player UI state, and creating a distributable setup archive.

**Key Achievements:**
1. **True Anime4K WebGPU CNN Pipeline:**
   - Completely rewrote `src/components/player/Anime4kCanvas.tsx` to utilize the `anime4k-webgpu` library.
   - Replaced the flawed, single-pass WebGL approximation with a genuine multi-pass WebGPU Convolutional Neural Network (CNN) pipeline that perfectly matches the upscaling quality of standalone MPV shaders (Modes A, A+A, B, B+B, C, C+A).
   - Implemented an internal `requestVideoFrameCallback` render loop that flawlessly manages WebGPU device contexts, texture bindings, and command encoders while minimizing overhead.
2. **Player State Synchronization Fixes:**
   - Fixed critical UI bugs in `src/store/playerStore.ts` where the `syncFromBackend` loop was aggressively overwriting frontend state (`isPlaying` and `anime4kPreset`) with data from an idle/stopped MPV backend.
   - Play/Pause toggling is now instant and reliable, and Anime4K preset selections in the Settings tab retain their visual highlight across app restarts.
3. **UI Polish (shadcn):**
   - Replaced a custom, buggy toggle switch in `src/components/ui/switch.tsx` (which had alignment and animation issues) with the standard `@radix-ui/react-switch` component, fully adhering to shadcn UI guidelines.
4. **Release Packaging:**
   - Executed a full release build (`bun tauri build`) and bundled the resulting NSIS `.exe` installer into a distributable archive (`Aniplayer-Setup.zip`).

---

## 2. Architecture & Key Seams

### 2.1 Frontend (React 19 / TypeScript / Zustand)
* [`src/components/player/Anime4kCanvas.tsx`](file:///E:/Coding/Aniplayer/src/components/player/Anime4kCanvas.tsx): Upgraded to WebGPU. Captures `<video>` frames directly to `GPUTexture`, runs them through `anime4k-webgpu` CNN passes, and renders the upscaled result to the canvas.
* [`src/store/playerStore.ts`](file:///E:/Coding/Aniplayer/src/store/playerStore.ts): `syncFromBackend` now includes a strict `if (dur > 0 && cur >= 0)` guard, ensuring backend synchronization only occurs during active MPV playback.
* [`src/components/ui/switch.tsx`](file:///E:/Coding/Aniplayer/src/components/ui/switch.tsx): Modernized using `@radix-ui/react-switch` for pixel-perfect animations and state management.

### 2.2 Backend (Rust / Tauri v2)
* The Rust backend continues to support headless BitTorrent downloading and filesystem scanning, with MPV providing fallback backend playback when required.

---

## 3. Verification & Health Status

| Suite | Status | Details |
|---|---|---|
| **Vite & TSC** | ✅ **Build clean** | `bun run build` built successfully with 0 type errors. `copyExternalImageToTexture` WebGPU arguments fully validated. |
| **Vitest** | ✅ **Passing** | Player state, quality fallback logic, and store defaults all pass unit tests. |
| **Tauri Build** | ✅ **Success** | `bun tauri build` completed successfully, producing NSIS `.exe`. |

---

## 4. Next Session Focus

1. **Documentation Expansion ("в docs"):**
   - The user requested to focus on "docs". The next session should focus on expanding architectural documentation, writing code-level READMEs for the WebGPU integration, or generating an updated `AGENTS.md` and `CLAUDE.md`.
2. **Suggested Skills for Next Agent:**
   - Invoke `agents-md` and `create-agentsmd` to establish rock-solid repository guidelines for future AI agents.
   - Read `tauri-v2` and `shadcn` skills to ensure future UI/Backend modifications follow best practices.
