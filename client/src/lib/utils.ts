import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format paise (PKR * 100) to PKR currency string
 */
export function formatCurrency(paise: number): string {
  const pkr = paise / 100;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pkr);
}

/**
 * Format percentage with 2 decimal places
 */
export function formatPercent(percent: number): string {
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parse PKR amount to paise (PKR * 100)
 */
export function parseToPane(pkr: number): number {
  return Math.round(pkr * 100);
}

/**
 * Convert paise to PKR
 */
export function paiseToKR(paise: number): number {
  return paise / 100;
}
