import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export default function App() {
  const [pong, setPong] = useState<string>("");

  useEffect(() => {
    invoke<string>("ping")
      .then(setPong)
      .catch((err) => console.error("Tauri ping failed:", err));
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-[#090A0F] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
        <span className="text-lg font-bold tracking-wider text-rose-500">ANIPLAYER</span>
        <span className="text-xs text-slate-400">Core Status: {pong || "Connecting..."}</span>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-slate-400 text-sm">Aniplayer v1.0.0 (Portable)</p>
      </main>
    </div>
  );
}
