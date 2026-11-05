import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        contentRef.current &&
        !contentRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, containerRef, contentRef }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        context.setIsOpen((prev) => !prev);
      }}
      className={cn(
        "inline-block cursor-pointer bg-transparent border-0 p-0 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink rounded-lg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  align = "right",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const context = React.useContext(DropdownContext);
  const [coords, setCoords] = React.useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }>({});

  const isOpen = context?.isOpen ?? false;
  const containerRef = context?.containerRef;
  const contentRef = context?.contentRef;

  React.useLayoutEffect(() => {
    if (!isOpen || !containerRef?.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 220 && rect.top > 220;

      const newCoords: { top?: number; bottom?: number; left?: number; right?: number } = {};

      if (openUpwards) {
        newCoords.bottom = Math.max(8, window.innerHeight - rect.top + 6);
      } else {
        newCoords.top = Math.max(8, rect.bottom + 6);
      }

      if (align === "right") {
        newCoords.right = Math.max(8, window.innerWidth - rect.right);
      } else {
        newCoords.left = Math.max(8, rect.left);
      }

      setCoords(newCoords);
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, containerRef, align]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={contentRef}
      style={{
        position: "fixed",
        top: coords.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: coords.left !== undefined ? `${coords.left}px` : undefined,
        right: coords.right !== undefined ? `${coords.right}px` : undefined,
        zIndex: 99999,
      }}
      className={cn(
        "min-w-[12rem] rounded-xl border border-ink/15 bg-ground/95 p-1.5 shadow-2xl backdrop-blur-2xl transition-all text-ink",
        className,
      )}
    >
      {children}
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const context = React.useContext(DropdownContext);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
    context?.setIsOpen(false);
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleSelect}
      className={cn(
        "flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-left text-ink hover:bg-ink/10 transition-colors bg-transparent border-0 focus:outline-hidden focus-visible:bg-ink/10",
        className,
      )}
    >
      {children}
    </button>
  );
}
