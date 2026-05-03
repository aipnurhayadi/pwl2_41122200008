import { Database } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import EmployeeHeaderActions from "@/components/layouts/EmployeeHeaderActions";

export default function EmployeeAppLayout({
  title,
  icon: Icon = Database,
  navContent = null,
  maxWidth = "max-w-5xl",
  mainClassName = "",
  children,
}) {
  const headerLeft = (
    <div className="flex items-center gap-2 font-semibold text-lg">
      <Icon className="h-5 w-5 text-primary" />
      <span>{title}</span>
    </div>
  );

  const headerRight = (
    <>
      {navContent}
      <EmployeeHeaderActions modeToggleCollapsed />
    </>
  );

  return (
    <PublicLayout
      leftContent={headerLeft}
      rightContent={headerRight}
      maxWidth={maxWidth}
      containerPadding="px-6"
      wrapChildrenInMain
      mainClassName={mainClassName}
    >
      {children}
    </PublicLayout>
  );
}
