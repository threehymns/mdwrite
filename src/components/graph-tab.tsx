import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Delete01Icon,
  RotateIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { forceX, forceY } from "d3-force";
import * as React from "react";
import { lazy, Suspense } from "react";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { FileNode } from "@/lib/fs";
import { readFile } from "@/lib/fs";
import {
  parseInternalLinkBody,
  stripInternalLinkAnchor,
} from "@/lib/internal-links";
import { extractTags, matchQuery } from "@/lib/search";

interface GraphTabProps {
  files: FileNode[];
  onOpenFilePath: (path: string) => void;
}

interface GraphGroup {
  query: string;
  color: string;
}

interface GraphNode {
  id: string;
  label: string;
  path?: string;
  tags: string[];
  ghost: boolean;
  degree: number;
  lastModified: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface PanelState {
  showGhostNotes: boolean;
  showArrows: boolean;
  textFadeThreshold: number;
  nodeSize: number;
  linkThickness: number;
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
  minLinks: number;
  search: string;
  groups: GraphGroup[];
  showTags: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showExistingOnly: boolean;
  isAnimating: boolean;
  animationProgress: number;
}

const INTERNAL_LINK_RE = /!?\[\[([^\]]+)\]\]/g;
const MD_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

const DEFAULT_PANEL: PanelState = {
  showGhostNotes: true,
  showArrows: false,
  textFadeThreshold: 0.9,
  nodeSize: 1.5,
  linkThickness: 1,
  centerForce: 0.08,
  repelForce: 160,
  linkForce: 0.65,
  linkDistance: 110,
  minLinks: 0,
  search: "",
  groups: [],
  showTags: true,
  showAttachments: true,
  showOrphans: true,
  showExistingOnly: false,
  isAnimating: false,
  animationProgress: 1,
};

function normalizePath(path: string): string {
  const parts = path.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join("/");
}

function removeMdExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path.slice(0, -3) : path;
}

function getDirectory(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function flattenMarkdownFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      if (item.kind === "directory" && item.children) {
        walk(item.children);
        continue;
      }
      if (item.kind === "file" && item.name.toLowerCase().endsWith(".md")) {
        result.push(item);
      }
    }
  };
  walk(nodes);
  return result;
}

function resolveInternalLink(
  rawTarget: string,
  currentPath: string,
  pathByNoExt: Map<string, string>,
  pathsByBasename: Map<string, string[]>,
): string | null {
  const target = removeMdExtension(rawTarget.trim()).replace(/^\//, "");
  if (!target) return null;

  const lower = target.toLowerCase();
  if (pathByNoExt.has(lower)) return pathByNoExt.get(lower) || null;

  if (target.includes("/")) {
    const absFromCurrent = normalizePath(
      `${getDirectory(currentPath)}/${target}`,
    );
    const absLower = removeMdExtension(absFromCurrent).toLowerCase();
    if (pathByNoExt.has(absLower)) return pathByNoExt.get(absLower) || null;
  }

  const byBasename = pathsByBasename.get(lower);
  if (byBasename?.length) return byBasename[0];

  return null;
}

function resolveMarkdownLink(
  rawTarget: string,
  currentPath: string,
  pathByNoExt: Map<string, string>,
): string | null {
  let target = rawTarget.trim();
  if (!target) return null;
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }
  if (
    target.startsWith("internal-link:") ||
    target.startsWith("internal-link-embed:")
  ) {
    const schemeSplit = target.split(":", 2);
    target = target.slice(schemeSplit[0].length + 1);
  }
  if (/^[a-z]+:/i.test(target)) return null;
  if (target.startsWith("#")) return null;

  const decoded = safeDecodeURIComponent(target);
  const withoutHash = decoded.split("#")[0].split("?")[0];
  if (!withoutHash) return null;

  const absolute = withoutHash.startsWith("/")
    ? normalizePath(withoutHash.slice(1))
    : normalizePath(`${getDirectory(currentPath)}/${withoutHash}`);

  const lowerNoExt = removeMdExtension(absolute).toLowerCase();
  if (pathByNoExt.has(lowerNoExt)) return pathByNoExt.get(lowerNoExt) || null;

  return null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function linearToSrgb(val: number): number {
  val = Math.max(0, Math.min(1, val));
  if (val <= 0.0031308) {
    return 12.92 * val;
  }
  return 1.055 * val ** (1 / 2.4) - 0.055;
}

function oklchToRgb(oklchString: string): string {
  const match = oklchString.match(
    /oklch\s*\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*\)/i,
  );
  if (!match) return oklchString;

  let l = parseFloat(match[1]);
  const c = parseFloat(match[2]);
  const h = parseFloat(match[3]);

  if (oklchString.includes("%")) {
    l = l / 100;
  }

  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_rgb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  r = linearToSrgb(r);
  g = linearToSrgb(g);
  b_rgb = linearToSrgb(b_rgb);

  const r8 = Math.max(0, Math.min(255, Math.round(r * 255)));
  const g8 = Math.max(0, Math.min(255, Math.round(g * 255)));
  const b8 = Math.max(0, Math.min(255, Math.round(b_rgb * 255)));

  return `rgb(${r8}, ${g8}, ${b8})`;
}

function createPalette() {
  if (typeof document === "undefined" || !document.documentElement) {
    return {
      background: "rgb(20, 20, 20)",
      card: "rgb(35, 35, 35)",
      primary: "rgb(100, 120, 180)",
      chart1: "rgb(100, 120, 180)",
      muted: "rgb(120, 120, 140)",
      foreground: "rgb(220, 220, 220)",
      border: "rgb(60, 60, 70)",
      ring: "rgb(100, 140, 220)",
      link: "rgb(120, 120, 140)",
    };
  }

  const getCssVar = (name: string): string | null => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || null;
  };

  const resolveVar = (name: string, fallback: string): string => {
    const raw = getCssVar(name);
    if (!raw) return fallback;

    if (raw.includes("oklch")) {
      return oklchToRgb(raw);
    }

    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();

    return computed || fallback;
  };

  return {
    background: resolveVar("--background", "rgb(20, 20, 20)"),
    card: resolveVar("--card", "rgb(35, 35, 35)"),
    primary: resolveVar("--primary", "rgb(100, 120, 180)"),
    chart1: resolveVar("--chart-1", "rgb(100, 120, 180)"),
    muted: resolveVar("--muted-foreground", "rgb(120, 120, 140)"),
    foreground: resolveVar("--foreground", "rgb(220, 220, 220)"),
    border: resolveVar("--border", "rgb(60, 60, 70)"),
    ring: resolveVar("--ring", "rgb(100, 140, 220)"),
    link: resolveVar("--muted", "rgb(120, 120, 140)"),
  };
}

function withAlpha(color: string, alpha: number): string {
  const parts = color.match(/\d+(?:\.\d+)?/g);
  if (!parts || parts.length < 3) return color;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function mix(from: number, to: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  return from + (to - from) * t;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mixColors(from: string, to: string, amount: number): string {
  const fromParts = from.match(/\d+(?:\.\d+)?/g);
  const toParts = to.match(/\d+(?:\.\d+)?/g);
  if (!fromParts || !toParts || fromParts.length < 3 || toParts.length < 3) {
    return amount >= 0.5 ? to : from;
  }

  const t = Math.max(0, Math.min(1, amount));
  const fromAlpha = fromParts[3] ? parseFloat(fromParts[3]) : 1;
  const toAlpha = toParts[3] ? parseFloat(toParts[3]) : 1;

  return `rgba(${Math.round(mix(parseFloat(fromParts[0]), parseFloat(toParts[0]), t))}, ${Math.round(mix(parseFloat(fromParts[1]), parseFloat(toParts[1]), t))}, ${Math.round(mix(parseFloat(fromParts[2]), parseFloat(toParts[2]), t))}, ${mix(fromAlpha, toAlpha, t).toFixed(3)})`;
}

function getLabelZoomScale(globalScale: number): number {
  return Math.max(0.6, Math.min(1.5, globalScale ** 0.85));
}

function _rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#6478b4";
  const r = Math.max(0, Math.min(255, parseInt(match[0], 10)));
  const g = Math.max(0, Math.min(255, parseInt(match[1], 10)));
  const b = Math.max(0, Math.min(255, parseInt(match[2], 10)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/40 border-b">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-foreground text-sm"
      >
        <HugeiconsIcon
          icon={open ? ArrowDown01Icon : ArrowRight01Icon}
          className="size-3 text-muted-foreground/50"
        />
        {title}
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between gap-3 text-[13px] text-foreground">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground/80">
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onChange}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px] text-foreground">
      <span className="text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function GraphTab({ files, onOpenFilePath }: GraphTabProps) {
  const [panel, setPanel] = React.useState<PanelState>(DEFAULT_PANEL);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rawNodes, setRawNodes] = React.useState<GraphNode[]>([]);
  const [rawLinks, setRawLinks] = React.useState<GraphLink[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [palette, setPalette] = React.useState(createPalette);
  const [paneOpen, setPaneOpen] = React.useState(true);
  const [sections, setSections] = React.useState({
    filters: false,
    groups: false,
    display: true,
    forces: true,
  });
  const [graphSize, setGraphSize] = React.useState({ width: 800, height: 600 });
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

interface ForceGraphInstance {
  zoom: (scale: number, duration?: number) => void;
  panBy: (x: number, y: number, duration?: number) => void;
  zoomToFit: (duration?: number, padding?: number) => void;
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
}

  const graphRef = React.useRef<ForceGraphInstance | null>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const prevVisibleIds = React.useRef<Set<string>>(new Set());
  const hoverStrengthsRef = React.useRef<Map<string, number>>(new Map());
  const hoverAnimationFrameRef = React.useRef<number | null>(null);
  const focusStrengthRef = React.useRef<number>(0);
  const [isHoverAnimating, setIsHoverAnimating] = React.useState(false);

  const markdownFiles = React.useMemo(
    () => flattenMarkdownFiles(files),
    [files],
  );

  React.useEffect(() => {
    return () => {
      if (hoverAnimationFrameRef.current !== null) {
        cancelAnimationFrame(hoverAnimationFrameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const refresh = () => setPalette(createPalette());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(([entry]) => {
      setGraphSize({
        width: Math.max(240, Math.floor(entry.contentRect.width)),
        height: Math.max(240, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(viewport);

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        return;
      }

      if (!graphRef.current) return;

      const isShift = event.shiftKey;
      const speed = isShift ? 120 : 30;
      const zoomSpeed = isShift ? 0.3 : 0.1;

      switch (event.key) {
        case "+":
        case "=":
          event.preventDefault();
          graphRef.current.zoom(graphRef.current.zoom() * (1 + zoomSpeed), 400);
          break;
        case "-":
          event.preventDefault();
          graphRef.current.zoom(graphRef.current.zoom() * (1 - zoomSpeed), 400);
          break;
        case "ArrowUp":
          event.preventDefault();
          graphRef.current.panBy(0, -speed);
          break;
        case "ArrowDown":
          event.preventDefault();
          graphRef.current.panBy(0, speed);
          break;
        case "ArrowLeft":
          event.preventDefault();
          graphRef.current.panBy(-speed, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          graphRef.current.panBy(speed, 0);
          break;
        case "0":
          if (isShift || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            graphRef.current.zoomToFit(350, 44);
          }
          break;
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleClickOutside = () => {
      setContextMenu(null);
    };

    const viewport = viewportRef.current;
    viewport?.addEventListener("keydown", handleKeyDown);
    viewport?.addEventListener("contextmenu", handleContextMenu);
    viewport?.addEventListener("click", handleClickOutside);

    return () => {
      viewport?.removeEventListener("keydown", handleKeyDown);
      viewport?.removeEventListener("contextmenu", handleContextMenu);
      viewport?.removeEventListener("click", handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function buildGraph() {
      setLoading(true);
      setError(null);

      try {
        const pathByNoExt = new Map<string, string>();
        const pathsByBasename = new Map<string, string[]>();

        for (const file of markdownFiles) {
          const noExt = removeMdExtension(file.relativePath).toLowerCase();
          pathByNoExt.set(noExt, file.relativePath);

          const basename = removeMdExtension(file.name).toLowerCase();
          const list = pathsByBasename.get(basename) || [];
          list.push(file.relativePath);
          pathsByBasename.set(basename, list);
        }

        const nodeMap = new Map<string, GraphNode>();
        const edgeSet = new Set<string>();

        for (const file of markdownFiles) {
          const { content, lastModified } = await readFile(
            file.handle as FileSystemFileHandle,
          );

          // Extract tags
          const tags = extractTags(content);

          if (!nodeMap.has(file.relativePath)) {
            nodeMap.set(file.relativePath, {
              id: file.relativePath,
              label: removeMdExtension(file.name),
              path: file.relativePath,
              tags,
              ghost: false,
              degree: 0,
              lastModified,
            });
          } else {
            // biome-ignore lint/style/noNonNullAssertion: node exists in map
            const existing = nodeMap.get(file.relativePath)!;
            existing.lastModified = lastModified;
            existing.tags = tags;
          }

          const addEdge = (targetPath: string | null, rawLabel: string) => {
            if (!targetPath) {
              if (!panel.showGhostNotes) return;
              const ghostLabel = removeMdExtension(rawLabel.trim());
              if (!ghostLabel) return;
              const ghostId = `ghost:${ghostLabel.toLowerCase()}`;
              if (!nodeMap.has(ghostId)) {
                nodeMap.set(ghostId, {
                  id: ghostId,
                  label: ghostLabel,
                  ghost: true,
                  tags: [],
                  degree: 0,
                  lastModified, // Use current note's time for the ghost
                });
              } else {
                // Keep earliest creation time for the ghost
                // biome-ignore lint/style/noNonNullAssertion: node exists in map
                const existing = nodeMap.get(ghostId)!;
                if (lastModified < existing.lastModified) {
                  existing.lastModified = lastModified;
                }
              }
              targetPath = ghostId;
            }

            if (!targetPath || targetPath === file.relativePath) return;
            const [a, b] =
              file.relativePath < targetPath
                ? [file.relativePath, targetPath]
                : [targetPath, file.relativePath];
            edgeSet.add(`${a}||${b}`);
          };

          INTERNAL_LINK_RE.lastIndex = 0;
          let internalMatch = INTERNAL_LINK_RE.exec(content);
          while (internalMatch !== null) {
            const parsed = parseInternalLinkBody(internalMatch[1]);
            const rawTarget = parsed
              ? stripInternalLinkAnchor(parsed.target)
              : "";
            if (!rawTarget) {
              internalMatch = INTERNAL_LINK_RE.exec(content);
              continue;
            }
            const resolved = resolveInternalLink(
              rawTarget,
              file.relativePath,
              pathByNoExt,
              pathsByBasename,
            );
            addEdge(resolved, rawTarget);
            internalMatch = INTERNAL_LINK_RE.exec(content);
          }

          MD_LINK_RE.lastIndex = 0;
          let mdMatch = MD_LINK_RE.exec(content);
          while (mdMatch !== null) {
            const raw = mdMatch[1].trim();
            const resolved = resolveMarkdownLink(
              raw,
              file.relativePath,
              pathByNoExt,
            );
            addEdge(resolved, raw);
            mdMatch = MD_LINK_RE.exec(content);
          }
        }

        const builtLinks: GraphLink[] = [];
        for (const edgeKey of edgeSet) {
          const [source, target] = edgeKey.split("||");
          builtLinks.push({ source, target });
          const sourceNode = nodeMap.get(source);
          const targetNode = nodeMap.get(target);
          if (sourceNode) sourceNode.degree += 1;
          if (targetNode) targetNode.degree += 1;
        }

        if (!cancelled) {
          setRawNodes([...nodeMap.values()]);
          setRawLinks(builtLinks);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to build graph view.");
          console.error("Failed to build graph", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void buildGraph();
    return () => {
      cancelled = true;
    };
  }, [markdownFiles, panel.showGhostNotes]);

  const sortedNodes = React.useMemo(() => {
    return [...rawNodes].sort((a, b) => {
      if (a.lastModified !== b.lastModified) {
        return a.lastModified - b.lastModified;
      }
      return a.id.localeCompare(b.id);
    });
  }, [rawNodes]);

  const filtered = React.useMemo(() => {
    const query = panel.search.trim();

    let visibleByTime = rawNodes;
    if (panel.isAnimating && sortedNodes.length > 0) {
      const count = Math.max(
        1,
        Math.floor(sortedNodes.length * panel.animationProgress),
      );
      const visibleSet = new Set(sortedNodes.slice(0, count).map((n) => n.id));
      visibleByTime = rawNodes.filter((n) => visibleSet.has(n.id));
    }

    const visibleNodes = visibleByTime.filter((node) => {
      if (panel.showExistingOnly && node.ghost) return false;
      if (!panel.showOrphans && node.degree === 0) return false;
      if (node.degree < panel.minLinks) return false;
      if (!query) return true;
      return matchQuery(query, node);
    });

    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const visibleLinks = rawLinks.filter((link) => {
      const s = typeof link.source === "string" ? link.source : link.source.id;
      const t = typeof link.target === "string" ? link.target : link.target.id;
      return visibleIds.has(s) && visibleIds.has(t);
    });

    return { nodes: visibleNodes, links: visibleLinks };
  }, [
    rawNodes,
    rawLinks,
    sortedNodes,
    panel.minLinks,
    panel.search,
    panel.showOrphans,
    panel.showExistingOnly,
    panel.isAnimating,
    panel.animationProgress,
  ]);

  React.useEffect(() => {
    if (!panel.isAnimating) {
      prevVisibleIds.current = new Set(filtered.nodes.map((n) => n.id));
      return;
    }

    const currentVisibleIds = new Set(filtered.nodes.map((n) => n.id));
    const newlyVisible = filtered.nodes.filter(
      (n) => !prevVisibleIds.current.has(n.id),
    );

    if (newlyVisible.length > 0) {
      for (const node of newlyVisible) {
        const neighborLink = rawLinks.find((l) => {
          const s = typeof l.source === "string" ? l.source : l.source.id;
          const t = typeof l.target === "string" ? l.target : l.target.id;
          return (
            (s === node.id && prevVisibleIds.current.has(t)) ||
            (t === node.id && prevVisibleIds.current.has(s))
          );
        });

        if (neighborLink) {
          const neighborId =
            (typeof neighborLink.source === "string"
              ? neighborLink.source
              : neighborLink.source.id) === node.id
              ? typeof neighborLink.target === "string"
                ? neighborLink.target
                : neighborLink.target.id
              : typeof neighborLink.source === "string"
                ? neighborLink.source
                : neighborLink.source.id;

          const neighbor = rawNodes.find((n) => n.id === neighborId);
          if (neighbor && neighbor.x !== undefined) {
            node.x = neighbor.x;
            node.y = neighbor.y;
          }
        }
      }
      graphRef.current?.d3ReheatSimulation();
    }

    prevVisibleIds.current = currentVisibleIds;
  }, [filtered.nodes, panel.isAnimating, rawLinks, rawNodes]);

  const graphData = React.useMemo(
    () => ({ nodes: filtered.nodes, links: filtered.links }),
    [filtered.nodes, filtered.links],
  );

  React.useEffect(() => {
    const visibleIds = new Set(filtered.nodes.map((node) => node.id));
    const hoverStrengths = hoverStrengthsRef.current;
    for (const nodeId of [...hoverStrengths.keys()]) {
      if (!visibleIds.has(nodeId)) {
        hoverStrengths.delete(nodeId);
      }
    }

    if (hoveredNodeId && !visibleIds.has(hoveredNodeId)) {
      setHoveredNodeId(null);
    }
  }, [filtered.nodes, hoveredNodeId]);

  React.useEffect(() => {
    if (hoverAnimationFrameRef.current !== null) {
      cancelAnimationFrame(hoverAnimationFrameRef.current);
    }

    const hoverStrengths = hoverStrengthsRef.current;
    if (!hoveredNodeId && hoverStrengths.size === 0) {
      if (focusStrengthRef.current > 0) {
        setIsHoverAnimating(true);
      } else {
        setIsHoverAnimating(false);
      }
      return;
    }

    if (hoveredNodeId) {
      hoverStrengths.set(hoveredNodeId, hoverStrengths.get(hoveredNodeId) ?? 0);
    }

    setIsHoverAnimating(true);

    const animateHover = () => {
      const animatedIds = new Set(hoverStrengths.keys());
      if (hoveredNodeId) {
        animatedIds.add(hoveredNodeId);
      }

      let hasActiveAnimation = false;

      const targetFocus = hoveredNodeId ? 1 : 0;
      const currentFocus = focusStrengthRef.current;
      const nextFocus = currentFocus + (targetFocus - currentFocus) * 0.18;
      if (Math.abs(nextFocus - targetFocus) < 0.01) {
        focusStrengthRef.current = targetFocus;
      } else {
        focusStrengthRef.current = nextFocus;
        hasActiveAnimation = true;
      }

      for (const nodeId of animatedIds) {
        const current = hoverStrengths.get(nodeId) ?? 0;
        const target = nodeId === hoveredNodeId ? 1 : 0;
        const next = current + (target - current) * 0.22;

        if (Math.abs(next - target) < 0.015) {
          if (target === 0) {
            hoverStrengths.delete(nodeId);
          } else {
            hoverStrengths.set(nodeId, 1);
          }
          continue;
        }

        hoverStrengths.set(nodeId, next);
        hasActiveAnimation = true;
      }

      if (
        hasActiveAnimation ||
        Math.abs(focusStrengthRef.current - targetFocus) >= 0.01
      ) {
        hoverAnimationFrameRef.current = requestAnimationFrame(animateHover);
        return;
      }

      hoverAnimationFrameRef.current = null;
      setIsHoverAnimating(false);
    };

    hoverAnimationFrameRef.current = requestAnimationFrame(animateHover);

    return () => {
      if (hoverAnimationFrameRef.current !== null) {
        cancelAnimationFrame(hoverAnimationFrameRef.current);
        hoverAnimationFrameRef.current = null;
      }
    };
  }, [hoveredNodeId]);

  React.useEffect(() => {
    if (!panel.isAnimating) return;

    let start: number | null = null;
    const duration = 5000;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);

      setPanel((prev) => ({
        ...prev,
        animationProgress: progress,
        // If we reached the end, we can stop the animation state
        isAnimating: progress < 1,
      }));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    const rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [panel.isAnimating]);

  React.useEffect(() => {
    if (!graphRef.current) return;
    const charge = graphRef.current.d3Force("charge");
    if (charge?.strength) {
      charge.strength(-panel.repelForce);
    }

    const link = graphRef.current.d3Force("link");
    if (link?.distance && link?.strength) {
      link.distance(panel.linkDistance);
      link.strength(panel.linkForce);
    }

    graphRef.current.d3Force("x", forceX(0).strength(panel.centerForce));
    graphRef.current.d3Force("y", forceY(0).strength(panel.centerForce));
    graphRef.current.d3ReheatSimulation();
  }, [
    panel.centerForce,
    panel.linkDistance,
    panel.linkForce,
    panel.repelForce,
  ]);

  React.useEffect(() => {
    if (!graphRef.current || filtered.nodes.length === 0) return;
    const timeoutId = window.setTimeout(() => {
      graphRef.current.zoomToFit(450, 56);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filtered.nodes.length]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-muted-foreground text-sm">
          {filtered.nodes.length} notes, {filtered.links.length} links
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaneOpen((prev) => !prev)}
            className="h-7 text-xs"
          >
            {paneOpen ? "Hide Controls" : "Show Controls"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => graphRef.current?.zoomToFit(350, 44)}
            className="h-7 text-xs"
          >
            Reset View
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden overscroll-contain">
        <div
          ref={viewportRef}
          className="absolute inset-0 z-0 touch-none outline-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${withAlpha(palette.muted, 0.25)} 1px, transparent 0)`,
            backgroundSize: "20px 20px",
          }}
        >
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center text-muted-foreground text-sm">
              Building graph...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center text-destructive text-sm">
              {error}
            </div>
          )}

          <Suspense
            fallback={
              <div className="absolute inset-0 z-30 flex items-center justify-center text-muted-foreground text-sm">
                Loading graph...
              </div>
            }
          >
            <ForceGraph2D
              ref={graphRef}
              width={graphSize.width}
              height={graphSize.height}
              graphData={graphData}
              autoPauseRedraw={!isHoverAnimating}
              backgroundColor="transparent"
              nodeRelSize={10}
              d3AlphaMin={0}
              d3AlphaTarget={0.01}
              linkDirectionalArrowLength={
                panel.showArrows ? 9 * panel.linkThickness : 0
              }
              linkDirectionalArrowRelPos={1}
              linkDirectionalArrowColor={(link: GraphLink) => {
                const sourceId =
                  typeof link.source === "object"
                    ? (link.source as GraphNode).id
                    : link.source;
                const targetId =
                  typeof link.target === "object"
                    ? (link.target as GraphNode).id
                    : link.target;
                const hoverStrength = Math.max(
                  hoverStrengthsRef.current.get(sourceId) ?? 0,
                  hoverStrengthsRef.current.get(targetId) ?? 0,
                );
                const baseColor = withAlpha(
                  palette.link,
                  mix(0.7, 0.35, focusStrengthRef.current),
                );
                return mixColors(
                  baseColor,
                  withAlpha(palette.primary, 0.92),
                  hoverStrength,
                );
              }}
              linkWidth={(link: GraphLink) => {
                const sourceId =
                  typeof link.source === "object"
                    ? (link.source as GraphNode).id
                    : link.source;
                const targetId =
                  typeof link.target === "object"
                    ? (link.target as GraphNode).id
                    : link.target;
                const base = panel.linkThickness * 0.9;
                const hoverStrength = Math.max(
                  hoverStrengthsRef.current.get(sourceId) ?? 0,
                  hoverStrengthsRef.current.get(targetId) ?? 0,
                );
                const inactiveMultiplier = mix(
                  1,
                  0.45,
                  focusStrengthRef.current,
                );
                return base * mix(inactiveMultiplier, 1.8, hoverStrength);
              }}
              linkColor={(link: GraphLink) => {
                const sourceId =
                  typeof link.source === "object"
                    ? (link.source as GraphNode).id
                    : link.source;
                const targetId =
                  typeof link.target === "object"
                    ? (link.target as GraphNode).id
                    : link.target;
                const hoverStrength = Math.max(
                  hoverStrengthsRef.current.get(sourceId) ?? 0,
                  hoverStrengthsRef.current.get(targetId) ?? 0,
                );
                const baseColor = withAlpha(
                  palette.link,
                  mix(0.7, 0.35, focusStrengthRef.current),
                );
                return mixColors(
                  baseColor,
                  withAlpha(palette.chart1, 0.4),
                  hoverStrength,
                );
              }}
              nodeCanvasObject={(
                node: GraphNode,
                ctx: CanvasRenderingContext2D,
                globalScale: number,
              ) => {
                const data = node;
                const isHovered = hoveredNodeId === data.id;
                const hoverStrength =
                  hoverStrengthsRef.current.get(data.id) ?? 0;
                const focusStrength = focusStrengthRef.current;
                const radius =
                  (data.ghost
                    ? 2.8
                    : Math.min(10, 3.6 + Math.sqrt(Math.max(1, data.degree)))) *
                  panel.nodeSize;

                const matchedGroup = panel.groups.find((g) => {
                  const q = g.query.trim();
                  return q && matchQuery(q, data);
                });
                const baseNodeColor = matchedGroup
                  ? mixColors(palette.muted, matchedGroup.color, 0.35)
                  : palette.muted;
                const drawRadius = radius + 1.4 * hoverStrength;

                ctx.beginPath();
                ctx.arc(node.x, node.y, drawRadius, 0, 2 * Math.PI, false);
                ctx.fillStyle = mixColors(
                  baseNodeColor,
                  palette.primary,
                  hoverStrength,
                );
                ctx.globalAlpha = data.ghost
                  ? mix(mix(0.42, 0.18, focusStrength), 0.72, hoverStrength)
                  : mix(mix(0.82, 0.48, focusStrength), 0.98, hoverStrength);
                ctx.fill();
                ctx.globalAlpha = 1;

                ctx.lineWidth = mix(1.05, 1.8, hoverStrength);
                ctx.strokeStyle = mixColors(
                  withAlpha(palette.background, mix(0.92, 0.65, focusStrength)),
                  withAlpha(palette.ring, 1),
                  hoverStrength,
                );
                ctx.stroke();

                const zoomFade = smoothstep(
                  panel.textFadeThreshold * 0.74,
                  panel.textFadeThreshold * 1.08,
                  globalScale,
                );
                const labelFade =
                  data.degree >= 2
                    ? Math.max(zoomFade, hoverStrength * 0.9)
                    : hoverStrength;
                if (labelFade > 0.02) {
                  const fontSize =
                    (12 / globalScale) * getLabelZoomScale(globalScale);
                  const labelOffset =
                    5 / globalScale + (3 / globalScale) * hoverStrength;
                  const labelColor = isHovered
                    ? palette.foreground
                    : mixColors(
                        withAlpha(
                          palette.foreground,
                          mix(0.86, 0.58, focusStrength),
                        ),
                        withAlpha(palette.primary, 0.96),
                        hoverStrength * 0.7,
                      );

                  ctx.save();
                  ctx.font = `${fontSize}px sans-serif`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillStyle = labelColor;
                  ctx.globalAlpha = isHovered
                    ? 1
                    : Math.min(
                        0.98,
                        labelFade *
                          (data.ghost
                            ? mix(
                                mix(0.58, 0.4, focusStrength),
                                0.86,
                                hoverStrength,
                              )
                            : mix(
                                mix(0.88, 0.52, focusStrength),
                                0.98,
                                hoverStrength,
                              )),
                      );
                  ctx.fillText(
                    data.label,
                    node.x,
                    node.y + drawRadius + labelOffset,
                  );
                  ctx.restore();
                }
              }}
              onNodeHover={(node: GraphNode | null) =>
                setHoveredNodeId(node?.id ?? null)
              }
              onNodeClick={(node: GraphNode) => {
                const data = node;
                if (data.path) onOpenFilePath(data.path);
              }}
              onNodeRightClick={(node: GraphNode, event: MouseEvent) => {
                event.preventDefault();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  nodeId: node?.id ?? null,
                });
              }}
            />
          </Suspense>
        </div>

        {contextMenu && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          // biome-ignore lint/a11y/useKeyWithClickEvents: context menu needs keyboard handler
          // biome-ignore lint/a11y/noStaticElementInteractions: context menu needs semantic role
          <div
            className="fixed z-50 min-w-40 rounded-lg border shadow-xl"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: withAlpha(palette.card, 0.95),
              borderColor: palette.border,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const node = filtered.nodes.find(
                (n) => n.id === contextMenu.nodeId,
              );
              if (!node) return null;
              return (
                <>
                  <div
                    className="border-b px-3 py-2 font-medium text-sm"
                    style={{
                      borderColor: palette.border,
                      color: palette.foreground,
                    }}
                  >
                    {node.label}
                  </div>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    style={{ color: palette.foreground }}
                    onClick={() => {
                      if (node.path) onOpenFilePath(node.path);
                      setContextMenu(null);
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    style={{ color: palette.foreground }}
                    onClick={() => {
                      setPanel((prev) => ({
                        ...prev,
                        search: node.label,
                      }));
                      setContextMenu(null);
                    }}
                  >
                    Focus in graph
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {paneOpen && (
          <aside
            className="absolute top-4 left-4 z-20 max-h-[calc(100%-2rem)] w-72 overflow-y-auto rounded-xl border shadow-xl"
            style={{
              background: withAlpha(palette.card, 0.92),
              borderColor: withAlpha(palette.border, 0.8),
              backdropFilter: "blur(6px)",
            }}
          >
            <div className="flex items-center justify-between border-border/40 border-b px-3 py-2">
              <div className="font-semibold text-foreground text-sm">
                Graph Controls
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Reset settings"
                  onClick={() => setPanel(DEFAULT_PANEL)}
                  className="size-7"
                >
                  <HugeiconsIcon icon={RotateIcon} className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Close panel"
                  onClick={() => setPaneOpen(false)}
                  className="size-7"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </Button>
              </div>
            </div>

            <Section
              title="Filters"
              open={sections.filters}
              onToggle={() =>
                setSections((prev) => ({ ...prev, filters: !prev.filters }))
              }
            >
              <ToggleRow
                label="Show ghost notes"
                checked={panel.showGhostNotes}
                onChange={(checked) =>
                  setPanel((prev) => ({ ...prev, showGhostNotes: checked }))
                }
              />
              <ToggleRow
                label="Show orphans"
                checked={panel.showOrphans}
                onChange={(checked) =>
                  setPanel((prev) => ({ ...prev, showOrphans: checked }))
                }
              />
              <ToggleRow
                label="Existing files only"
                checked={panel.showExistingOnly}
                onChange={(checked) =>
                  setPanel((prev) => ({ ...prev, showExistingOnly: checked }))
                }
              />
              <SliderRow
                label="Minimum links"
                value={panel.minLinks}
                min={0}
                max={12}
                step={1}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, minLinks: value }))
                }
              />
              <div className="space-y-1.5 text-[13px]">
                <div className="text-muted-foreground">Search notes</div>
                <Input
                  type="text"
                  value={panel.search}
                  onChange={(event) =>
                    setPanel((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Filter by note name..."
                  className="h-8 bg-background/50 text-xs focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
            </Section>

            <Section
              title="Groups"
              open={sections.groups}
              onToggle={() =>
                setSections((prev) => ({ ...prev, groups: !prev.groups }))
              }
            >
              <div className="space-y-4">
                {panel.groups.map((group, index) => (
                  <div
                    key={group.label || `group-${index}`}
                    className="space-y-2 rounded-md border border-border/40 bg-background/30 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative size-4 shrink-0 overflow-hidden rounded-full border border-border/60">
                        <input
                          type="color"
                          value={group.color}
                          onChange={(e) => {
                            const next = [...panel.groups];
                            next[index] = { ...group, color: e.target.value };
                            setPanel((prev) => ({ ...prev, groups: next }));
                          }}
                          className="absolute -inset-1 size-8 cursor-pointer border-none bg-transparent p-0"
                        />
                      </div>
                      <Input
                        type="text"
                        value={group.query}
                        onChange={(e) => {
                          const next = [...panel.groups];
                          next[index] = { ...group, query: e.target.value };
                          setPanel((prev) => ({ ...prev, groups: next }));
                        }}
                        placeholder="Search query..."
                        className="h-7 flex-1 bg-background/50 text-[11px] focus-visible:ring-1 focus-visible:ring-primary/50"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = panel.groups.filter(
                            (_, i) => i !== index,
                          );
                          setPanel((prev) => ({ ...prev, groups: next }));
                        }}
                        className="size-7 text-muted-foreground/50 hover:text-destructive"
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          className="size-3.5"
                        />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPanel((prev) => ({
                      ...prev,
                      groups: [
                        ...prev.groups,
                        { query: "", color: palette.chart1 },
                      ],
                    }));
                  }}
                  className="h-8 w-full text-xs"
                >
                  New group
                </Button>
              </div>
            </Section>

            <Section
              title="Display"
              open={sections.display}
              onToggle={() =>
                setSections((prev) => ({ ...prev, display: !prev.display }))
              }
            >
              <ToggleRow
                label="Arrows"
                checked={panel.showArrows}
                onChange={(checked) =>
                  setPanel((prev) => ({ ...prev, showArrows: checked }))
                }
              />
              <SliderRow
                label="Text fade threshold"
                value={panel.textFadeThreshold}
                min={0.35}
                max={2}
                step={0.05}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, textFadeThreshold: value }))
                }
              />
              <SliderRow
                label="Node size"
                value={panel.nodeSize}
                min={0.5}
                max={5}
                step={0.05}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, nodeSize: value }))
                }
              />
              <SliderRow
                label="Link thickness"
                value={panel.linkThickness}
                min={0.35}
                max={3}
                step={0.05}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, linkThickness: value }))
                }
              />
              <Button
                size="sm"
                onClick={() =>
                  setPanel((prev) => ({
                    ...prev,
                    isAnimating: !prev.isAnimating,
                    animationProgress: prev.isAnimating
                      ? prev.animationProgress
                      : 0,
                  }))
                }
                className="h-8 w-full text-xs"
              >
                {panel.isAnimating ? "Playing..." : "Animate"}
              </Button>
            </Section>

            <Section
              title="Forces"
              open={sections.forces}
              onToggle={() =>
                setSections((prev) => ({ ...prev, forces: !prev.forces }))
              }
            >
              <SliderRow
                label="Center force"
                value={panel.centerForce}
                min={0}
                max={0.25}
                step={0.01}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, centerForce: value }))
                }
              />
              <SliderRow
                label="Repel force"
                value={panel.repelForce}
                min={20}
                max={500}
                step={1}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, repelForce: value }))
                }
              />
              <SliderRow
                label="Link force"
                value={panel.linkForce}
                min={0}
                max={2}
                step={0.01}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, linkForce: value }))
                }
              />
              <SliderRow
                label="Link distance"
                value={panel.linkDistance}
                min={20}
                max={260}
                step={1}
                onChange={(value) =>
                  setPanel((prev) => ({ ...prev, linkDistance: value }))
                }
              />
            </Section>
          </aside>
        )}
      </div>
    </div>
  );
}
