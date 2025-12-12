import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, DollarSign, PieChart, Search, Filter, ArrowUpDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useState, useMemo } from "react";

type SortField = "symbol" | "name" | "totalShares" | "totalInvested" | "currentPrice" | "unrealizedProfit" | "realizedProfit" | "gainLossPercent";
type SortOrder = "asc" | "desc";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { data: stocks, isLoading, error } = trpc.stock.list.useQuery(undefined, {
    enabled: !!user,
  });
  console.log(stocks);

  // Filter and sort state - MUST be before any conditional returns
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("symbol");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterHoldings, setFilterHoldings] = useState<"all" | "withHoldings" | "noHoldings">("all");

  // Filter and sort stocks - MUST be before any conditional returns
  const filteredAndSortedStocks = useMemo(() => {
    if (!stocks) return [];

    let filtered = stocks;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(query) ||
          stock.name.toLowerCase().includes(query)
      );
    }

    // Apply holdings filter
    if (filterHoldings === "withHoldings") {
      filtered = filtered.filter((stock) => parseFloat(stock.totalShares) > 0);
    } else if (filterHoldings === "noHoldings") {
      filtered = filtered.filter((stock) => parseFloat(stock.totalShares) === 0);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "totalShares":
          aValue = parseFloat(a.totalShares);
          bValue = parseFloat(b.totalShares);
          break;
        case "totalInvested":
          aValue = a.totalInvested;
          bValue = b.totalInvested;
          break;
        case "currentPrice":
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case "unrealizedProfit":
          aValue = a.unrealizedProfit;
          bValue = b.unrealizedProfit;
          break;
        case "realizedProfit":
          aValue = a.realizedProfit;
          bValue = b.realizedProfit;
          break;
        case "gainLossPercent":
          aValue = a.gainLossPercent;
          bValue = b.gainLossPercent;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return filtered;
  }, [stocks, searchQuery, sortField, sortOrder, filterHoldings]);

  // Calculate totals - MUST be before any conditional returns
  const totalInvested = stocks?.reduce((sum, s) => sum + (s.totalInvested || 0), 0) || 0;
  const totalUnrealized = stocks?.reduce((sum, s) => sum + (s.unrealizedProfit || 0), 0) || 0;
  const totalRealized = stocks?.reduce((sum, s) => sum + (s.realizedProfit || 0), 0) || 0;
  // Calculate total market value from current prices
  const totalMarketValue = stocks?.reduce((sum, s) => {
    if (s.currentPrice > 0 && parseFloat(s.totalShares) > 0) {
      return sum + (s.currentPrice * parseFloat(s.totalShares));
    }
    return sum;
  }, 0) || 0;
  const totalValue = totalMarketValue; // Already in PKR
  const overallGainLoss = totalRealized + totalUnrealized;
  console.log(totalInvested, totalRealized, totalUnrealized, overallGainLoss);
  const overallGainLossPercent = totalInvested > 0 ? (overallGainLoss / totalInvested) * 100 : 0;

  // Now we can do conditional returns
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Stock Portfolio Tracker</CardTitle>
            <CardDescription>Track your stock investments with moving-average accounting</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please log in to access your portfolio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time portfolio performance and holdings analysis
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/stocks">
            <Button variant="outline" className="border-gray-300 dark:border-gray-700">
              Manage Stocks
            </Button>
          </Link>
          <Link href="/entry">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Invested
              </CardTitle>
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalInvested)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Capital deployed</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Value
              </CardTitle>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalValue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Market value</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Realized Profit
              </CardTitle>
              {totalRealized >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${totalRealized >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
                }`}
            >
              {formatCurrency(totalRealized)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">From closed positions</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Gain/Loss
              </CardTitle>
              {overallGainLoss >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${overallGainLoss >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
                }`}
            >
              {formatCurrency(overallGainLoss)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {overallGainLossPercent >= 0 ? "+" : ""}
              {overallGainLossPercent.toFixed(2)}% overall
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Portfolio Holdings
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Detailed breakdown of your stock positions
                </CardDescription>
              </div>
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by symbol or company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Holdings Filter */}
              <Select value={filterHoldings} onValueChange={(value: "all" | "withHoldings" | "noHoldings") => setFilterHoldings(value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="w-4 h-4 mr-2 inline" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stocks</SelectItem>
                  <SelectItem value="withHoldings">With Holdings</SelectItem>
                  <SelectItem value="noHoldings">No Holdings</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Field */}
              <Select
                value={sortField}
                onValueChange={(value: SortField) => setSortField(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <ArrowUpDown className="w-4 h-4 mr-2 inline" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="symbol">Symbol</SelectItem>
                  <SelectItem value="name">Company Name</SelectItem>
                  <SelectItem value="totalShares">Shares</SelectItem>
                  <SelectItem value="totalInvested">Invested</SelectItem>
                  <SelectItem value="currentPrice">Current Price</SelectItem>
                  <SelectItem value="unrealizedProfit">Unrealized P/L</SelectItem>
                  <SelectItem value="realizedProfit">Realized P/L</SelectItem>
                  <SelectItem value="gainLossPercent">Return %</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="w-full sm:w-auto"
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Ascending
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4 mr-2" />
                    Descending
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              Failed to load portfolio data
            </div>
          ) : filteredAndSortedStocks && filteredAndSortedStocks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Symbol</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Company</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Shares
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Avg Cost
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Invested
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Current Price
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Market Value
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Unrealized P/L
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Realized P/L
                    </TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">
                      Return %
                    </TableHead>
                    <TableHead className="text-center font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedStocks.map((stock) => {
                    const marketValue = stock.currentPrice > 0 && parseFloat(stock.totalShares) > 0
                      ? stock.currentPrice * parseFloat(stock.totalShares)
                      : 0;
                    return (
                      <TableRow
                        key={stock.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800"
                      >
                        <TableCell className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {stock.symbol}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{stock.name}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900 dark:text-gray-100">
                          {parseFloat(stock.totalShares).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {formatCurrency(parseFloat(stock.avgCost))}
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(stock.totalInvested)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {stock.currentPrice > 0
                            ? formatCurrency(stock.currentPrice)
                            : <span className="text-gray-400">N/A</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-900 dark:text-gray-100">
                          {marketValue > 0 ? formatCurrency(marketValue) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${stock.unrealizedProfit >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                              }`}
                          >
                            {stock.unrealizedProfit >= 0 ? "+" : ""}
                            {formatCurrency(stock.unrealizedProfit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${stock.realizedProfit >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                              }`}
                          >
                            {stock.realizedProfit >= 0 ? "+" : ""}
                            {formatCurrency(stock.realizedProfit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={stock.gainLossPercent >= 0 ? "default" : "destructive"}
                            className="font-semibold"
                          >
                            {stock.gainLossPercent >= 0 ? (
                              <TrendingUp className="w-3 h-3 inline mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 inline mr-1" />
                            )}
                            {formatPercent(stock.gainLossPercent)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={`/stock/${stock.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : stocks && stocks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-2">No stocks in your portfolio yet.</p>
              <div className="flex gap-3 justify-center mt-4">
                <Link href="/stocks">
                  <Button variant="outline" className="border-gray-300 dark:border-gray-700">
                    Add Stocks
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-2">No stocks match your filters.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setFilterHoldings("all");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
