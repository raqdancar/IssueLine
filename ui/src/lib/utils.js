// Agrupa funcions compartides per accedir a dades i normalitzar informacio.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
