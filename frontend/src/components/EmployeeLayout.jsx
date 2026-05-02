import { Database, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import ModeToggle from "@/components/ModeToggle";

export default function EmployeeLayout({
  title,
  icon: Icon = Database,
  navContent = null,
  maxWidth = "max-w-5xl",
  mainClassName = "",
  children,
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Icon className="h-5 w-5 text-primary" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {navContent}
          <ModeToggle collapsed width_full={false} />
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Keluar
          </Button>
        </div>
      </header>
      <main className={`${maxWidth} mx-auto px-6 py-8 ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
}
