import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

export function Dialog({
  isOpen,
  onClose,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="fixed inset-0 bg-scrim/80 backdrop-blur-md transition-opacity cursor-default"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-50 w-full max-w-lg rounded-2xl border border-ink/15 bg-ground/90 backdrop-blur-2xl p-6 shadow-2xl transition-all text-ink",
          className,
        )}
      >
        <button
          type="button"
          aria-label="Закрыть окно"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-2 hover:bg-ink/10 hover:text-ink transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-col space-y-1.5 text-left", className)}>{children}</div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-lg font-bold leading-none tracking-tight text-ink", className)}>
      {children}
    </h3>
  );
}
