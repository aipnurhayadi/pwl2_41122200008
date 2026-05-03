import AdminSidebar from "@/components/layouts/AdminSidebar";
import AdminTopbar from "@/components/layouts/AdminTopbar";
import { DatasetProvider } from "@/context/DatasetContext";

export default function AdminAppLayout({ children }) {
  return (
    <DatasetProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-1 min-w-0 flex-col">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </DatasetProvider>
  );
}
