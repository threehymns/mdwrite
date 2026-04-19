import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSafeUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;

  // Block dangerous protocols
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return false;
  }

  return true;
}
