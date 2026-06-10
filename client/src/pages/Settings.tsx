import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const WINDOW_OPTIONS = [
  { value: 1, label: "1 day (same day only)" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days (1 week)" },
  { value: 7, label: "7 days" },
];

export default function Settings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, {
    enabled: !!user,
  });

  const setWindowMutation = trpc.settings.setTradingWindow.useMutation({
    onSuccess: (data) => {
      utils.settings.get.setData(undefined, data);
      toast.success("Setting saved", {
        description: `Trading window set to ${data.tradingWindowDays} day${data.tradingWindowDays > 1 ? "s" : ""}.`,
      });
    },
    onError: (err) => {
      toast.error("Failed to save setting", { description: err.message });
    },
  });

  const handleWindowChange = (value: string) => {
    setWindowMutation.mutate({ days: parseInt(value, 10) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure how your portfolio is calculated.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading Window</CardTitle>
          <CardDescription>
            When you sell shares within this many days of buying them, the profit is calculated using
            the original buy price (FIFO) rather than the running average cost. Use a larger window if
            you typically hold trades for a couple of days before selling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trading-window">Window size</Label>
            <Select
              value={String(settings?.tradingWindowDays ?? 1)}
              onValueChange={handleWindowChange}
              disabled={setWindowMutation.isPending}
            >
              <SelectTrigger id="trading-window" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300">
            <strong>Example:</strong> With a 2-day window, buying FCEPL at 105 on Monday and selling
            at 107 on Tuesday uses 105 as the cost basis — profit is 2/share — even if the running
            average is higher.
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Changing this setting triggers a full recompute of your portfolio the next time transactions
            are saved. To apply it immediately, use the "Recompute" button on any stock.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
