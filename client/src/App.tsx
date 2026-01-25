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
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/stocks">
        <ProtectedRoute component={Stocks} />
      </Route>
      <Route path="/entry">
        <ProtectedRoute component={Entry} />
      </Route>
      <Route path="/stock/:id" component={StockDetail} /> {/* Handles ID internally? Or need wrapper? wouter passes params to component. ProtectedRoute needs to handle props or we wrap differently. */}
      {/* ProtectedRoute as designed above takes `component` prop. It doesn't pass route params automatically if not checking. 
          To support route params with ProtectedRoute, we can modify ProtectedRoute to render children or pass props.
          Let's adjust ProtectedRoute usage.
       */}

      <Route path="/stock/:id">
        <ProtectedRoute component={StockDetail} />
      </Route>

      <Route path="/import">
        <ProtectedRoute component={Import} />
      </Route>
      <Route path="/audit">
        <ProtectedRoute component={TransactionAudit} />
      </Route>
      <Route path="/watchlist">
        <ProtectedRoute component={Watchlist} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>

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
