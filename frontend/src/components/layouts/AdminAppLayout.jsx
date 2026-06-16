import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "@/components/layouts/AppSidebar";
import AdminTopbar from "@/components/layouts/AdminTopbar";
import { DatasetProvider } from "@/context/DatasetContext";

export default function AdminAppLayout({ children }) {
  return (
    <DatasetProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AdminTopbar />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </DatasetProvider>
  );
}
