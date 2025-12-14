import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type GroupBy = "none" | "date" | "stock" | "type" | "date_stock";

export default function TransactionAudit() {
  const { user } = useAuth();
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStock, setSelectedStock] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: stocks } = trpc.stock.list.useQuery(undefined, { enabled: !!user });
  const { data: transactions, isLoading } = trpc.transaction.audit.useQuery(
    {
      groupBy,
      searchTerm: searchTerm || undefined,
      stockId: selectedStock !== "all" ? parseInt(selectedStock) : undefined,
      type: selectedType !== "all" ? (selectedType as "BUY" | "SELL" | "DIVIDEND") : undefined,
    },
    { enabled: !!user }
  );

  const exportToCSV = () => {
    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = ["ID", "Date", "Stock", "Type", "Quantity", "Unit Price", "Total Amount", "Notes"];
    const rows = transactions.flatMap((group: any) => {
      if (group.transactions) {
        return group.transactions.map((txn: any) => [
          txn.id,
          formatDate(new Date(txn.date)),
          txn.stockSymbol,
          txn.type,
          txn.quantity || "",
          txn.unitPrice ? formatCurrency(parseFloat(txn.unitPrice)).replace("PKR", "").trim() : "",
          formatCurrency(parseFloat(txn.totalAmount)).replace("PKR", "").trim(),
          txn.notes || "",
        ]);
      }
      return [];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_audit_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Transactions exported to CSV");
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please log in to view transactions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Transaction Audit</h1>
        <p className="text-muted-foreground">Review all transactions to identify any errors or discrepancies</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Grouping</CardTitle>
          <CardDescription>Filter and group transactions for easier review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="group-by">Group By</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger id="group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="type">Transaction Type</SelectItem>
                  <SelectItem value="date_stock">Date & Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stock-filter">Stock</Label>
              <Select value={selectedStock} onValueChange={setSelectedStock}>
                <SelectTrigger id="stock-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stocks</SelectItem>
                  {stocks?.map((stock) => (
                    <SelectItem key={stock.id} value={stock.id.toString()}>
                      {stock.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type-filter">Transaction Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                  <SelectItem value="DIVIDEND">DIVIDEND</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search notes, stock..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {transactions && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">
                  {transactions.reduce((sum: number, group: any) => sum + (group.transactions?.length || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total BUY</p>
                <p className="text-2xl font-bold text-green-600">
                  {transactions.reduce(
                    (sum: number, group: any) =>
                      sum + (group.transactions?.filter((t: any) => t.type === "BUY").length || 0),
                    0
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total SELL</p>
                <p className="text-2xl font-bold text-red-600">
                  {transactions.reduce(
                    (sum: number, group: any) =>
                      sum + (group.transactions?.filter((t: any) => t.type === "SELL").length || 0),
                    0
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total DIVIDEND</p>
                <p className="text-2xl font-bold text-blue-600">
                  {transactions.reduce(
                    (sum: number, group: any) =>
                      sum + (group.transactions?.filter((t: any) => t.type === "DIVIDEND").length || 0),
                    0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            {groupBy === "none" && "All transactions in chronological order"}
            {groupBy === "date" && "Transactions grouped by date"}
            {groupBy === "stock" && "Transactions grouped by stock"}
            {groupBy === "type" && "Transactions grouped by type"}
            {groupBy === "date_stock" && "Transactions grouped by date and stock"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin w-8 h-8" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-6">
              {transactions.map((group: any, groupIndex: number) => (
                <div key={groupIndex} className="space-y-2">
                  {/* Group Header */}
                  {groupBy !== "none" && (
                    <div className="bg-muted p-3 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {group.date && (
                            <span className="font-semibold">Date: {formatDate(new Date(group.date))}</span>
                          )}
                          {group.stockSymbol && (
                            <span className="font-semibold">Stock: {group.stockSymbol}</span>
                          )}
                          {group.type && (
                            <Badge variant={group.type === "BUY" ? "default" : group.type === "SELL" ? "destructive" : "secondary"}>
                              {group.type}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {group.transactions?.length || 0} transaction(s)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Transactions in this group */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Date</TableHead>
                          {groupBy !== "stock" && <TableHead>Stock</TableHead>}
                          {groupBy !== "type" && <TableHead>Type</TableHead>}
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(group.transactions || [group]).map((txn: any) => (
                          <TableRow key={txn.id}>
                            <TableCell className="font-mono text-xs">{txn.id}</TableCell>
                            <TableCell>{formatDate(new Date(txn.date))}</TableCell>
                            {groupBy !== "stock" && (
                              <TableCell>
                                <span className="font-medium">{txn.stockSymbol || group.stockSymbol}</span>
                              </TableCell>
                            )}
                            {groupBy !== "type" && (
                              <TableCell>
                                <Badge
                                  variant={
                                    (txn.type || group.type) === "BUY"
                                      ? "default"
                                      : (txn.type || group.type) === "SELL"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {txn.type || group.type}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              {txn.quantity ? parseFloat(txn.quantity).toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {txn.unitPrice ? formatCurrency(parseFloat(txn.unitPrice)) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(parseFloat(txn.totalAmount))}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {txn.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions found matching the selected filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

