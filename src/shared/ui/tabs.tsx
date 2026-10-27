import * as React from "react";
import { cn } from "../lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-start rounded-xl bg-[#12131A] p-1 text-slate-400 border border-white/10 gap-1 overflow-x-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function useTabsContext(caller: string): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error(`${caller} must be used within Tabs`);
  return context;
}

export function TabsTrigger({ value, children, className }: TabItemProps) {
  const context = useTabsContext("TabsTrigger");
  const isSelected = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-hidden cursor-pointer",
        isSelected
          ? "bg-rose-600 text-white shadow-xs"
          : "hover:bg-white/5 hover:text-slate-200 text-slate-400",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: TabItemProps) {
  const context = useTabsContext("TabsContent");
  if (context.value !== value) return null;

  return <div className={cn("mt-4", className)}>{children}</div>;
}
