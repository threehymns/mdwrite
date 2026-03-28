import type { HugeiconsIconProps } from "@hugeicons/react";
import * as React from "react";

export interface Action {
  id: string;
  title: string;
  description?: string;
  icon?: React.FC<HugeiconsIconProps>;
  shortcut?: string[];
  perform: () => void | Promise<void>;
  section?: string;
}

export const useActionsRegistry = () => {
  const [actions, setActions] = React.useState<Action[]>([]);

  const registerAction = React.useCallback((action: Action) => {
    setActions((prev) => {
      if (prev.find((a) => a.id === action.id)) return prev;
      return [...prev, action];
    });
  }, []);

  const unregisterAction = React.useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { actions, registerAction, unregisterAction };
};

// Global registry for static actions or a simpler approach if we don't need dynamic registration everywhere
export const staticActions: Action[] = [];

export function registerStaticAction(action: Action) {
  if (!staticActions.find((a) => a.id === action.id)) {
    staticActions.push(action);
  }
}
