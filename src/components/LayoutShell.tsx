import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, TrendingUp, BarChart3, AlertCircle, Briefcase, Star, Lightbulb, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTickerTape } from "@/components/LiveTickerTape";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TickerSearch } from "@/components/TickerSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [healthStatus, setHealthStatus] = useState<"ok" | "error">("ok");
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  // Live ticker tapes - show top assets from different categories
  const tickerTickers = ["AAPL", "MSFT", "BTC-USD", "ETH-USD", "EURUSD=X", "GOOGL", "TSLA", "SOL-USD"];
  const tickerBasePrices = new Map([
    ["AAPL", 150],
    ["MSFT", 380],
    ["BTC-USD", 43000],
    ["ETH-USD", 2300],
    ["EURUSD=X", 1.08],
    ["GOOGL", 140],
    ["TSLA", 240],
    ["SOL-USD", 100],
  ]);

  useEffect(() => {
    // Health check is always ok in client-side only version
    setHealthStatus("ok");
  }, []);

  const navItems = [
    { href: "/", label: "Dashboard", icon: TrendingUp },
    { href: "/backtest", label: "Backtest", icon: BarChart3 },
  ];

  const protectedNavItems = user ? [
    { href: "/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/watchlist", label: "Watchlist", icon: Star },
    { href: "/advice", label: "Advice", icon: Lightbulb },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Quant Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  Multi-Asset Trading Intelligence
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="hidden lg:flex flex-1 max-w-xl">
              <TickerSearch />
            </div>

            <div className="flex items-center gap-6">
              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {[...navItems, ...protectedNavItems].map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Health Indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    healthStatus === "ok" ? "bg-primary" : "bg-destructive"
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {healthStatus === "ok" ? "Live" : "Offline"}
                </span>
              </div>

              {/* User Menu */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <User className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/auth">
                  <Button variant="default" size="sm">
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Search */}
        <div className="lg:hidden px-4 pb-4">
          <TickerSearch />
        </div>
      </header>

      {/* Live Ticker Tape */}
      <LiveTickerTape tickers={tickerTickers} basePrices={tickerBasePrices} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>

      {/* Disclaimer */}
      <footer className="border-t border-border bg-card/30 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Disclaimer:</strong> This dashboard is for educational and informational
              purposes only. It does not constitute financial advice. Trading involves substantial
              risk of loss. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
