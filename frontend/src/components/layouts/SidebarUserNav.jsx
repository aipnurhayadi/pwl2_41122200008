import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

function resolveUserProfile(user) {
  if (!user || typeof user !== "object") {
    return { name: "Pengguna", email: "", initial: "P" };
  }

  const name =
    user.name?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    user.role?.trim() ||
    "Pengguna";
  const email = user.email?.trim() ?? "";
  const initial = name.charAt(0).toUpperCase() || "P";

  return { name, email, initial };
}

function UserAvatar({ initial, className }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground",
        className
      )}
    >
      {initial}
    </span>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

export default function SidebarUserNav() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const { name, email, initial } = resolveUserProfile(user);

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip={name}
                  className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                />
              }
            >
              <UserAvatar initial={initial} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
              className="min-w-56 rounded-lg p-0"
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                  <UserAvatar initial={initial} />
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuGroup className="p-1">
                <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
                  Tema
                </DropdownMenuLabel>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={value}
                    selected={theme === value}
                    onClick={() => setTheme(value)}
                  >
                    <Icon className="size-4" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup className="p-1">
                <DropdownMenuItem
                  className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                  onClick={logout}
                >
                  <LogOut className="size-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
