import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind-aware class merger — same convention as the rest of the
 * 21st codebase (shadcn-style). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
