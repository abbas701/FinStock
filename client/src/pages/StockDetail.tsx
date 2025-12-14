import { useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Edit } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export default function StockDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const stockId = parseInt(id || "0");

  const { data: detail, isLoading, refetch } = trpc.stock.getDetail.useQuery(
    { id: stockId },
    { enabled: !!user && stockId > 0 }
  );

  const deleteTransactionMutation = trpc.transaction.delete.useMutation();
  const updateTransactionMutation = trpc.transaction.update.useMutation();
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

  const handleEditTransaction = (txn: any) => {
    setEditingTransaction(txn);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const type = formData.get("type") as "BUY" | "SELL" | "DIVIDEND";
    const date = formData.get("date") as string;
    const quantity = formData.get("quantity") as string;
    const totalAmount = formData.get("totalAmount") as string;
    const notes = formData.get("notes") as string;

    if (!type || !date || !totalAmount) {
      toast.error("Please fill in all required fields");
      return;
    }

    if ((type === "BUY" || type === "SELL") && !quantity) {
      toast.error("Quantity is required for BUY/SELL transactions");
      return;
    }

    try {
      await updateTransactionMutation.mutateAsync({
        id: editingTransaction.id,
        type,
        date: new Date(date),
        quantity: type === "DIVIDEND" ? null : (quantity || null),
        totalAmount,
        notes: notes || undefined,
      });
      toast.success("Transaction updated");
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update transaction");
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
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTransaction(txn)}
                            disabled={updateTransactionMutation.isPending}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(txn.id)}
                            disabled={deleteTransactionMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Update transaction details</DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <form onSubmit={handleUpdateTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-type">Transaction Type *</Label>
                  <Select name="type" defaultValue={editingTransaction.type} required>
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                      <SelectItem value="DIVIDEND">DIVIDEND</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    name="date"
                    type="date"
                    defaultValue={formatDate(new Date(editingTransaction.date))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-quantity">Quantity (shares)</Label>
                  <Input
                    id="edit-quantity"
                    name="quantity"
                    type="number"
                    step="0.01"
                    defaultValue={editingTransaction.quantity || ""}
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-totalAmount">Total Amount (PKR) *</Label>
                  <Input
                    id="edit-totalAmount"
                    name="totalAmount"
                    type="number"
                    step="0.01"
                    defaultValue={editingTransaction.totalAmount}
                    required
                    placeholder="Enter total amount"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={editingTransaction.notes || ""}
                  placeholder="Optional notes about this transaction"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingTransaction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTransactionMutation.isPending}>
                  {updateTransactionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Transaction"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
