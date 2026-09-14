import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AnimeCard } from "../src/components/AnimeCard";
import type { Release } from "../src/types";

describe("AnimeCard", () => {
  it("renders correctly with API fields without fallback artifacts", () => {
    const mockRelease: Release = {
      id: 10239,
      name: {
        main: "Адский режим",
        english: "Hell Mode",
        alternative: "ヘルモード",
      },
      type: {
        value: "tv",
        description: "ТВ",
      },
      year: 2025,
      season: {
        value: "winter",
        description: "Зима",
      },
      poster: {
        src: "/poster.jpg",
        preview: "/preview.jpg",
        thumbnail: "/thumb.jpg",
      },
      description: "Тестовое описание",
      episodes_total: 12,
      average_duration_of_episode: 24,
      genres: [{ id: 1, name: "Приключения" }],
      episodes: [],
    };

    render(<AnimeCard release={mockRelease} onClick={() => {}} />);
    expect(screen.getByText("Адский режим")).toBeDefined();
    expect(screen.getByText("ТВ")).toBeDefined();
    expect(screen.getByText(/12 эп/)).toBeDefined();
  });
});
