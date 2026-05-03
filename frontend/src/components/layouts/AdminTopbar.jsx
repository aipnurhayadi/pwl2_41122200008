import EmployeeHeaderActions from "@/components/layouts/EmployeeHeaderActions";

export default function AdminTopbar() {
  return (
    <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
      <div />
      <div className="flex items-center gap-2 shrink-0">
        <EmployeeHeaderActions />
      </div>
    </header>
  );
}
