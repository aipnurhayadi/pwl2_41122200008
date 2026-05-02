import { Link } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModeToggle from "@/components/ModeToggle";

export default function GuestHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span>TIMETABLE TOOL</span>
        </Link>
        <nav className="flex items-center gap-3">
          <ModeToggle width_full={false} />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Daftar
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
