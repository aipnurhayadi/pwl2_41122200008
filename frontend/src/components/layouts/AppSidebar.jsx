import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Home,
  Database,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDataset } from "@/context/DatasetContext";
import SidebarUserNav from "@/components/layouts/SidebarUserNav";

const adminLinks = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/datasets", label: "Datasets", icon: Database },
  { path: "/employees", label: "Employee", icon: Briefcase },
];

const masterLinks = [
  { path: "rooms", label: "Ruangan" },
  { path: "lecturers", label: "Dosen" },
  { path: "courses", label: "Mata Kuliah" },
  { path: "time-slots", label: "Slot Waktu" },
  { path: "classes", label: "Kelas" },
];

function DatasetNavItem({ dataset, pathname, selectDataset }) {
  const isOnMasterData = pathname.startsWith(`/dataset/${dataset.id}/`);
  const isOnDetail = pathname === `/datasets/${dataset.id}`;
  const isExpanded = isOnMasterData || isOnDetail;

  return (
    <Collapsible
      defaultOpen={isExpanded}
      className="group/dataset"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={<SidebarMenuButton isActive={isOnDetail} tooltip={dataset.name} />}
        >
          <Database />
          <span>{dataset.name}</span>
          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/dataset:rotate-180" />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {masterLinks.map(({ path, label }) => {
              const to = `/dataset/${dataset.id}/${path}`;
              return (
                <SidebarMenuSubItem key={path}>
                  <SidebarMenuSubButton
                    render={
                      <Link
                        to={to}
                        onClick={() => selectDataset(dataset)}
                      />
                    }
                    isActive={pathname === to}
                    className="text-muted-foreground hover:text-sidebar-foreground data-active:text-sidebar-accent-foreground"
                  >
                    <span>{label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<Link to={`/datasets/${dataset.id}`} />}
                isActive={pathname === `/datasets/${dataset.id}`}
                className="text-muted-foreground hover:text-sidebar-foreground data-active:text-sidebar-accent-foreground"
              >
                <span>Detail Dataset</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { datasets, loading, selected, selectDataset } = useDataset();

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const prefix = segments[0];
    if (prefix !== "dataset" && prefix !== "datasets") return;

    const maybeDatasetId = Number(segments[1]);
    if (!Number.isInteger(maybeDatasetId)) return;

    const found = datasets.find((d) => d.id === maybeDatasetId);
    if (found && found.id !== selected?.id) {
      selectDataset(found);
    }
  }, [pathname, datasets, selected?.id, selectDataset]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/home" />}
              tooltip="TIMETABLE TOOL"
            >
              <CalendarDays className="size-4" />
              <span className="font-semibold">TIMETABLE TOOL</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            {adminLinks.map(({ path, label, icon: Icon }) => (
              <SidebarMenuItem key={path}>
                <SidebarMenuButton
                  render={<Link to={path} />}
                  isActive={pathname === path}
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Datasets</SidebarGroupLabel>
          <SidebarMenu>
            {loading && (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Memuat dataset...</SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!loading && datasets.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Belum ada dataset</SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {datasets.map((dataset) => (
              <DatasetNavItem
                key={dataset.id}
                dataset={dataset}
                pathname={pathname}
                selectDataset={selectDataset}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarUserNav />
      <SidebarRail />
    </Sidebar>
  );
}
