import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useDataset } from "@/context/DatasetContext";
import ModeToggle from "@/components/ModeToggle";

const DATASET_PAGES = ["rooms", "lecturers", "courses", "time-slots", "classes"];

function resolvePathForDataset(pathname, datasetId) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const firstAsNumber = Number(first);
  const hasDatasetPrefix = Number.isInteger(firstAsNumber);

  const page = hasDatasetPrefix ? segments[1] : segments[0];
  if (page && DATASET_PAGES.includes(page)) {
    return `/${datasetId}/${page}`;
  }

  return `/${datasetId}/rooms`;
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { datasets, selected, loading, selectDataset } = useDataset();

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const maybeDatasetId = Number(segments[0]);
    if (!Number.isInteger(maybeDatasetId)) return;
    const found = datasets.find((d) => d.id === maybeDatasetId);
    if (found && found.id !== selected?.id) {
      selectDataset(found);
    }
  }, [pathname, datasets, selected?.id, selectDataset]);

  const handleDatasetSelect = (next) => {
    if (!next) return;

    selectDataset(next);
    navigate(resolvePathForDataset(pathname, next.id));
  };

  return (
    <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
      <div className="flex items-center gap-3 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-[180px]" id="dataset-switcher" disabled={loading || datasets.length === 0}>
            <span className="truncate text-left">
              {loading ? "Memuat dataset..." : (selected?.name ?? "Pilih dataset")}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {datasets.map((ds) => (
              <DropdownMenuItem
                key={ds.id}
                selected={selected?.id === ds.id}
                onClick={() => handleDatasetSelect(ds)}
              >
                {ds.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ModeToggle width_full={false} />
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground max-w-[220px]">
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{user?.name ?? "..."}</span>
        </div>
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
  );
}
