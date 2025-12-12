import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format PKR currency string
 */
export function formatCurrency(pkr: number | string): string {
  const amount = typeof pkr === "string" ? parseFloat(pkr) : pkr;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
