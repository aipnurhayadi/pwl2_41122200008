import { SidebarTrigger } from "@/components/ui/sidebar";

export default function AdminTopbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
