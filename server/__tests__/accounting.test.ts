import { describe, it, expect } from "vitest";
import { processTransaction } from "../db";
import Decimal from "decimal.js";
import { Transaction } from "../../drizzle/schema";

describe("Moving-Average Accounting Logic", () => {
  /**
   * Test Case: KEL (Kisan Electric) Example
   * This is the example provided in the requirements
   */
  describe("KEL Example - Complete Buy/Sell Scenario", () => {
    it("should calculate average cost correctly after multiple buys", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      // BUY 1: 100 shares at 500 PKR each = 50,000 PKR total (5,000,000 paise)
      const buy1: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: new Date("2024-01-01"),
        quantity: "100",
        totalAmount: 5000000, // 50,000 PKR in paise
        unitPrice: "50000",
        notes: "Buy 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy1);
      expect(state.totalShares.toString()).toBe("100");
      expect(state.totalInvested.toString()).toBe("5000000");
      expect(state.avgCost.toString()).toBe("50000"); // 5,000,000 / 100 = 50,000

      // BUY 2: 50 shares at 600 PKR each = 30,000 PKR total (3,000,000 paise)
      const buy2: Transaction = {
        id: 2,
        stockId: 1,
        type: "BUY",
        date: new Date("2024-01-05"),
        quantity: "50",
        totalAmount: 3000000, // 30,000 PKR in paise
        unitPrice: "60000",
        notes: "Buy 2",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy2);
      expect(state.totalShares.toString()).toBe("150");
      expect(state.totalInvested.toString()).toBe("8000000");
      // avg_cost = 8,000,000 / 150 = 53,333.33 paise
      expect(new Decimal(state.avgCost).toDecimalPlaces(2).toString()).toBe("53333.33");
    });

    it("should calculate realized profit correctly on sell", () => {
      let state = {
        totalShares: new Decimal(150),
        totalInvested: new Decimal(8000000),
        avgCost: new Decimal("53333.33"),
        realizedProfit: new Decimal(0),
      };

      // SELL: 75 shares at 700 PKR each = 52,500 PKR total (5,250,000 paise)
      const sell: Transaction = {
        id: 3,
        stockId: 1,
        type: "SELL",
        date: new Date("2024-01-10"),
        quantity: "75",
        totalAmount: 5250000, // 52,500 PKR in paise
        unitPrice: "70000",
        notes: "Sell 75 shares",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 5,250,000 paise
      // cost_removed = 53,333.33 * 75 = 4,000,000 paise (approx)
      // realized_profit = 5,250,000 - 4,000,000 = 1,250,000 paise
      const expectedCostRemoved = new Decimal("53333.33").times(75);
      const expectedProfit = new Decimal(5250000).minus(expectedCostRemoved);

      expect(state.totalShares.toString()).toBe("75");
      expect(state.realizedProfit.toDecimalPlaces(0).toString()).toBe(expectedProfit.toDecimalPlaces(0).toString());
      expect(new Decimal(state.avgCost).toDecimalPlaces(2).toString()).toBe("53333.33");
    });
  });

  /**
   * Test Case: Simple Buy and Sell
   */
  describe("Simple Buy and Sell", () => {
    it("should handle a simple buy transaction", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      const buy: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: new Date(),
        quantity: "10",
        totalAmount: 100000, // 1000 PKR in paise
        unitPrice: "10000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy);

      expect(state.totalShares.toString()).toBe("10");
      expect(state.totalInvested.toString()).toBe("100000");
      expect(state.avgCost.toString()).toBe("10000");
      expect(state.realizedProfit.toString()).toBe("0");
    });

    it("should handle a sell transaction with profit", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(100000),
        avgCost: new Decimal(10000),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 2,
        stockId: 1,
        type: "SELL",
        date: new Date(),
        quantity: "5",
        totalAmount: 75000, // 750 PKR in paise (150 PKR per share)
        unitPrice: "15000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 75,000 paise
      // cost_removed = 10,000 * 5 = 50,000 paise
      // realized_profit = 75,000 - 50,000 = 25,000 paise
      expect(state.totalShares.toString()).toBe("5");
      expect(state.totalInvested.toString()).toBe("50000");
      expect(state.avgCost.toString()).toBe("10000");
      expect(state.realizedProfit.toString()).toBe("25000");
    });

    it("should handle a sell transaction with loss", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(100000),
        avgCost: new Decimal(10000),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 2,
        stockId: 1,
        type: "SELL",
        date: new Date(),
        quantity: "5",
        totalAmount: 40000, // 400 PKR in paise (80 PKR per share)
        unitPrice: "8000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 40,000 paise
      // cost_removed = 10,000 * 5 = 50,000 paise
      // realized_profit = 40,000 - 50,000 = -10,000 paise (loss)
      expect(state.totalShares.toString()).toBe("5");
      expect(state.totalInvested.toString()).toBe("50000");
      expect(state.realizedProfit.toString()).toBe("-10000");
    });
  });

  /**
   * Test Case: Dividend Transactions
   */
  describe("Dividend Transactions", () => {
    it("should add dividend to realized profit without changing shares", () => {
      let state = {
        totalShares: new Decimal(100),
        totalInvested: new Decimal(1000000),
        avgCost: new Decimal(10000),
        realizedProfit: new Decimal(0),
      };

      const dividend: Transaction = {
        id: 1,
        stockId: 1,
        type: "DIVIDEND",
        date: new Date(),
        quantity: null,
        totalAmount: 50000, // 500 PKR dividend in paise
        unitPrice: null,
        notes: "Dividend payout",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, dividend);

      expect(state.totalShares.toString()).toBe("100");
      expect(state.totalInvested.toString()).toBe("1000000");
      expect(state.avgCost.toString()).toBe("10000");
      expect(state.realizedProfit.toString()).toBe("50000");
    });

    it("should accumulate multiple dividends", () => {
      let state = {
        totalShares: new Decimal(100),
        totalInvested: new Decimal(1000000),
        avgCost: new Decimal(10000),
        realizedProfit: new Decimal(0),
      };

      const dividend1: Transaction = {
        id: 1,
        stockId: 1,
        type: "DIVIDEND",
        date: new Date("2024-01-01"),
        quantity: null,
        totalAmount: 50000,
        unitPrice: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dividend2: Transaction = {
        id: 2,
        stockId: 1,
        type: "DIVIDEND",
        date: new Date("2024-06-01"),
        quantity: null,
        totalAmount: 50000,
        unitPrice: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, dividend1);
      state = processTransaction(state, dividend2);

      expect(state.realizedProfit.toString()).toBe("100000");
    });
  });

  /**
   * Test Case: Selling All Shares
   */
  describe("Selling All Shares", () => {
    it("should set avg_cost to 0 when all shares are sold", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(100000),
        avgCost: new Decimal(10000),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 1,
        stockId: 1,
        type: "SELL",
        date: new Date(),
        quantity: "10",
        totalAmount: 150000, // 1500 PKR in paise
        unitPrice: "15000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      expect(state.totalShares.toString()).toBe("0");
      expect(state.totalInvested.toString()).toBe("0");
      expect(state.avgCost.toString()).toBe("0");
      expect(state.realizedProfit.toString()).toBe("50000");
    });
  });

  /**
   * Test Case: Multiple Buys and Sells
   */
  describe("Complex Scenario with Multiple Transactions", () => {
    it("should handle a complex sequence of buys and sells", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      // BUY 100 @ 100
      const buy1: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: new Date(),
        quantity: "100",
        totalAmount: 1000000,
        unitPrice: "10000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, buy1);
      expect(state.avgCost.toString()).toBe("10000");

      // BUY 50 @ 120
      const buy2: Transaction = {
        id: 2,
        stockId: 1,
        type: "BUY",
        date: new Date(),
        quantity: "50",
        totalAmount: 600000,
        unitPrice: "12000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, buy2);
      // avg_cost = 1,600,000 / 150 = 10,666.67
      expect(new Decimal(state.avgCost).toDecimalPlaces(2).toString()).toBe("10666.67");

      // SELL 75 @ 150
      const sell: Transaction = {
        id: 3,
        stockId: 1,
        type: "SELL",
        date: new Date(),
        quantity: "75",
        totalAmount: 1125000,
        unitPrice: "15000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, sell);
      // proceeds = 1,125,000
      // cost_removed = 10,666.67 * 75 = 800,000
      // realized_profit = 1,125,000 - 800,000 = 325,000
      expect(state.totalShares.toString()).toBe("75");
      expect(new Decimal(state.realizedProfit).toDecimalPlaces(0).toString()).toMatch(/32[0-9]{4}/);
    });
  });

  /**
   * Test Case: Decimal Precision
   */
  describe("Decimal Precision and Rounding", () => {
    it("should maintain precision with decimal quantities", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      const buy: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: new Date(),
        quantity: "10.5",
        totalAmount: 1050000, // 10,500 PKR in paise
        unitPrice: "100000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy);

      expect(state.totalShares.toString()).toBe("10.5");
      expect(state.avgCost.toString()).toBe("100000");
    });
  });
});
