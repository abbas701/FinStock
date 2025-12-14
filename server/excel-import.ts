import * as XLSX from "xlsx";
import { createStock, addTransaction, getDb } from "./db";
import { stocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    stocksProcessed: number;
    transactionsAdded: number;
    errors: string[];
  };
}

interface ParsedRow {
  date: Date | null;
  type: "BUY" | "SELL" | "DIVIDEND" | null;
  quantity: string | null;
  pricePerShare: string | null;
  totalAmount: string | null;
  rawRow: any[];
}

/**
 * Flexible Excel parser that detects column headers and extracts data
 */
export async function importExcelFile(
  fileBuffer: Buffer,
  filename: string
): Promise<ImportResult> {
  const stats = {
    stocksProcessed: 0,
    transactionsAdded: 0,
    errors: [] as string[],
  };

  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    const sheetNames = workbook.SheetNames.filter((name) => name.toLowerCase() !== "home" && name.toLowerCase() !== "template");

    if (sheetNames.length === 0) {
      return {
        success: false,
        message: "No valid sheets found (excluding 'Home' sheet)",
        stats,
      };
    }

    for (const sheetName of sheetNames) {
      try {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

        if (rows.length === 0) {
          stats.errors.push(`Sheet "${sheetName}": No data found`);
          continue;
        }

        // Find header row (look for common column names)
        const headerRowIndex = findHeaderRow(rows);
        if (headerRowIndex === -1) {
          stats.errors.push(`Sheet "${sheetName}": Could not find header row`);
          continue;
        }

        const headers = rows[headerRowIndex].map((h: any) => String(h || "").toLowerCase().trim());
        const columnMap = mapColumns(headers);

        // Parse data rows - group by stock symbol (each row may have different stock)
        const dataRows = rows.slice(headerRowIndex + 1);
        const transactionsByStock: Map<string, ParsedRow[]> = new Map();

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          if (!row || row.length === 0) continue;

          // Skip empty/incomplete rows (formula-filled rows with no actual data)
          if (isRowEmpty(row, columnMap)) {
            continue;
          }

          try {
            const parsed = parseRow(row, columnMap, i + headerRowIndex + 2, sheetName);
            
            if (parsed.date && parsed.totalAmount && parsed.type) {
              // Extract stock symbol from first column
              const stockName = row[0] ? String(row[0]).trim() : "";
              let stockSymbol = sheetName.toUpperCase().trim();
              
              if (stockName) {
                // Extract symbol (before parentheses if present, e.g., "MEBL (dividend @ Rs 7)" -> "MEBL")
                const symbolMatch = stockName.match(/^([A-Z0-9]+)/i);
                if (symbolMatch) {
                  stockSymbol = symbolMatch[1].toUpperCase();
                } else {
                  stockSymbol = stockName.toUpperCase().trim();
                }
              }

              // Group transactions by stock symbol
              if (!transactionsByStock.has(stockSymbol)) {
                transactionsByStock.set(stockSymbol, []);
              }
              transactionsByStock.get(stockSymbol)!.push(parsed);
            }
          } catch (error: any) {
            // Only log errors for rows that seemed to have data
            if (hasDataCells(row, columnMap)) {
              stats.errors.push(`Sheet "${sheetName}", Row ${i + headerRowIndex + 2}: ${error.message}`);
            }
            // Otherwise silently skip (it's just a formula-filled row)
          }
        }

        if (transactionsByStock.size === 0) {
          stats.errors.push(`Sheet "${sheetName}": No valid transactions found`);
          continue;
        }

        // Process each stock's transactions
        for (const [stockSymbol, parsedRows] of Array.from(transactionsByStock.entries())) {
          try {
            // Get or create stock
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const existingStock = await db
              .select()
              .from(stocks)
              .where(eq(stocks.symbol, stockSymbol))
              .limit(1);

            let stockId: number;
            if (existingStock.length > 0) {
              stockId = existingStock[0].id;
            } else {
              const result = await createStock(stockSymbol, stockSymbol);
              stockId = result.id;
            }

            // Add transactions for this stock
            for (const parsed of parsedRows) {
              try {
                if (!parsed.date || !parsed.type || !parsed.totalAmount) continue;

                const quantity = parsed.type === "DIVIDEND" ? null : parsed.quantity;
                await addTransaction(
                  stockId,
                  parsed.type,
                  parsed.date,
                  quantity,
                  parsed.totalAmount,
                  `Imported from ${filename}`
                );
                stats.transactionsAdded++;
              } catch (error: any) {
                stats.errors.push(
                  `Sheet "${sheetName}", Stock "${stockSymbol}": Failed to add transaction: ${error.message}`
                );
              }
            }
          } catch (error: any) {
            stats.errors.push(`Sheet "${sheetName}", Stock "${stockSymbol}": Failed to get/create stock: ${error.message}`);
          }
        }

        stats.stocksProcessed += transactionsByStock.size;

        stats.stocksProcessed++;
      } catch (error: any) {
        stats.errors.push(`Sheet "${sheetName}": ${error.message}`);
      }
    }

    return {
      success: stats.errors.length === 0 || stats.transactionsAdded > 0,
      message: `Imported ${stats.transactionsAdded} transactions from ${stats.stocksProcessed} stocks. ${stats.errors.length} errors.`,
      stats,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to import Excel file: ${error.message}`,
      stats,
    };
  }
}

/**
 * Find the header row by looking for common column names
 */
function findHeaderRow(rows: any[][]): number {
  const headerKeywords = ["date", "type", "quantity", "price", "total", "cost", "buy", "sell"];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    const rowText = row
      .map((cell) => String(cell || "").toLowerCase().trim())
      .join(" ");

    const matchCount = headerKeywords.filter((keyword) => rowText.includes(keyword)).length;
    if (matchCount >= 3) {
      return i;
    }
  }

  return -1;
}

/**
 * Map column headers to data fields
 */
function mapColumns(headers: string[]): {
  date: number | null;
  type: number | null;
  quantity: number | null;
  price: number | null;
  total: number | null;
} {
  const map: any = {
    date: null,
    type: null,
    quantity: null,
    price: null,
    total: null,
  };

  for (let i = 0; i < headers.length && i < 5; i++) {
    const header = headers[i];
    if (!header) continue;

    if (header.includes("date")) map.date = i;
    else if (header.includes("type") || header.includes("buy") || header.includes("sell")) map.type = i;
    else if (header.includes("quantity") || header.includes("qty") || header.includes("shares")) map.quantity = i;
    else if (header.includes("price") || header.includes("unit")) map.price = i;
    else if (header.includes("total") || header.includes("cost") || header.includes("amount")) map.total = i;
  }

  // Fallback: use column positions if headers not found
  if (map.date === null && headers.length > 0) map.date = 0;
  if (map.type === null && headers.length > 1) map.type = 1;
  if (map.quantity === null && headers.length > 2) map.quantity = 2;
  if (map.price === null && headers.length > 3) map.price = 3;
  if (map.total === null && headers.length > 4) map.total = 4;

  return map;
}

/**
 * Check if a row is empty or just contains formula values (0s, empty cells)
 */
function isRowEmpty(row: any[], columnMap: ReturnType<typeof mapColumns>): boolean {
  // Check if date cell is empty or just whitespace
  if (columnMap.date !== null) {
    const dateValue = row[columnMap.date];
    if (dateValue === null || dateValue === undefined || dateValue === "") {
      return true;
    }
    // Check if it's a string that's just whitespace
    if (typeof dateValue === "string" && dateValue.trim() === "") {
      return true;
    }
  }

  // Check if type cell is empty
  if (columnMap.type !== null) {
    const typeValue = row[columnMap.type];
    if (typeValue === null || typeValue === undefined || typeValue === "") {
      return true;
    }
    if (typeof typeValue === "string" && typeValue.trim() === "") {
      return true;
    }
  }

  // Check if total amount is 0 or empty (formula-filled rows often have 0)
  if (columnMap.total !== null) {
    const totalValue = row[columnMap.total];
    const totalNum = parseNumber(totalValue);
    if (totalNum === null || totalNum === 0) {
      // Also check if quantity and price are both 0 or empty
      const qtyNum = columnMap.quantity !== null ? parseNumber(row[columnMap.quantity]) : null;
      const priceNum = columnMap.price !== null ? parseNumber(row[columnMap.price]) : null;
      if ((qtyNum === null || qtyNum === 0) && (priceNum === null || priceNum === 0)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a row has any data cells filled (used for error reporting)
 */
function hasDataCells(row: any[], columnMap: ReturnType<typeof mapColumns>): boolean {
  // Check if at least date or type has a value
  const hasDate = columnMap.date !== null && 
    row[columnMap.date] !== null && 
    row[columnMap.date] !== undefined && 
    row[columnMap.date] !== "";
  
  const hasType = columnMap.type !== null && 
    row[columnMap.type] !== null && 
    row[columnMap.type] !== undefined && 
    row[columnMap.type] !== "";

  return hasDate || hasType;
}

/**
 * Parse a single row into transaction data
 * Supports format: Date, Quantity (cumulative or transaction), Total Amount (unit price = total / quantity)
 */
function parseRow(row: any[], columnMap: ReturnType<typeof mapColumns>, rowNum: number, sheetName?: string): ParsedRow {
  const result: ParsedRow = {
    date: null,
    type: null,
    quantity: null,
    pricePerShare: null,
    totalAmount: null,
    rawRow: row,
  };

  // Parse date
  if (columnMap.date !== null && row[columnMap.date] !== null && row[columnMap.date] !== undefined) {
    const dateValue = row[columnMap.date];
    if (dateValue instanceof Date) {
      result.date = dateValue;
    } else if (typeof dateValue === "number") {
      // Excel serial date
      result.date = XLSX.SSF.parse_date_code(dateValue);
    } else if (typeof dateValue === "string") {
      // Try parsing string date (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
      const parsed = parseDateString(dateValue);
      if (parsed) result.date = parsed;
    }
  }  

  // Parse type based on quantity sign and stock name
  // Check if stock name contains "dividend" (case insensitive) - check first column
  const stockName = row[0] ? String(row[0]).toLowerCase() : "";
  const hasDividendInName = stockName.includes("dividend");

  // Parse quantity to determine type
  let quantityValue: number | null = null;
  if (columnMap.quantity !== null && row[columnMap.quantity] !== null && row[columnMap.quantity] !== undefined) {
    quantityValue = parseNumber(row[columnMap.quantity]);
  }

  // Determine type based on quantity sign or dividend indicator
  if (hasDividendInName || (quantityValue === null && columnMap.total !== null)) {
    // Check if it's a dividend: empty quantity or stock name contains "dividend"
    const totalValue = columnMap.total !== null ? parseNumber(row[columnMap.total]) : null;
    if (hasDividendInName || (quantityValue === null && totalValue !== null && totalValue < 0)) {
      result.type = "DIVIDEND";
      result.quantity = null;
    }
  } else if (quantityValue !== null) {
    // Positive quantity = BUY, Negative quantity = SELL
    if (quantityValue > 0) {
      result.type = "BUY";
      result.quantity = quantityValue.toString();
    } else if (quantityValue < 0) {
      result.type = "SELL";
      result.quantity = Math.abs(quantityValue).toString(); // Store as positive
    }
  }

  // Also check explicit type column if present (for backward compatibility)
  if (columnMap.type !== null && row[columnMap.type] !== null && row[columnMap.type] !== undefined) {
    const typeValue = String(row[columnMap.type]).toUpperCase().trim();
    if (typeValue.includes("BUY") || typeValue === "B" || typeValue === "BUY") result.type = "BUY";
    else if (typeValue.includes("SELL") || typeValue === "S" || typeValue === "SELL") result.type = "SELL";
    else if (typeValue.includes("DIV") || typeValue === "D" || typeValue === "DIVIDEND") result.type = "DIVIDEND";
  }

  // Parse price per share
  if (columnMap.price !== null && row[columnMap.price] !== null && row[columnMap.price] !== undefined) {
    const price = parseNumber(row[columnMap.price]);
    if (price !== null) result.pricePerShare = price.toString();
  }

  // Parse total amount (convert negative to positive)
  if (columnMap.total !== null && row[columnMap.total] !== null && row[columnMap.total] !== undefined) {
    const total = parseNumber(row[columnMap.total]);
    if (total !== null) {
      result.totalAmount = Math.abs(total).toString(); // Store as positive
    }
  } else if (result.quantity && result.pricePerShare) {
    // Calculate total from quantity * price
    const qty = new Decimal(result.quantity);
    const price = new Decimal(result.pricePerShare);
    result.totalAmount = qty.times(price).toString();
  }

  // If we have quantity and total amount but no price, calculate price
  if (result.quantity && result.totalAmount && !result.pricePerShare) {
    const qty = new Decimal(result.quantity);
    const total = new Decimal(result.totalAmount);
    if (!qty.isZero()) {
      result.pricePerShare = total.dividedBy(qty).toString();
    }
  }

  // If we have total amount and price but no quantity, calculate quantity
  if (result.totalAmount && result.pricePerShare && !result.quantity) {
    const total = new Decimal(result.totalAmount);
    const price = new Decimal(result.pricePerShare);
    if (!price.isZero()) {
      result.quantity = total.dividedBy(price).toString();
    }
  }

  // Validate required fields
  if (!result.date) throw new Error("Date is required");
  if (!result.totalAmount || parseFloat(result.totalAmount) === 0) {
    throw new Error("Total amount is required and must be greater than 0");
  }

  // For BUY/SELL, quantity is required. For DIVIDEND, it's optional
  if (result.type && (result.type === "BUY" || result.type === "SELL") && !result.quantity) {
    throw new Error("Quantity is required for BUY/SELL transactions");
  }

  // Type must be determined
  if (!result.type) {
    throw new Error("Transaction type (BUY/SELL/DIVIDEND) could not be determined");
  }

  return result;
}

/**
 * Parse date string in various formats
 */
function parseDateString(dateStr: string): Date | null {
  // Remove time if present
  const clean = dateStr.split(" ")[0].trim();

  // Try DD/MM/YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try MM/DD/YYYY
  const mmddyyyy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD
  const yyyymmdd = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try native Date parse
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

/**
 * Parse number from various formats
 * Returns null for empty/invalid values, 0 for actual zero values
 */
function parseNumber(value: any): number | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;
  
  // Handle empty strings
  if (typeof value === "string" && value.trim() === "") return null;
  
  // Handle numbers
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  
  // Handle strings
  if (typeof value === "string") {
    // Remove commas and currency symbols
    const cleaned = value.replace(/[,\s₹$€£PKR]/gi, "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

