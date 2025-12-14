import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navigation from "./components/Navigation";
import Home from "./pages/Home";
import Stocks from "./pages/Stocks";
import Entry from "./pages/Entry";
import StockDetail from "./pages/StockDetail";
import Watchlist from "./pages/Watchlist";
import Reports from "./pages/Reports";
import Import from "./pages/Import";
import TransactionAudit from "./pages/TransactionAudit";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/stocks" component={Stocks} />
      <Route path="/entry" component={Entry} />
      <Route path="/stock/:id" component={StockDetail} />
      <Route path="/import" component={Import} />
      <Route path="/audit" component={TransactionAudit} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/reports" component={Reports} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
