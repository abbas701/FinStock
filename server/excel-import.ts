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
  date: Date;
  stockSymbol: string;
  quantity: string;
  totalAmount: string;
  pricePerShare?: string; // Optional, can be calculated
  type?: "BUY" | "SELL" | "DIVIDEND"; // Optional, derived from quantity
}

/**
 * Flexible Excel parser that detects column headers and extracts data
 */
export async function importExcelFile(
  userId: number,
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
    // Use the first sheet that is not "template"
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase() !== "template") || workbook.SheetNames[0];

    if (!sheetName) {
      return {
        success: false,
        message: "No sheets found",
        stats,
      };
    }

    try {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

      if (rows.length === 0) {
        return {
          success: false,
          message: "Sheet is empty",
          stats
        };
      }

      // Find header row
      const headerRowIndex = findHeaderRow(rows);
      if (headerRowIndex === -1) {
        return {
          success: false,
          message: "Could not find header row. Expected columns: Stock, Quantity, Total Amount, Date",
          stats
        };
      }

      const headers = rows[headerRowIndex].map((h: any) => String(h || "").toLowerCase().trim());
      const columnMap = mapColumns(headers);

      // Validate required columns
      if (columnMap.stock === null) {
        return {
          success: false,
          message: "Could not find 'Stock' column",
          stats
        };
      }

      const dataRows = rows.slice(headerRowIndex + 1);
      const transactionsByStock: Map<string, ParsedRow[]> = new Map();

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0) continue;

        if (isRowEmpty(row, columnMap)) continue;

        try {
          const parsed = parseRow(row, columnMap);

          if (parsed && parsed.stockSymbol) {
            const symbol = parsed.stockSymbol.toUpperCase().trim();
            if (!transactionsByStock.has(symbol)) {
              transactionsByStock.set(symbol, []);
            }
            transactionsByStock.get(symbol)!.push(parsed);
          }
        } catch (error: any) {
          if (hasDataCells(row, columnMap)) {
            stats.errors.push(`Row ${i + headerRowIndex + 2}: ${error.message}`);
          }
        }
      }

      if (transactionsByStock.size === 0) {
        return {
          success: false,
          message: "No valid transactions found",
          stats
        };
      }

      // Process grouped transactions
      for (const [stockSymbol, parsedRows] of Array.from(transactionsByStock.entries())) {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database unavailable");

          const existingStock = await db.select().from(stocks).where(eq(stocks.symbol, stockSymbol)).limit(1);
          let stockId: number;

          if (existingStock.length > 0) {
            stockId = existingStock[0].id;
          } else {
            const result = await createStock(stockSymbol, stockSymbol);
            stockId = result.id;
          }

          for (const parsed of parsedRows) {
            try {
              // quantity is negative for SELL, positive for BUY
              // totalAmount needs to be positive for the API usually

              let type: "BUY" | "SELL" | "DIVIDEND" = "BUY";
              let qty = parseFloat(parsed.quantity);
              let amount = parseFloat(parsed.totalAmount);

              // Determine type based on quantity sign
              if (qty < 0) {
                type = "SELL";
                qty = Math.abs(qty);
              } else if (qty > 0) {
                type = "BUY";
              } else {
                // Quantity 0
                if (amount !== 0) {
                  type = "DIVIDEND"; // Assumption: 0 qty but non-zero amount is dividend
                } else {
                  continue;
                }
              }

              // Handle explicit type column if present override
              // (Not implementing explicit type column override for now as per user req, rely on quantity sign)

              // Amount should be positive for the DB usually
              amount = Math.abs(amount);

              await addTransaction(
                userId,
                stockId,
                type,
                parsed.date,
                type === "DIVIDEND" ? null : qty.toString(),
                amount.toString(),
                `Imported from ${filename}`
              );
              stats.transactionsAdded++;
            } catch (e: any) {
              stats.errors.push(`Stock ${stockSymbol}: ${e.message}`);
            }
          }

        } catch (e: any) {
          stats.errors.push(`Stock ${stockSymbol}: ${e.message}`);
        }
      }

      stats.stocksProcessed = transactionsByStock.size;

    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        stats
      };
    }

    return {
      success: stats.errors.length === 0 || stats.transactionsAdded > 0,
      message: `Imported ${stats.transactionsAdded} transactions for ${stats.stocksProcessed} stocks. ${stats.errors.length} errors.`,
      stats
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Failed to import Excel file: ${error.message}`,
      stats,
    };
  }
}

function mapColumns(headers: string[]) {
  const map: any = { date: null, stock: null, quantity: null, total: null };
  headers.forEach((h, i) => {
    if (h.includes("date")) map.date = i;
    else if (h.includes("stock") || h.includes("symbol") || h.includes("scrip")) map.stock = i;
    else if (h.includes("quantity") || h.includes("qty")) map.quantity = i;
    else if (h.includes("total") || h.includes("amount") || h.includes("cost") || h.includes("value")) map.total = i;
  });
  return map;
}

function parseRow(row: any[], map: any): ParsedRow | null {
  if (map.date === null || map.stock === null || map.quantity === null || map.total === null) return null;

  // Date
  let date: Date | null = null;
  const d = row[map.date];
  if (d instanceof Date) date = d;
  else if (typeof d === "number") date = XLSX.SSF.parse_date_code(d);
  else if (typeof d === "string") date = parseDateString(d);

  const stock = row[map.stock] ? String(row[map.stock]).trim() : null;
  const qtyRaw = row[map.quantity];
  const totalRaw = row[map.total];

  if (!date || !stock || qtyRaw === undefined || qtyRaw === null || totalRaw === undefined || totalRaw === null) return null;

  // Clean numbers
  const qty = parseNumber(qtyRaw);
  const total = parseNumber(totalRaw);

  if (qty === null || total === null) return null;

  return {
    date,
    stockSymbol: stock,
    quantity: String(qty),
    totalAmount: String(total)
  };
}

/**
 * Find the header row by looking for common column names
 */
function findHeaderRow(rows: any[][]): number {
  const headerKeywords = ["date", "stock", "symbol", "quantity", "price", "total", "amount"];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    const rowText = row
      .map((cell) => String(cell || "").toLowerCase().trim())
      .join(" ");

    const matchCount = headerKeywords.filter((keyword) => rowText.includes(keyword)).length;
    // We expect at least Stock, Date, Quantity, Total (4 usually)
    if (matchCount >= 3) {
      return i;
    }
  }

  return -1;
}

/**
 * Check if a row is empty or just contains formula values (0s, empty cells)
 */
function isRowEmpty(row: any[], columnMap: any): boolean {
  // Check if date cell is empty or just whitespace
  if (columnMap.date !== null) {
    const dateValue = row[columnMap.date];
    if (dateValue === null || dateValue === undefined || dateValue === "") {
      return true;
    }
    if (typeof dateValue === "string" && dateValue.trim() === "") {
      return true;
    }
  }
  return false;
}

/**
 * Check if a row has any data cells filled (used for error reporting)
 */
function hasDataCells(row: any[], columnMap: any): boolean {
  return columnMap.stock !== null && row[columnMap.stock];
}

/**
 * Parse date string in various formats
 */
function parseDateString(dateStr: string): Date | null {
  // Remove time if present
  const clean = dateStr.split(" ")[0].trim();

  // Try DD-MMM-YY (e.g. 07-Aug-25)
  const ddmmmyy = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (ddmmmyy) {
    const [, day, monthStr, yearStr] = ddmmmyy;
    const monthMap: { [key: string]: number } = {
      "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
      "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11
    };
    const month = monthMap[monthStr.toLowerCase()];
    const year = parseInt(yearStr) + 2000; // Assume 20xx
    if (month !== undefined) {
      return new Date(year, month, parseInt(day));
    }
  }

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
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s₹$€£PKR]/gi, "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
