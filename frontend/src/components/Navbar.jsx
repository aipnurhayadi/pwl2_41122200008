import { Link, useLocation } from "react-router-dom";
import {
  Database,
  Building2,
  GraduationCap,
  BookOpen,
  Clock,
  LogOut,
  LogIn,
  UserPlus,
  CalendarDays,
  Menu,
  X,
  User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

const masterDataLinks = [
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/rooms", label: "Ruangan", icon: Building2 },
  { to: "/lecturers", label: "Dosen", icon: GraduationCap },
  { to: "/courses", label: "Mata Kuliah", icon: BookOpen },
  { to: "/time-slots", label: "Slot Waktu", icon: Clock },
];

const guestLinks = [
  { to: "/login", label: "Login", icon: LogIn },
  { to: "/register", label: "Daftar", icon: UserPlus },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { token, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = token ? masterDataLinks : guestLinks;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Brand */}
        <Link to={token ? "/datasets" : "/"} className="flex items-center gap-2 font-semibold text-lg shrink-0">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span>PWL2 Scheduler</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Button
              key={to}
              variant={pathname === to ? "secondary" : "ghost"}
              asChild
              size="sm"
            >
              <Link to={to} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
        </nav>

        {/* Desktop right: user info + logout OR empty */}
        {token && (
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.name ?? "..."}</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4 mr-1" />
              Keluar
            </Button>
          </div>
        )}

        {/* Mobile toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <Separator />
          <nav className="flex flex-col gap-1 px-4 py-2 md:hidden">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Button
                key={to}
                variant={pathname === to ? "secondary" : "ghost"}
                asChild
                className="justify-start"
                onClick={() => setMobileOpen(false)}
              >
                <Link to={to} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            ))}
            {token && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user?.name ?? "..."}</span>
                </div>
                <Button
                  variant="ghost"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => { setMobileOpen(false); logout(); }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Keluar
                </Button>
              </>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
