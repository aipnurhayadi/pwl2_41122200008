import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  GraduationCap,
  BookOpen,
  Clock,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  Home,
  Database,
  Briefcase,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const adminLinks = [
  { path: "home", label: "Home", icon: Home, datasetAware: false },
  { path: "datasets", label: "Datasets", icon: Database, datasetAware: false },
  {
    path: "employees",
    label: "Employee",
    icon: Briefcase,
    datasetAware: false,
  },
];

const masterLinks = [
  { path: "rooms", label: "Ruangan", icon: Building2 },
  { path: "lecturers", label: "Dosen", icon: GraduationCap },
  { path: "courses", label: "Mata Kuliah", icon: BookOpen },
  { path: "time-slots", label: "Slot Waktu", icon: Clock },
  { path: "classes", label: "Kelas", icon: Users },
];

const DATASET_PAGES = ["rooms", "lecturers", "courses", "time-slots", "classes"];

function resolvePathForDataset(pathname, datasetId) {
  const segments = pathname.split("/").filter(Boolean);
  const hasDatasetPrefix = segments[0] === "dataset";
  const page = hasDatasetPrefix ? segments[2] : segments[0];
  if (page && DATASET_PAGES.includes(page)) {
    return `/dataset/${datasetId}/${page}`;
  }

  return `/dataset/${datasetId}/rooms`;
}

function NavLinks({ collapsed, closeMenu }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { selected, datasets, loading, selectDataset } = useDataset();
  const { token } = useAuth();
  const { datasetId } = useParams();
  const [generating, setGenerating] = useState(false);

  const activeId = datasetId ?? selected?.id;
  const generateDatasetId = activeId ?? selected?.id;

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "dataset") return;
    const maybeDatasetId = Number(segments[1]);
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
    closeMenu();
  };

  const handleGenerate = async () => {
    if (!generateDatasetId) {
      window.alert("Pilih dataset terlebih dahulu.");
      return;
    }

    if (!token) {
      window.alert("User belum login.");
      return;
    }

    setGenerating(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const treeRes = await fetch(`/api/datasets/${generateDatasetId}/tree`, { headers });
      if (!treeRes.ok) {
        const body = await treeRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat data dataset");
      }

      const tree = await treeRes.json();
      const classGroup = tree?.classes?.[0];
      const courses = tree?.courses ?? [];
      const lecturers = tree?.lecturers ?? [];

      if (!classGroup || courses.length === 0 || lecturers.length === 0) {
        throw new Error("Dataset harus memiliki kelas, mata kuliah, dan dosen terlebih dahulu.");
      }

      let requestPayload = null;
      for (const lecturer of lecturers) {
        const constraintsRes = await fetch(
          `/api/datasets/${generateDatasetId}/lecturers/${lecturer.id}/constraints`,
          { headers },
        );
        if (!constraintsRes.ok) continue;

        const constraints = await constraintsRes.json();
        const allowedCourseIds = new Set((constraints.allowed_course_ids ?? []).map(String));
        const course = courses.find((row) => allowedCourseIds.has(String(row.id)));

        if (course) {
          requestPayload = {
            teaching_requests: [
              {
                class_id: classGroup.id,
                course_id: course.id,
                lecturer_id: lecturer.id,
                duration_slots: 1,
              },
            ],
            daily_session_limit: 2,
          };
          break;
        }
      }

      if (!requestPayload) {
        throw new Error("Tidak ada kombinasi dosen dan mata kuliah yang valid untuk generate.");
      }

      const generateRes = await fetch(`/api/datasets/${generateDatasetId}/timetable-runs/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(requestPayload),
      });

      const responseBody = await generateRes.json().catch(() => ({}));
      if (!generateRes.ok) {
        throw new Error(responseBody.detail ?? "Gagal menjalankan generate");
      }

      window.alert(`Generate berhasil dijalankan. Run ID: ${responseBody.id ?? "-"}`);
    } catch (error) {
      window.alert(error.message ?? "Gagal menjalankan generate");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {collapsed ? (
        <Separator className="my-4" />
      ) : (
        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Admin
        </p>
      )}
      {adminLinks.map(({ path, label, icon: Icon, datasetAware }) => {
        const to = datasetAware && activeId ? `/${activeId}/${path}` : `/${path}`;
        const isActive = pathname === to;
        return (
          <Button
            key={path}
            variant={isActive ? "secondary" : "ghost"}
            asChild
            className={`w-full ${collapsed ? "justify-center px-0" : "justify-start"}`}
            title={collapsed ? label : undefined}
            onClick={closeMenu}
          >
            <Link to={to} className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          </Button>
        );
      })}

      {collapsed ? (
        <Separator className="my-4" />
      ) : (
        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Master Data
        </p>
      )}
      {collapsed ? (
        <div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex-1"
                id="dataset-switcher-sidebar-collapsed"
                disabled={loading || datasets.length === 0}
                title={selected?.name ?? "Pilih dataset"}
              >
                <span className="mx-auto">
                  <Database className="h-4 w-4" />
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
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleGenerate}
              disabled={!generateDatasetId || generating}
              title="Generate timetable"
            >
              <Zap className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-1">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex-1"
                id="dataset-switcher-sidebar"
                disabled={loading || datasets.length === 0}
              >
                <span className="truncate text-left">
                  {loading ? "Memuat dataset..." : selected?.name ?? "Pilih dataset"}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={!generateDatasetId || generating}
            >
              <Zap className="h-4 w-4" />
              <span>Generate</span>
            </Button>
          </div>
        </div>
      )}

      {masterLinks.map(({ path, label, icon: Icon }) => {
        const hasDatasetContext = Boolean(activeId);
        const to = hasDatasetContext ? `/dataset/${activeId}/${path}` : "#";
        const isActive = hasDatasetContext && pathname === to;
        const commonClass = `w-full ${collapsed ? "justify-center px-0" : "justify-start"}`;

        if (!hasDatasetContext) {
          return (
            <Button
              key={path}
              variant="ghost"
              disabled
              className={commonClass}
              title={collapsed ? `${label} (pilih dataset dulu)` : undefined}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </span>
            </Button>
          );
        }

        return (
          <Button
            key={path}
            variant={isActive ? "secondary" : "ghost"}
            asChild
            className={commonClass}
            title={collapsed ? label : undefined}
            onClick={closeMenu}
          >
            <Link to={to} className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          </Button>
        );
      })}
    </>
  );
}

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
        <Link to="/home" className="flex items-center gap-2 font-semibold text-lg">
          <span>TIMETABLE TOOL</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background border-r transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b">
          <Link
            to="/home"
            className="flex items-center gap-2 font-semibold text-base"
            onClick={() => setMobileOpen(false)}
          >
            <span>TIMETABLE TOOL</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          <NavLinks collapsed={false} closeMenu={() => setMobileOpen(false)} />
        </nav>
      </aside>

      <aside
        className={`hidden md:flex flex-col border-r bg-background transition-all duration-200 shrink-0 ${
          collapsed ? "w-[72px]" : "w-72"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b">
          {collapsed ? (
            <Link to="/home" className="mx-auto">
              <span className="truncate">TT</span>
            </Link>
          ) : (
            <>
              <Link
                to="/home"
                className="flex items-center gap-2 font-semibold text-base min-w-0"
              >
                <span className="truncate">TIMETABLE TOOL</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-2">
          <NavLinks collapsed={collapsed} closeMenu={() => {}} />
        </nav>

        {collapsed && (
          <div className="border-t px-2 py-3">
            <Button
              variant="ghost"
              className="w-full justify-center px-0"
              title="Perluas sidebar"
              onClick={() => setCollapsed(false)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
