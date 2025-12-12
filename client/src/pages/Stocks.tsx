import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, TrendingUp, TrendingDown, Search } from "lucide-react";
import { useState } from "react";

export default function Stocks() {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stocks, isLoading, refetch } = trpc.stock.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createStockMutation = trpc.stock.create.useMutation({
    onSuccess: () => {
      toast.success("Stock added successfully");
      setSymbol("");
      setName("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add stock");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!symbol || !name) {
      toast.error("Please fill in both symbol and name");
      return;
    }

    await createStockMutation.mutateAsync({
      symbol: symbol.toUpperCase().trim(),
      name: name.trim(),
    });
  };

  const filteredStocks = stocks?.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Stock Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Add and manage stocks in your portfolio database
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Stock Form */}
        <Card className="lg:col-span-1 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add New Stock
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Register a stock symbol to track
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="symbol" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stock Symbol *
                </Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., AAPL"
                  className="mt-1.5 font-mono"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter stock ticker symbol (e.g., AAPL, MSFT, TSLA)
                </p>
              </div>

              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company Name *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Apple Inc."
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Full company or stock name
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={createStockMutation.isPending}
              >
                {createStockMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Stock
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stocks List */}
        <Card className="lg:col-span-2 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Registered Stocks
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  {stocks?.length || 0} stock{stocks?.length !== 1 ? "s" : ""} in database
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredStocks && filteredStocks.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Symbol</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Company Name</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                        Current Price
                      </TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                        Holdings
                      </TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                        Gain/Loss
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow
                        key={stock.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800"
                      >
                        <TableCell className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {stock.symbol}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{stock.name}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900 dark:text-gray-100">
                          {stock.currentPrice > 0
                            ? `PKR ${stock.currentPrice.toFixed(2)}`
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {parseFloat(stock.totalShares) > 0
                            ? `${parseFloat(stock.totalShares).toFixed(2)} shares`
                            : "No holdings"}
                        </TableCell>
                        <TableCell className="text-right">
                          {parseFloat(stock.totalShares) > 0 ? (
                            <span
                              className={`font-semibold ${
                                stock.gainLossPercent >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {stock.gainLossPercent >= 0 ? (
                                <TrendingUp className="w-4 h-4 inline mr-1" />
                              ) : (
                                <TrendingDown className="w-4 h-4 inline mr-1" />
                              )}
                              {stock.gainLossPercent >= 0 ? "+" : ""}
                              {stock.gainLossPercent.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  {searchQuery ? "No stocks found matching your search" : "No stocks registered yet"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Add your first stock using the form on the left
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

