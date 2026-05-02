import { Link, useLocation, useParams } from "react-router-dom";
import {
  Building2,
  GraduationCap,
  BookOpen,
  Clock,
  Menu,
  X,
  ChevronLeft,
  Home,
  Database,
  Briefcase,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/context/DatasetContext";
import { Separator } from "@/components/ui/separator";

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

function NavLinks({ collapsed, closeMenu }) {
  const { pathname } = useLocation();
  const { selected } = useDataset();
  const { datasetId } = useParams();

  const activeId = datasetId ?? selected?.id;

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
        const to =
          datasetAware && activeId ? `/${activeId}/${path}` : `/${path}`;
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
      {masterLinks.map(({ path, label, icon: Icon }) => {
        const to = activeId ? `/dataset/${activeId}/${path}` : "/datasets";
        const isActive = pathname === to || pathname.startsWith(`/dataset/`) && pathname.endsWith(`/${path}`);
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
    </>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
        <Link
          to="/home"
          className="flex items-center gap-2 font-semibold text-lg"
        >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
          >
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
