import * as React from "react";

export interface ShortcutMap {
  [actionId: string]: string[];
}

const SHORTCUTS_STORAGE_KEY = "mdwrite-shortcuts";

const DEFAULT_SHORTCUTS: ShortcutMap = {
  "new-file": ["ctrl", "n"],
  search: ["ctrl", "k"],
  "toggle-sidebar": ["ctrl", "b"],
  "open-folder": ["ctrl", "o"],
  "command-bar": ["ctrl", "p"],
};

export const useKeyboardShortcuts = () => {
  const [shortcuts, setShortcuts] = React.useState<ShortcutMap>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
    }
    return DEFAULT_SHORTCUTS;
  });

  const updateShortcut = React.useCallback(
    (actionId: string, keys: string[]) => {
      setShortcuts((prev) => {
        const next = { ...prev, [actionId]: keys };
        localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const resetShortcuts = React.useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    localStorage.setItem(
      SHORTCUTS_STORAGE_KEY,
      JSON.stringify(DEFAULT_SHORTCUTS),
    );
  }, []);

  return { shortcuts, updateShortcut, resetShortcuts };
};
