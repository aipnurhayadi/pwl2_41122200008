import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function DropdownMenu({ ...props }) {
  return <MenuPrimitive.Root {...props} />;
}

function DropdownMenuTrigger({ className, children, render, ...props }) {
  return (
    <MenuPrimitive.Trigger
      className={cn(
        !render &&
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      render={render}
      {...props}
    >
      {children}
    </MenuPrimitive.Trigger>
  );
}

function DropdownMenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  alignOffset,
  sideOffset = 4,
  ...props
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className="isolate z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-[var(--anchor-width)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none duration-100",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, children, selected = false, inset = false, ...props }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        selected ? "pl-8 pr-3" : inset ? "pl-8 pr-3" : "px-2",
        className
      )}
      {...props}
    >
      {selected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </MenuPrimitive.Item>
  );
}

function DropdownMenuLabel({ className, ...props }) {
  return (
    <div
      className={cn("px-2 py-1.5 text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }) {
  return (
    <div
      role="separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuGroup({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col gap-0.5 p-1", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
};
