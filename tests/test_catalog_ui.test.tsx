import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimeCard, CatalogHero, ReleasesRail } from "@/features/catalog";
import type { Release } from "../src/shared/types";

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

describe("AnimeCard", () => {
  it("renders correctly with API fields without fallback artifacts", () => {
    render(<AnimeCard release={mockRelease} onClick={() => {}} />);
    expect(screen.getByText("Адский режим")).toBeDefined();
    expect(screen.getByText("ТВ")).toBeDefined();
    expect(screen.getByText(/12 эп/)).toBeDefined();
  });
});

describe("CatalogHero", () => {
  it("names the featured release and opens it from the primary action", () => {
    const onOpen = vi.fn();
    render(<CatalogHero release={mockRelease} onOpen={onOpen} />);

    expect(screen.getByRole("heading", { name: "Адский режим" })).toBeDefined();
    expect(screen.getByText("Тестовое описание")).toBeDefined();
    // meta carries the fields the model really has: type, year, episode count
    expect(screen.getByText("12 эпизодов")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Смотреть" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders no trending badge — the hero is the newest release and speaks for itself", () => {
    const { container } = render(<CatalogHero release={mockRelease} onOpen={() => {}} />);
    expect(container.textContent).not.toMatch(/в тренде|trend/i);
  });
});

describe("ReleasesRail", () => {
  it("lays the posters out as a horizontal rail with the count stated as text", () => {
    render(
      <ReleasesRail title="Новые релизы" releases={[mockRelease]} onSelectRelease={() => {}} />,
    );
    expect(screen.getByRole("heading", { name: "Новые релизы" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Открыть Адский режим" })).toBeDefined();
    // the count is a quiet number, not a pill
    expect(screen.getByText("1")).toBeDefined();
  });
});
