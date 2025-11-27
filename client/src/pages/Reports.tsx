import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

export default function Reports() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState(formatDate(new Date(new Date().setFullYear(new Date().getFullYear() - 1))));
  const [toDate, setToDate] = useState(formatDate(new Date()));

  const { data: daywiseData, isLoading } = trpc.reports.daywise.useQuery(
    {
      from: new Date(fromDate),
      to: new Date(toDate),
    },
    { enabled: !!user }
  );

  const totalProfit = daywiseData && Array.isArray(daywiseData) ? daywiseData.reduce((sum: number, d: any) => sum + (d?.profit || 0), 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Analyze your portfolio performance</p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from">From Date</Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="to">To Date</Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Period</p>
              <p className="text-lg font-semibold">{fromDate} to {toDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Profit</p>
              <p className={`text-lg font-semibold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                PKR {(totalProfit / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-lg font-semibold">{daywiseData?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daywise Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Profit Breakdown</CardTitle>
          <CardDescription>Profit by day during the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : daywiseData && daywiseData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Date</th>
                    <th className="text-right py-2 px-4">Profit (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {daywiseData && daywiseData.length > 0 ? daywiseData.map((item: any, index) => (
                    <tr key={index} className="border-b hover:bg-muted">
                      <td className="py-2 px-4">{item?.date || "N/A"}</td>
                      <td className={`text-right py-2 px-4 ${(item?.profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {((item?.profit || 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No data available for the selected period.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note about Charts */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Charts Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <p>
            Interactive charts (line chart for daywise profit and bar charts for stock performance) will be added in the next update using Nivo charts library.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
