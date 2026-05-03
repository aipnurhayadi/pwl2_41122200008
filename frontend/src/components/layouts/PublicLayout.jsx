import { Link } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModeToggle from "@/components/ModeToggle";

export default function PublicLayout({
  leftContent,
  rightContent,
  maxWidth = "max-w-5xl",
  containerPadding = "px-4",
  wrapChildrenInMain = false,
  mainClassName = "",
  children,
}) {
  const headerLeft = leftContent ?? (
    <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
      <span>TIMETABLE TOOL</span>
    </Link>
  );

  const headerRight = rightContent ?? (
    <>
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
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div
          className={`container mx-auto flex h-14 ${maxWidth} items-center justify-between ${containerPadding}`}
        >
          {headerLeft}
          <div className="flex items-center gap-3">{headerRight}</div>
        </div>
      </header>
      {children && wrapChildrenInMain ? (
        <main className={`${maxWidth} mx-auto px-6 py-8 ${mainClassName}`}>
          {children}
        </main>
      ) : children ? (
        children
      ) : null}
    </div>
  );
}
