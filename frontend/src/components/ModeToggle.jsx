import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

const CYCLE = ["system", "light", "dark"];

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABELS = {
  system: "Sistem",
  light: "Terang",
  dark: "Gelap",
};

/**
 * @param {{ collapsed?: boolean }} props
 */
export default function ModeToggle({ collapsed = false, width_full = true }) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
  };

  const Icon = ICONS[theme] ?? Monitor;

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`${width_full ? "w-full" : ""} justify-center px-0`}
        title={`Mode: ${LABELS[theme]} — klik untuk ganti`}
        onClick={cycleTheme}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      className={`${width_full ? "w-full" : ""} justify-start`}
      onClick={cycleTheme}
      title={`Mode: ${LABELS[theme]} — klik untuk ganti`}
    >
      <Icon className="h-4 w-4 shrink-0 mr-1" />
      <span>{LABELS[theme]}</span>
    </Button>
  );
}
