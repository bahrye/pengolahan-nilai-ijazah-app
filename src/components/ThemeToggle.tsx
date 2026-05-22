"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <span className="inline-flex h-9 w-9" />;

  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label="Ganti tema"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="ui-btn ui-btn-ghost ui-btn-sm !min-h-9 !min-w-9 !px-0 text-slate-700 dark:text-slate-200"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
