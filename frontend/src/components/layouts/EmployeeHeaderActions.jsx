import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import ModeToggle from "@/components/ModeToggle";

export default function EmployeeHeaderActions({
  showUserLabel = true,
  modeToggleCollapsed = false,
}) {
  const { user, logout } = useAuth();

  return (
    <>
      <ModeToggle collapsed={modeToggleCollapsed} width_full={false} />
      {showUserLabel ? (
        <span className="text-sm text-muted-foreground hidden sm:block">
          {user?.name}
        </span>
      ) : (
        <>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground max-w-[220px]">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.name ?? "..."}</span>
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        className="text-destructive hover:text-destructive"
      >
        <LogOut className="h-4 w-4 mr-1" />
        Keluar
      </Button>
    </>
  );
}
