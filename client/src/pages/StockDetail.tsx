import { useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function StockDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const stockId = parseInt(id || "0");

  const { data: detail, isLoading, refetch } = trpc.stock.getDetail.useQuery(
    { id: stockId },
    { enabled: !!user && stockId > 0 }
  );

  const deleteTransactionMutation = trpc.transaction.delete.useMutation();

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      await deleteTransactionMutation.mutateAsync({ id: transactionId });
      toast.success("Transaction deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete transaction");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Stock not found</p>
      </div>
    );
  }

  const { stock, aggregate, currentPrice, unrealizedProfit, gainLossPercent, transactions } = detail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{stock.symbol}</h1>
        <p className="text-muted-foreground">{stock.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{aggregate ? parseFloat(aggregate.totalShares).toFixed(2) : "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{aggregate ? formatCurrency(parseFloat(aggregate.avgCost)) : "N/A"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gain/Loss %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${gainLossPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(gainLossPercent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Profit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{aggregate ? formatCurrency(parseFloat(aggregate.totalInvested)) : "0"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unrealized Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${unrealizedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(unrealizedProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Realized Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${aggregate && parseFloat(aggregate.realizedProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {aggregate ? formatCurrency(parseFloat(aggregate.realizedProfit)) : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>All transactions for this stock</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{formatDate(new Date(txn.date))}</TableCell>
                      <TableCell>
                        <Badge variant={txn.type === "BUY" ? "default" : txn.type === "SELL" ? "destructive" : "secondary"}>
                          {txn.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.quantity ? parseFloat(txn.quantity).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.unitPrice ? formatCurrency(parseFloat(txn.unitPrice)) : "-"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(parseFloat(txn.totalAmount))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{txn.notes || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(txn.id)}
                          disabled={deleteTransactionMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions for this stock yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
