import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency, parseToPane, formatDate } from "@/lib/utils";
import { useLocation, Link } from "wouter";
import Decimal from "decimal.js";
import { useState } from "react";

export default function Entry() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [stockSymbol, setStockSymbol] = useState("");
  const [stockName, setStockName] = useState("");
  const [transactionType, setTransactionType] = useState<"BUY" | "SELL" | "DIVIDEND">("BUY");
  const [date, setDate] = useState(formatDate(new Date()));
  const [quantity, setQuantity] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [confirmOverride, setConfirmOverride] = useState(false);

  const { data: stocks } = trpc.stock.list.useQuery(undefined, { enabled: !!user });
  const addTransactionMutation = trpc.transaction.add.useMutation();

  const unitPrice = quantity && totalAmount ? new Decimal(totalAmount).dividedBy(new Decimal(quantity)) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stockSymbol || !transactionType || !date) {
      toast.error("Please fill in all required fields");
      return;
    }

    if ((transactionType === "BUY" || transactionType === "SELL") && (!quantity || !totalAmount)) {
      toast.error("Quantity and total amount are required for BUY/SELL");
      return;
    }

    if (transactionType === "DIVIDEND" && !totalAmount) {
      toast.error("Total amount is required for DIVIDEND");
      return;
    }

    // Check for warnings
    const existingStock = stocks?.find((s) => s.symbol.toUpperCase() === stockSymbol.toUpperCase());

    if (transactionType === "SELL" && existingStock && quantity) {
      const totalShares = new Decimal(existingStock.totalShares || "0");
      const qty = new Decimal(quantity);
      // avgCost is stored in paise, convert to PKR for comparison
      const avgCostPaise = new Decimal(existingStock.avgCost || "0");
      const avgCostPKR = avgCostPaise.dividedBy(100);

      // totalAmount is in PKR (user input), convert to paise
      const totalAmountPaise = parseToPane(parseFloat(totalAmount));
      const sellPricePaise = new Decimal(totalAmountPaise).dividedBy(qty);
      const sellPricePKR = sellPricePaise.dividedBy(100);

      if (qty.greaterThan(totalShares) && !confirmOverride) {
        setWarningMessage(
          `You are trying to sell ${qty.toString()} shares but only have ${totalShares.toString()} shares. Confirm to proceed.`
        );
        setShowWarning(true);
        return;
      }

      if (sellPricePKR.lessThan(avgCostPKR) && !confirmOverride) {
        setWarningMessage(
          `You are selling at ${sellPricePKR.toFixed(2)} PKR/share below your average cost of ${avgCostPKR.toFixed(2)} PKR/share. Confirm to proceed.`
        );
        setShowWarning(true);
        return;
      }
    }

    // Only allow transactions for existing stocks
    if (!existingStock) {
      toast.error("Stock not found. Please add the stock first from the Stocks page.");
      return;
    }

    try {
      // Add transaction
      await addTransactionMutation.mutateAsync({
        stockId: existingStock.id,
        type: transactionType,
        date: new Date(date),
        quantity: transactionType === "DIVIDEND" ? null : (quantity || null),
        totalAmount: parseToPane(parseFloat(totalAmount)),
        notes: notes || undefined,
        confirmOverride,
      });

      toast.success("Transaction added successfully");
      setStockSymbol("");
      setStockName("");
      setTransactionType("BUY");
      setDate(formatDate(new Date()));
      setQuantity("");
      setTotalAmount("");
      setNotes("");
      setConfirmOverride(false);
      setLocation("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to add transaction");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Add Transaction</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Record buy, sell, or dividend transactions for your portfolio
        </p>
      </div>
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Transaction Details
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Select a stock from your database and enter transaction information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Stock Selection */}
            <div>
              <Label htmlFor="symbol">Stock *</Label>
              <Select
                value={stockSymbol}
                onValueChange={(value) => {
                  setStockSymbol(value);
                  const stock = stocks?.find((s) => s.symbol === value);
                  if (stock) setStockName(stock.name);
                }}
              >
                <SelectTrigger id="symbol" className="w-full">
                  <SelectValue placeholder="Select a stock from database" />
                </SelectTrigger>
                <SelectContent>
                  {stocks && stocks.length > 0 ? (
                    stocks.map((stock) => (
                      <SelectItem key={stock.id} value={stock.symbol}>
                        {stock.symbol} - {stock.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-6 text-center text-sm text-gray-500">
                      No stocks available. Add stocks first.
                    </div>
                  )}
                </SelectContent>
              </Select>
              {stocks && stocks.length === 0 && (
                <p className="text-sm text-amber-600 mt-1.5">
                  No stocks in database. <Link href="/stocks" className="underline font-medium">Add stocks first</Link>
                </p>
              )}
            </div>

            {/* Transaction Type */}
            <div>
              <Label htmlFor="type">Transaction Type *</Label>
              <Select value={transactionType} onValueChange={(value: any) => setTransactionType(value)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                  <SelectItem value="DIVIDEND">Dividend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Quantity & Amount */}
            {transactionType !== "DIVIDEND" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity (shares) *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g., 100"
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Total Amount (PKR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="e.g., 50000"
                  />
                </div>
              </div>
            )}

            {transactionType === "DIVIDEND" && (
              <div>
                <Label htmlFor="dividend">Dividend Amount (PKR) *</Label>
                <Input
                  id="dividend"
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="e.g., 500"
                />
              </div>
            )}

            {/* Unit Price Display */}
            {unitPrice && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  Unit Price: <strong>{unitPrice.toString()} PKR/share</strong>
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this transaction"
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full">
              Add Transaction
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
          <AlertDialogDescription>{warningMessage}</AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel onClick={() => {
              setShowWarning(false);
              setConfirmOverride(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmOverride(true);
              setShowWarning(false);
              handleSubmit({ preventDefault: () => { } } as any);
            }}>
              Confirm
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
