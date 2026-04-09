import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  GraduationCap,
  BookOpen,
  Clock,
  LogOut,
  CalendarDays,
  Menu,
  X,
  User,
  ChevronLeft,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Database,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useDataset } from "@/context/DatasetContext";

const masterLinks = [
  { path: "rooms", label: "Ruangan", icon: Building2 },
  { path: "lecturers", label: "Dosen", icon: GraduationCap },
  { path: "courses", label: "Mata Kuliah", icon: BookOpen },
  { path: "time-slots", label: "Slot Waktu", icon: Clock },
];

// ── Inline dataset dropdown ───────────────────────────────────────────────────
function DatasetPicker({ collapsed }) {
  const { datasets, selected, loading, selectDataset, createDataset, updateDataset, deleteDataset } =
    useDataset();
  const navigate = useNavigate();
  const { datasetId } = useParams();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // "add" | { edit: dataset }
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // dataset id
  const dropRef = useRef(null);

  // Sync URL param → selected on mount / navigation
  useEffect(() => {
    if (datasetId && datasets.length) {
      const id = parseInt(datasetId, 10);
      const found = datasets.find((d) => d.id === id);
      if (found && found.id !== selected?.id) selectDataset(found);
    }
  }, [datasetId, datasets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
        setMode(null);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (ds) => {
    selectDataset(ds);
    setOpen(false);
    setMode(null);
    // navigate to same page but new datasetId
    const segments = window.location.pathname.split("/").filter(Boolean);
    const page = segments.length >= 2 ? segments[1] : "rooms";
    navigate(`/${ds.id}/${page}`);
  };

  const startAdd = (e) => {
    e.stopPropagation();
    setMode("add");
    setInputVal("");
    setError(null);
  };

  const startEdit = (e, ds) => {
    e.stopPropagation();
    setMode({ edit: ds });
    setInputVal(ds.name);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setSaving(true);
    setError(null);
    if (mode === "add") {
      const res = await createDataset(inputVal.trim());
      if (res.error) { setError(res.error); setSaving(false); return; }
      selectDataset(res.data);
      const segments = window.location.pathname.split("/").filter(Boolean);
      const page = segments.length >= 2 ? segments[1] : "rooms";
      navigate(`/${res.data.id}/${page}`);
    } else {
      const res = await updateDataset(mode.edit.id, inputVal.trim());
      if (res.error) { setError(res.error); setSaving(false); return; }
    }
    setSaving(false);
    setMode(null);
  };

  const handleDelete = async (e, ds) => {
    e.stopPropagation();
    if (confirmDelete !== ds.id) { setConfirmDelete(ds.id); return; }
    setSaving(true);
    const res = await deleteDataset(ds.id);
    setSaving(false);
    setConfirmDelete(null);
    if (res.error) { setError(res.error); return; }
    if (!selected) navigate("/rooms");
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-full py-2 rounded-md hover:bg-accent transition-colors"
        title={selected?.name ?? "Pilih Dataset"}
      >
        <Database className="h-4 w-4 text-primary" />
      </button>
    );
  }

  return (
    <div className="px-2 pb-1" ref={dropRef}>
      {/* Trigger */}
      <button
        onClick={() => { setOpen((v) => !v); setMode(null); setError(null); }}
        className="flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <Database className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 truncate text-left">
          {loading ? "Memuat..." : selected?.name ?? "Pilih Dataset"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="mt-1 rounded-md border bg-popover shadow-md text-sm overflow-hidden">
          {/* Dataset list */}
          <div className="max-h-52 overflow-y-auto">
            {datasets.length === 0 && !loading && (
              <p className="px-3 py-2 text-muted-foreground text-xs">Belum ada dataset</p>
            )}
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className={`group flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-accent transition-colors ${
                  selected?.id === ds.id ? "bg-accent" : ""
                }`}
                onClick={() => handleSelect(ds)}
              >
                {selected?.id === ds.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                {selected?.id !== ds.id && <span className="w-3.5 shrink-0" />}

                {/* Inline edit input */}
                {mode?.edit?.id === ds.id ? (
                  <form onSubmit={handleSave} className="flex-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      autoFocus
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      className="h-6 text-xs py-0 px-1.5"
                    />
                    <Button type="submit" size="icon" className="h-6 w-6 shrink-0" disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                  </form>
                ) : (
                  <span className="flex-1 truncate">{ds.name}</span>
                )}

                {/* Edit / Delete actions */}
                {mode?.edit?.id !== ds.id && (
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => startEdit(e, ds)}
                      className="p-1 rounded hover:bg-background/70"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, ds)}
                      className={`p-1 rounded hover:bg-background/70 ${confirmDelete === ds.id ? "text-destructive" : ""}`}
                      title={confirmDelete === ds.id ? "Klik lagi untuk konfirmasi" : "Hapus"}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Add new */}
          {mode === "add" ? (
            <form onSubmit={handleSave} className="flex gap-1 px-2 py-1.5">
              <Input
                autoFocus
                placeholder="Nama dataset baru"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="h-7 text-xs"
              />
              <Button type="submit" size="icon" className="h-7 w-7 shrink-0" disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </form>
          ) : (
            <button
              onClick={startAdd}
              className="flex w-full items-center gap-2 px-3 py-2 text-primary hover:bg-accent transition-colors text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Dataset
            </button>
          )}

          {error && <p className="px-3 pb-2 text-destructive text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── Nav links with datasetId awareness ────────────────────────────────────────
function NavLinks({ collapsed, closeMenu }) {
  const { pathname } = useLocation();
  const { selected } = useDataset();
  const { datasetId } = useParams();

  const activeId = datasetId ?? selected?.id;

  return (
    <>
      {masterLinks.map(({ path, label, icon: Icon }) => {
        const to = activeId ? `/${activeId}/${path}` : `/${path}`;
        const isActive = pathname === to || pathname.endsWith(`/${path}`);
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

// ── Main sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Mobile topbar ──────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
        <Link to="/rooms" className="flex items-center gap-2 font-semibold text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span>PWL</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* ── Mobile overlay ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-background border-r transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b">
          <Link to="/rooms" className="flex items-center gap-2 font-semibold text-base" onClick={() => setMobileOpen(false)}>
            <CalendarDays className="h-5 w-5 text-primary" />
            <span>PWL</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="pt-3">
          <DatasetPicker collapsed={false} />
        </div>
        <Separator className="my-2" />
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          <NavLinks collapsed={false} closeMenu={() => setMobileOpen(false)} />
        </nav>
        <div className="border-t px-2 py-3 space-y-1">
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.name ?? "..."}</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => { setMobileOpen(false); logout(); }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-r bg-background transition-all duration-200 shrink-0 ${
          collapsed ? "w-[60px]" : "w-64"
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between px-3 border-b">
          {collapsed ? (
            <Link to="/rooms" className="mx-auto">
              <CalendarDays className="h-5 w-5 text-primary" />
            </Link>
          ) : (
            <>
              <Link to="/rooms" className="flex items-center gap-2 font-semibold text-base min-w-0">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">PWL</span>
              </Link>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setCollapsed(true)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Dataset picker */}
        <div className="pt-3">
          <DatasetPicker collapsed={collapsed} />
        </div>

        <Separator className="my-2" />

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          <NavLinks collapsed={collapsed} closeMenu={() => {}} />
        </nav>

        {/* Footer */}
        <div className="border-t px-2 py-3 space-y-1">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{user?.name ?? "..."}</span>
            </div>
          )}
          <Button
            variant="ghost"
            className={`w-full text-destructive hover:text-destructive ${collapsed ? "justify-center px-0" : "justify-start"}`}
            title={collapsed ? "Keluar" : undefined}
            onClick={logout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2">Keluar</span>}
          </Button>
          {collapsed && (
            <Button variant="ghost" className="w-full justify-center px-0" title="Perluas sidebar" onClick={() => setCollapsed(false)}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}

