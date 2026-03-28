import {
  ArrowLeft01Icon,
  ComputerIcon,
  KeyboardIcon,
  MoonIcon,
  RotateIcon,
  SunIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  COLOR_THEMES,
  type ColorTheme,
  type Theme,
  useTheme,
} from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useKeyboardShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

interface ThemeMetadata {
  id: ColorTheme;
  name: string;
  primary: string;
  light: { bg: string; sidebar: string };
  dark: { bg: string; sidebar: string };
}

function ShortcutRecorder({
  initialKeys,
  onSave,
}: {
  initialKeys: string[];
  onSave: (keys: string[]) => void;
}) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [keys, setKeys] = React.useState<string[]>(initialKeys);

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();

      const newKeys: string[] = [];
      if (e.ctrlKey || e.metaKey) newKeys.push("ctrl");
      if (e.shiftKey) newKeys.push("shift");
      if (e.altKey) newKeys.push("alt");

      const key = e.key.toLowerCase();
      if (!["control", "shift", "alt", "meta"].includes(key)) {
        newKeys.push(key);
        setKeys(newKeys);
        onSave(newKeys);
        setIsRecording(false);
      }
    },
    [isRecording, onSave],
  );

  React.useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isRecording, handleKeyDown]);

  return (
    <Button
      variant={isRecording ? "destructive" : "outline"}
      size="sm"
      onClick={() => setIsRecording(!isRecording)}
      className="h-7 min-w-24 gap-1 px-2 text-xs"
    >
      {isRecording ? (
        "Recording..."
      ) : (
        <div className="flex items-center gap-1">
          {keys.map((key) => (
            <kbd
              key={key}
              className="rounded bg-muted px-1 py-0.5 font-sans text-[10px] text-muted-foreground uppercase"
            >
              {key}
            </kbd>
          ))}
        </div>
      )}
    </Button>
  );
}

function parseTheme(id: ColorTheme, css: string): ThemeMetadata {
  const extractVar = (section: string, name: string) => {
    const regex = new RegExp(`${name}:\\s*([^;\\n]+)`);
    const match = section.match(regex);
    return match ? match[1].trim() : "";
  };

  const rootMatch = css.match(/:root\s*{([^}]+)}/);
  const darkMatch = css.match(/\.dark\s*{([^}]+)}/);

  const root = rootMatch ? rootMatch[1] : "";
  const dark = darkMatch ? darkMatch[1] : "";

  const nameMatch = root.match(/--theme-name:\s*"([^"]+)"/);
  const name = nameMatch ? nameMatch[1] : id;

  return {
    id,
    name,
    primary: extractVar(root, "--primary"),
    light: {
      bg: extractVar(root, "--background"),
      sidebar:
        extractVar(root, "--sidebar") || extractVar(root, "--background"),
    },
    dark: {
      bg: extractVar(dark, "--background") || extractVar(root, "--background"),
      sidebar:
        extractVar(dark, "--sidebar") ||
        extractVar(dark, "--background") ||
        extractVar(root, "--sidebar") ||
        extractVar(root, "--background"),
    },
  };
}

function SettingsPage() {
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    fontSize,
    setFontSize,
    showHiddenFiles,
    setShowHiddenFiles,
  } = useTheme();
  const { shortcuts, updateShortcut, resetShortcuts } = useKeyboardShortcuts();

  const [themes, setThemes] = React.useState<ThemeMetadata[]>([]);

  React.useEffect(() => {
    const loadThemes = async () => {
      const loaded = await Promise.all(
        COLOR_THEMES.map(async (id) => {
          try {
            const res = await fetch(`/themes/${id}.css`);
            const text = await res.text();
            return parseTheme(id, text);
          } catch (e) {
            console.error(`Failed to load theme ${id}`, e);
            return null;
          }
        }),
      );
      setThemes(loaded.filter((t): t is ThemeMetadata => t !== null));
    };
    loadThemes();
  }, []);

  const resolvedTheme = React.useMemo(() => {
    if (theme !== "system") return theme;
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [theme]);

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" type="button">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-bold text-3xl tracking-tight">Settings</h1>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how MDWrite looks on your screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <Label>Mode</Label>
                  <p className="text-muted-foreground text-sm">
                    Select your preferred light or dark mode.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: "light", icon: SunIcon, label: "Light" },
                    { id: "dark", icon: MoonIcon, label: "Dark" },
                    { id: "system", icon: ComputerIcon, label: "System" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id as Theme)}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                        theme === item.id
                          ? "border-primary bg-accent"
                          : "border-muted bg-transparent"
                      }`}
                    >
                      <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
                      <span className="font-medium text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-0.5">
                  <Label>Color Theme</Label>
                  <p className="text-muted-foreground text-sm">
                    Choose a primary color for your interface.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {themes.map((ct) => {
                    const currentColors =
                      resolvedTheme === "dark" ? ct.dark : ct.light;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => setColorTheme(ct.id)}
                        className={`group relative flex overflow-hidden rounded-xl border-2 transition-all hover:ring-2 hover:ring-primary/20 ${
                          colorTheme === ct.id
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-muted"
                        }`}
                      >
                        {/* Sidebar area */}
                        <div
                          className="w-12 shrink-0 border-r"
                          style={{ backgroundColor: currentColors.sidebar }}
                        />

                        {/* Main content area */}
                        <div
                          className="flex flex-1 flex-col p-3 text-left"
                          style={{ backgroundColor: currentColors.bg }}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className="font-semibold text-sm"
                              style={{
                                color:
                                  resolvedTheme === "light" ? "black" : "white",
                              }}
                            >
                              {ct.name}
                            </span>
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: ct.primary }}
                            />
                          </div>

                          {/* Lines */}
                          <div className="space-y-1.5">
                            <div
                              className="h-1 w-full rounded-full opacity-20"
                              style={{ backgroundColor: ct.primary }}
                            />
                            <div
                              className="h-1 w-2/3 rounded-full opacity-20"
                              style={{ backgroundColor: ct.primary }}
                            />
                            <div
                              className="mt-2 h-1 w-1/2 rounded-full"
                              style={{ backgroundColor: ct.primary }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Font Size</Label>
                  <p className="text-muted-foreground text-sm">
                    Adjust the editor font size.
                  </p>
                </div>
                <Select
                  value={fontSize}
                  onValueChange={(v) => v && setFontSize(v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {["12", "14", "16", "18", "20", "24"].map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Hidden Files</Label>
                  <p className="text-muted-foreground text-sm">
                    Show files and folders starting with a dot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    showHiddenFiles ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-background transition-transform ${
                      showHiddenFiles ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <HugeiconsIcon icon={KeyboardIcon} className="h-5 w-5" />
                  Keyboard Shortcuts
                </CardTitle>
                <CardDescription>
                  Configure custom hotkeys for common actions.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetShortcuts}
                className="h-8 gap-2"
              >
                <HugeiconsIcon icon={RotateIcon} className="h-3.5 w-3.5" />
                Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "new-file", label: "New File" },
                { id: "search", label: "Search Content" },
                { id: "command-bar", label: "Command Bar" },
                { id: "toggle-sidebar", label: "Toggle Sidebar" },
                { id: "open-folder", label: "Open Folder" },
              ].map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between"
                >
                  <Label>{action.label}</Label>
                  <ShortcutRecorder
                    initialKeys={shortcuts[action.id] || []}
                    onSave={(keys) => updateShortcut(action.id, keys)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>MDWrite v0.1.0</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                MDWrite is a clean, privacy-focused markdown editor that works
                directly with your local files.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
