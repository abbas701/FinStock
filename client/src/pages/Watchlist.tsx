import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { toast } from "sonner";

export default function Watchlist() {
  const { user } = useAuth();
  const { data: watchlistItems, isLoading, refetch } = trpc.watchlist.list.useQuery(undefined, {
    enabled: !!user,
  });

  const removeFromWatchlistMutation = trpc.watchlist.remove.useMutation();

  const handleRemove = async (watchlistId: number) => {
    try {
      await removeFromWatchlistMutation.mutateAsync({ watchlistId });
      toast.success("Removed from watchlist");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove from watchlist");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Watchlist</h1>
        <p className="text-muted-foreground">Monitor stocks you're interested in</p>
      </div>

      {/* Watchlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>Watched Stocks</CardTitle>
          <CardDescription>Current prices of stocks on your watchlist</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : watchlistItems && watchlistItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Change %</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlistItems.map((item) => (
                    <TableRow key={item.watchlistId}>
                      <TableCell className="font-medium">{item.stock?.symbol}</TableCell>
                      <TableCell>{item.stock?.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.currentPrice)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.priceChange >= 0 ? "default" : "destructive"}>
                          {formatPercent(item.priceChange)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(item.watchlistId)}
                          disabled={removeFromWatchlistMutation.isPending}
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
              <p>Your watchlist is empty.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
