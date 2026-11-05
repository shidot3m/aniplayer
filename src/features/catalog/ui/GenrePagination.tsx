import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";

type PageItem = number | "ellipsis";

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  const items: PageItem[] = [];
  let previousPage = 0;
  for (const page of sorted) {
    if (previousPage > 0 && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
    previousPage = page;
  }
  return items;
}

interface GenrePaginationProps {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

export function GenrePagination({
  currentPage,
  totalPages,
  disabled = false,
  onPageChange,
}: GenrePaginationProps) {
  if (totalPages <= 1) return null;

  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <nav aria-label="Страницы жанра" className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || disabled}
          aria-label="Предыдущая страница"
          className="h-11 gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </Button>

        {pageItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-before-${pageItems[index + 1]}`}
                aria-hidden="true"
                className="px-1 text-sm text-ink-2"
              >
                …
              </span>
            );
          }
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              disabled={item === currentPage || disabled}
              aria-label={`Страница ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
              className={`h-11 min-w-11 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                item === currentPage
                  ? "border-accent bg-accent text-ink shadow-md shadow-scrim/40"
                  : "cursor-pointer border-line bg-ink/[0.04] text-ink-2 hover:bg-ink/[0.08] hover:text-ink"
              }`}
            >
              {item}
            </button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || disabled}
          aria-label="Следующая страница"
          className="h-11 gap-1"
        >
          <span className="hidden sm:inline">Вперёд</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-ink-2">
        Страница {currentPage} из {totalPages}
      </p>
    </nav>
  );
}
