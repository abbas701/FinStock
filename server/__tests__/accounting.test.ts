import { describe, it, expect } from "vitest";
import { processTransaction } from "../db";
import Decimal from "decimal.js";
import { Transaction } from "../../drizzle/schema";

describe("Moving-Average Accounting Logic", () => {
  /**
   * Test Case: KEL (Kisan Electric) Example
   * This is the example provided in the requirements
   * All amounts are in PKR (not paise)
   */
  describe("KEL Example - Complete Buy/Sell Scenario", () => {
    it("should calculate average cost correctly after multiple buys", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      // BUY 1: 100 shares at 500 PKR each = 50,000 PKR total
      const buy1: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: "2024-01-01",
        quantity: "100",
        totalAmount: "50000", // 50,000 PKR
        unitPrice: "500",
        notes: "Buy 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy1);
      expect(state.totalShares.toString()).toBe("100");
      expect(state.totalInvested.toString()).toBe("50000");
      expect(state.avgCost.toString()).toBe("500"); // 50,000 / 100 = 500

      // BUY 2: 50 shares at 600 PKR each = 30,000 PKR total
      const buy2: Transaction = {
        id: 2,
        stockId: 1,
        type: "BUY",
        date: "2024-01-05",
        quantity: "50",
        totalAmount: "30000", // 30,000 PKR
        unitPrice: "600",
        notes: "Buy 2",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy2);
      expect(state.totalShares.toString()).toBe("150");
      expect(state.totalInvested.toString()).toBe("80000");
      // avg_cost = 80,000 / 150 = 533.33 PKR
      expect(new Decimal(state.avgCost).toDecimalPlaces(2).toString()).toBe("533.33");
    });

    it("should calculate realized profit correctly on sell", () => {
      let state = {
        totalShares: new Decimal(150),
        totalInvested: new Decimal(80000),
        avgCost: new Decimal(80000).dividedBy(150), // Calculate exact avgCost
        realizedProfit: new Decimal(0),
      };

      // SELL: 75 shares at 700 PKR each = 52,500 PKR total
      const sell: Transaction = {
        id: 3,
        stockId: 1,
        type: "SELL",
        date: "2024-01-10",
        quantity: "75",
        totalAmount: "52500", // 52,500 PKR
        unitPrice: "700",
        notes: "Sell 75 shares",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 52,500 PKR
      // cost_removed = avgCost * 75
      // realized_profit = 52,500 - cost_removed
      const costRemoved = new Decimal(80000).dividedBy(150).times(75);
      const expectedProfit = new Decimal(52500).minus(costRemoved);

      expect(state.totalShares.toString()).toBe("75");
      expect(state.realizedProfit.toDecimalPlaces(2).toString()).toBe(expectedProfit.toDecimalPlaces(2).toString());
      // avgCost should remain the same after sell
      expect(state.avgCost.toDecimalPlaces(2).toString()).toBe(new Decimal(80000).dividedBy(150).toDecimalPlaces(2).toString());
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
        date: "2024-01-01",
        quantity: "10",
        totalAmount: "1000", // 1000 PKR
        unitPrice: "100",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy);

      expect(state.totalShares.toString()).toBe("10");
      expect(state.totalInvested.toString()).toBe("1000");
      expect(state.avgCost.toString()).toBe("100");
      expect(state.realizedProfit.toString()).toBe("0");
    });

    it("should handle a sell transaction with profit", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(1000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 2,
        stockId: 1,
        type: "SELL",
        date: "2024-01-01",
        quantity: "5",
        totalAmount: "750", // 750 PKR (150 PKR per share)
        unitPrice: "150",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 750 PKR
      // cost_removed = 100 * 5 = 500 PKR
      // realized_profit = 750 - 500 = 250 PKR
      expect(state.totalShares.toString()).toBe("5");
      expect(state.totalInvested.toString()).toBe("500");
      expect(state.avgCost.toString()).toBe("100");
      expect(state.realizedProfit.toString()).toBe("250");
    });

    it("should handle a sell transaction with loss", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(1000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 2,
        stockId: 1,
        type: "SELL",
        date: "2024-01-01",
        quantity: "5",
        totalAmount: "400", // 400 PKR (80 PKR per share)
        unitPrice: "80",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      // proceeds = 400 PKR
      // cost_removed = 100 * 5 = 500 PKR
      // realized_profit = 400 - 500 = -100 PKR (loss)
      expect(state.totalShares.toString()).toBe("5");
      expect(state.totalInvested.toString()).toBe("500");
      expect(state.realizedProfit.toString()).toBe("-100");
    });
  });

  /**
   * Test Case: Dividend Transactions
   */
  describe("Dividend Transactions", () => {
    it("should add dividend to realized profit without changing shares", () => {
      let state = {
        totalShares: new Decimal(100),
        totalInvested: new Decimal(10000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      const dividend: Transaction = {
        id: 1,
        stockId: 1,
        type: "DIVIDEND",
        date: "2024-01-01",
        quantity: null,
        totalAmount: "500", // 500 PKR dividend
        unitPrice: null,
        notes: "Dividend payout",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, dividend);

      expect(state.totalShares.toString()).toBe("100");
      expect(state.totalInvested.toString()).toBe("10000");
      expect(state.avgCost.toString()).toBe("100");
      expect(state.realizedProfit.toString()).toBe("500");
    });

    it("should accumulate multiple dividends", () => {
      let state = {
        totalShares: new Decimal(100),
        totalInvested: new Decimal(10000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      const dividend1: Transaction = {
        id: 1,
        stockId: 1,
        type: "DIVIDEND",
        date: "2024-01-01",
        quantity: null,
        totalAmount: "500",
        unitPrice: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dividend2: Transaction = {
        id: 2,
        stockId: 1,
        type: "DIVIDEND",
        date: "2024-06-01",
        quantity: null,
        totalAmount: "500",
        unitPrice: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, dividend1);
      state = processTransaction(state, dividend2);

      expect(state.realizedProfit.toString()).toBe("1000");
    });
  });

  /**
   * Test Case: Selling All Shares
   */
  describe("Selling All Shares", () => {
    it("should set avg_cost to 0 when all shares are sold", () => {
      let state = {
        totalShares: new Decimal(10),
        totalInvested: new Decimal(1000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      const sell: Transaction = {
        id: 1,
        stockId: 1,
        type: "SELL",
        date: "2024-01-01",
        quantity: "10",
        totalAmount: "1500", // 1500 PKR
        unitPrice: "150",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);

      expect(state.totalShares.toString()).toBe("0");
      expect(state.totalInvested.toString()).toBe("0");
      expect(state.avgCost.toString()).toBe("0");
      expect(state.realizedProfit.toString()).toBe("500");
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
        date: "2024-01-01",
        quantity: "100",
        totalAmount: "10000",
        unitPrice: "100",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, buy1);
      expect(state.avgCost.toString()).toBe("100");

      // BUY 50 @ 120
      const buy2: Transaction = {
        id: 2,
        stockId: 1,
        type: "BUY",
        date: "2024-01-01",
        quantity: "50",
        totalAmount: "6000",
        unitPrice: "120",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, buy2);
      // avg_cost = 16,000 / 150 = 106.67
      expect(new Decimal(state.avgCost).toDecimalPlaces(2).toString()).toBe("106.67");

      // SELL 75 @ 150
      const sell: Transaction = {
        id: 3,
        stockId: 1,
        type: "SELL",
        date: "2024-01-01",
        quantity: "75",
        totalAmount: "11250",
        unitPrice: "150",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state = processTransaction(state, sell);
      // proceeds = 11,250
      // cost_removed = 106.67 * 75 = 8,000
      // realized_profit = 11,250 - 8,000 = 3,250
      expect(state.totalShares.toString()).toBe("75");
      expect(new Decimal(state.realizedProfit).toDecimalPlaces(0).toString()).toMatch(/325[0-9]/);
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
        date: "2024-01-01",
        quantity: "10.5",
        totalAmount: "10500", // 10,500 PKR
        unitPrice: "1000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy);

      expect(state.totalShares.toString()).toBe("10.5");
      expect(state.avgCost.toString()).toBe("1000");
    });
  });

  /**
   * Test Case: TOMCL Scenario - User reported issue
   * Buy 500 shares, then sell 250 shares
   */
  describe("TOMCL Scenario - Buy 500 Sell 250", () => {
    it("should correctly handle buying 500 and selling 250 shares", () => {
      let state = {
        totalShares: new Decimal(0),
        totalInvested: new Decimal(0),
        avgCost: new Decimal(0),
        realizedProfit: new Decimal(0),
      };

      // BUY 500 shares at 100 PKR each
      const buy: Transaction = {
        id: 1,
        stockId: 1,
        type: "BUY",
        date: "2025-01-01",
        quantity: "500",
        totalAmount: "50000",
        unitPrice: "100",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, buy);
      expect(state.totalShares.toString()).toBe("500");
      expect(state.totalInvested.toString()).toBe("50000");
      expect(state.avgCost.toString()).toBe("100");
      expect(state.realizedProfit.toString()).toBe("0");

      // SELL 250 shares at 120 PKR each
      const sell: Transaction = {
        id: 2,
        stockId: 1,
        type: "SELL",
        date: "2025-01-05",
        quantity: "250",
        totalAmount: "30000",
        unitPrice: "120",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);
      
      // After selling 250 out of 500 shares
      expect(state.totalShares.toString()).toBe("250");
      expect(state.totalInvested.toString()).toBe("25000"); // 250 * 100
      expect(state.avgCost.toString()).toBe("100"); // Same avg cost
      expect(state.realizedProfit.toString()).toBe("5000"); // (120 - 100) * 250
    });

    it("should handle selling all shares correctly", () => {
      let state = {
        totalShares: new Decimal(500),
        totalInvested: new Decimal(50000),
        avgCost: new Decimal(100),
        realizedProfit: new Decimal(0),
      };

      // SELL all 500 shares at 120 PKR each
      const sell: Transaction = {
        id: 1,
        stockId: 1,
        type: "SELL",
        date: "2025-01-05",
        quantity: "500",
        totalAmount: "60000",
        unitPrice: "120",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state = processTransaction(state, sell);
      
      // After selling all shares
      expect(state.totalShares.toString()).toBe("0");
      expect(state.totalInvested.toString()).toBe("0");
      expect(state.avgCost.toString()).toBe("0");
      expect(state.realizedProfit.toString()).toBe("10000"); // (120 - 100) * 500
    });
  });
});
