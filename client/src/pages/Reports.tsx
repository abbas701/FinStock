import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

type ChartType = "daywise" | "performance" | "volume" | "distribution";

export default function Reports() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState(formatDate(new Date(new Date().setFullYear(new Date().getFullYear() - 1))));
  const [toDate, setToDate] = useState(formatDate(new Date()));
  const [selectedChart, setSelectedChart] = useState<ChartType>("daywise");
  const [selectedStockId, setSelectedStockId] = useState<number | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<"BUY" | "SELL" | "DIVIDEND" | undefined>(undefined);

  const { data: stocks } = trpc.stock.list.useQuery(undefined, { enabled: !!user });
  const { data: daywiseData, isLoading: daywiseLoading } = trpc.reports.daywise.useQuery(
    {
      from: new Date(fromDate),
      to: new Date(toDate),
      stockId: selectedStockId,
    },
    { enabled: !!user && selectedChart === "daywise" }
  );

  const { data: performanceData, isLoading: performanceLoading } = trpc.reports.stockPerformance.useQuery(
    {
      stockIds: selectedStockId ? [selectedStockId] : undefined,
    },
    { enabled: !!user && selectedChart === "performance" }
  );

  const { data: volumeData, isLoading: volumeLoading } = trpc.reports.transactionVolume.useQuery(
    {
      from: new Date(fromDate),
      to: new Date(toDate),
      type: selectedType,
      stockId: selectedStockId,
    },
    { enabled: !!user && selectedChart === "volume" }
  );

  const { data: distributionData, isLoading: distributionLoading } = trpc.reports.portfolioDistribution.useQuery(
    undefined,
    { enabled: !!user && selectedChart === "distribution" }
  );

  const isLoading = daywiseLoading || performanceLoading || volumeLoading || distributionLoading;

  // Prepare chart data
  const daywiseChartData = daywiseData
    ? [
      {
        id: "Profit",
        data: daywiseData.map((d) => ({
          x: d.date,
          y: d.profit,
        })),
      },
    ]
    : [];

  const performanceChartData = performanceData
    ? performanceData.map((stock) => ({
      symbol: stock.symbol,
      totalInvested: stock.totalInvested,
      realizedProfit: stock.realizedProfit,
      avgCost: stock.avgCost,
      totalShares: stock.totalShares,
    }))
    : [];

  const volumeChartData = volumeData
    ? volumeData.reduce((acc: any, txn) => {
      const date = txn.date;
      const existing = acc.find((d: any) => d.date === date);
      if (existing) {
        existing[txn.type] = (existing[txn.type] || 0) + txn.totalAmount;
      } else {
        acc.push({
          date,
          BUY: txn.type === "BUY" ? txn.totalAmount : 0,
          SELL: txn.type === "SELL" ? txn.totalAmount : 0,
          DIVIDEND: txn.type === "DIVIDEND" ? txn.totalAmount : 0,
        });
      }
      return acc;
    }, [])
    : [];

  const distributionChartData = distributionData
    ? distributionData.map((stock) => ({
      id: stock.symbol,
      label: stock.symbol,
      value: stock.totalInvested,
    }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Visualize and analyze your portfolio performance</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Chart Selection</CardTitle>
          <CardDescription>Select chart type and apply filters to analyze your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select value={selectedChart} onValueChange={(v) => setSelectedChart(v as ChartType)}>
                <SelectTrigger id="chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daywise">Daywise Profit</SelectItem>
                  <SelectItem value="performance">Stock Performance</SelectItem>
                  <SelectItem value="volume">Transaction Volume</SelectItem>
                  <SelectItem value="distribution">Portfolio Distribution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stock-filter">Stock (Optional)</Label>
              <Select
                value={selectedStockId?.toString() || "all"}
                onValueChange={(v) => setSelectedStockId(v === "all" ? undefined : parseInt(v))}
              >
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

            {(selectedChart === "daywise" || selectedChart === "volume") && (
              <>
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
              </>
            )}

            {selectedChart === "volume" && (
              <div>
                <Label htmlFor="type-filter">Transaction Type</Label>
                <Select
                  value={selectedType || "all"}
                  onValueChange={(v) => setSelectedType(v === "all" ? undefined : (v as any))}
                >
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedChart === "daywise" && "Daywise Profit Trend"}
            {selectedChart === "performance" && "Stock Performance Comparison"}
            {selectedChart === "volume" && "Transaction Volume Over Time"}
            {selectedChart === "distribution" && "Portfolio Distribution"}
          </CardTitle>
          <CardDescription>
            {selectedChart === "daywise" && "Daily realized profit/loss over the selected period"}
            {selectedChart === "performance" && "Compare investment and returns across stocks"}
            {selectedChart === "volume" && "Transaction volume by type over time"}
            {selectedChart === "distribution" && "Portfolio allocation by stock"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="animate-spin w-8 h-8" />
            </div>
          ) : (
            <div className="h-96">
              {selectedChart === "daywise" && daywiseChartData.length > 0 && (
                <ResponsiveLine
                  data={daywiseChartData}
                  margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
                  xScale={{ type: "point" }}
                  yScale={{
                    type: "linear",
                    min: "auto",
                    max: "auto",
                  }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    legend: "Date",
                    legendOffset: 45,
                    legendPosition: "middle",
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: "Profit (PKR)",
                    legendOffset: -40,
                    legendPosition: "middle",
                    format: (value) => formatCurrency(value),
                  }}
                  pointSize={8}
                  pointColor={{ theme: "background" }}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: "serieColor" }}
                  pointLabelYOffset={-12}
                  useMesh={true}
                  legends={[
                    {
                      anchor: "bottom-right",
                      direction: "column",
                      justify: false,
                      translateX: 100,
                      translateY: 0,
                      itemsSpacing: 0,
                      itemDirection: "left-to-right",
                      itemWidth: 80,
                      itemHeight: 20,
                      itemOpacity: 0.75,
                      symbolSize: 12,
                      symbolShape: "circle",
                      symbolBorderColor: "rgba(0, 0, 0, .5)",
                      effects: [
                        {
                          on: "hover",
                          style: {
                            itemBackground: "rgba(0, 0, 0, .03)",
                            itemOpacity: 1,
                          },
                        },
                      ],
                    },
                  ]}
                />
              )}

              {selectedChart === "performance" && performanceChartData.length > 0 && (
                <ResponsiveBar
                  data={performanceChartData}
                  keys={["realizedProfit"]}
                  indexBy="symbol"
                  margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
                  padding={0.3}
                  valueScale={{ type: "linear" }}
                  indexScale={{ type: "band", round: true }}
                  colors={{ scheme: "nivo" }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    legend: "Stock Symbol",
                    legendPosition: "middle",
                    legendOffset: 45,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: "Amount (PKR)",
                    legendPosition: "middle",
                    legendOffset: -40,
                    format: (value) => formatCurrency(value),
                  }}
                  labelSkipWidth={12}
                  labelSkipHeight={12}
                  labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
                  legends={[
                    {
                      dataFrom: "keys",
                      anchor: "bottom-right",
                      direction: "column",
                      justify: false,
                      translateX: 120,
                      translateY: 0,
                      itemsSpacing: 2,
                      itemWidth: 100,
                      itemHeight: 20,
                      itemDirection: "left-to-right",
                      itemOpacity: 0.85,
                      symbolSize: 20,
                      effects: [
                        {
                          on: "hover",
                          style: {
                            itemOpacity: 1,
                          },
                        },
                      ],
                    },
                  ]}
                  animate={true}
                  motionConfig="gentle"
                />
              )}

              {selectedChart === "volume" && volumeChartData.length > 0 && (
                <ResponsiveBar
                  data={volumeChartData}
                  keys={["BUY", "SELL", "DIVIDEND"]}
                  indexBy="date"
                  margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
                  padding={0.3}
                  valueScale={{ type: "linear" }}
                  indexScale={{ type: "band", round: true }}
                  colors={{ scheme: "set3" }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    legend: "Date",
                    legendPosition: "middle",
                    legendOffset: 45,
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: "Volume (PKR)",
                    legendPosition: "middle",
                    legendOffset: -40,
                    format: (value) => formatCurrency(value),
                  }}
                  labelSkipWidth={12}
                  labelSkipHeight={12}
                  legends={[
                    {
                      dataFrom: "keys",
                      anchor: "bottom-right",
                      direction: "column",
                      justify: false,
                      translateX: 120,
                      translateY: 0,
                      itemsSpacing: 2,
                      itemWidth: 100,
                      itemHeight: 20,
                      itemDirection: "left-to-right",
                      itemOpacity: 0.85,
                      symbolSize: 20,
                      effects: [
                        {
                          on: "hover",
                          style: {
                            itemOpacity: 1,
                          },
                        },
                      ],
                    },
                  ]}
                  animate={true}
                  motionConfig="gentle"
                />
              )}

              {selectedChart === "distribution" && distributionChartData.length > 0 && (
                <ResponsivePie
                  data={distributionChartData}
                  margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                  innerRadius={0.5}
                  padAngle={0.7}
                  cornerRadius={3}
                  activeOuterRadiusOffset={8}
                  colors={{ scheme: "nivo" }}
                  borderWidth={1}
                  borderColor={{
                    from: "color",
                    modifiers: [["darker", 0.2]],
                  }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#333333"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: "color" }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{
                    from: "color",
                    modifiers: [["darker", 2]],
                  }}
                  legends={[
                    {
                      anchor: "bottom",
                      direction: "row",
                      justify: false,
                      translateX: 0,
                      translateY: 56,
                      itemsSpacing: 0,
                      itemWidth: 100,
                      itemHeight: 18,
                      itemTextColor: "#999",
                      itemDirection: "left-to-right",
                      itemOpacity: 1,
                      symbolSize: 18,
                      symbolShape: "circle",
                      effects: [
                        {
                          on: "hover",
                          style: {
                            itemTextColor: "#000",
                          },
                        },
                      ],
                    },
                  ]}
                />
              )}

              {((selectedChart === "daywise" && daywiseChartData.length === 0) ||
                (selectedChart === "performance" && performanceChartData.length === 0) ||
                (selectedChart === "volume" && volumeChartData.length === 0) ||
                (selectedChart === "distribution" && distributionChartData.length === 0)) && (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No data available for the selected filters.</p>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {selectedChart === "daywise" && daywiseData && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p
                  className={`text-2xl font-bold ${(daywiseData.reduce((sum, d) => sum + d.profit, 0) >= 0 ? "text-green-600" : "text-red-600")
                    }`}
                >
                  {formatCurrency(daywiseData.reduce((sum, d) => sum + d.profit, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days with Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  {daywiseData.filter((d) => d.profit > 0).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days with Loss</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-red-600">
                    {daywiseData.filter((d) => d.profit < 0).length}
                  </p>
                  {daywiseData.some((d) => d.profit < 0 && d.losses && d.losses.length > 0) && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <AlertCircle className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Loss Details</DialogTitle>
                          <DialogDescription>
                            Detailed breakdown of all days with losses
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {daywiseData
                            .filter((d) => d.profit < 0 && d.losses && d.losses.length > 0)
                            .map((day, idx) => (
                              <div key={idx} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-red-600">
                                    {formatDate(new Date(day.date))}
                                  </h3>
                                  <p className="text-red-600 font-bold">
                                    Total Loss: {formatCurrency(day.profit)}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  {day.losses.map((loss: any, lossIdx: number) => (
                                    <div
                                      key={lossIdx}
                                      className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800"
                                    >
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                        <div>
                                          <p className="text-muted-foreground">Stock</p>
                                          <p className="font-medium">{loss.stockSymbol}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">Shares Sold</p>
                                          <p className="font-medium">{loss.quantity.toFixed(2)}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">Sell Price</p>
                                          <p className="font-medium">{formatCurrency(loss.unitPrice)}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">Avg Cost</p>
                                          <p className="font-medium">{formatCurrency(loss.avgCost)}</p>
                                        </div>
                                        <div className="col-span-2">
                                          <p className="text-muted-foreground">Total Amount</p>
                                          <p className="font-medium">{formatCurrency(loss.totalAmount)}</p>
                                        </div>
                                        <div className="col-span-2">
                                          <p className="text-muted-foreground">Loss</p>
                                          <p className="font-bold text-red-600">
                                            {formatCurrency(Math.abs(loss.loss))}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Daily</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    daywiseData.length > 0
                      ? daywiseData.reduce((sum, d) => sum + d.profit, 0) / daywiseData.length
                      : 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
