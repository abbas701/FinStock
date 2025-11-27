import { Link, useLocation } from "wouter";
import { LayoutDashboard, Plus, TrendingUp, BarChart3, Eye, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Stocks", href: "/stocks", icon: Database },
  { name: "Transactions", href: "/entry", icon: Plus },
  { name: "Watchlist", href: "/watchlist", icon: Eye },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer">
                  Portfolio Tracker
                </h1>
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden border-t border-gray-200 dark:border-gray-800">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors cursor-pointer",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

