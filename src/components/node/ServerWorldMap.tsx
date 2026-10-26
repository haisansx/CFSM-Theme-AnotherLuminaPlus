import { useState, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";
import worldMapSvg from "./world-map.svg";
import { codeMaps, countryCodeMapping } from "./code-maps";

export interface ServerWorldMapProps {
  nodes: HomeNodeSummary[];
  nameByUuid?: Map<string, string>;
  className?: string;
}

type LabelPosition = "top" | "bottom" | "left" | "right";

interface MapLocation {
  key: string;
  name: string;
  x: number;
  y: number;
  pos: LabelPosition;
  servers: { node: HomeNodeSummary; displayName: string }[];
  onlineCount: number;
}

// Precise dot coordinates mapped directly to world-map.svg (viewBox 0 0 201 97, canvas 1280x621)
// Calibrated directly against authentic dot centers in world-map.svg
const CITY_KEYWORDS: [string[], string, number, number, string, LabelPosition][] = [
  // West Coast USA (Pacific Coast dots: Oregon cx=15/cy=27, San Jose cx=15/cy=30, LA cx=16/cy=33, Seattle cx=16/cy=25)
  [["oregon", "俄勒冈", "pdx"], "PDX", 96, 173, "俄勒冈", "top"],
  [["san jose", "sanjose", "圣何塞"], "SJC", 96, 192, "圣何塞", "left"],
  [["los angeles", "la", "洛杉矶"], "LAX", 102, 211, "洛杉矶", "bottom"],
  [["seattle", "西雅图", "sea"], "SEA", 102, 160, "西雅图", "top"],

  // Central & East USA
  [["chicago", "芝加哥"], "ORD", 220, 175, "芝加哥", "top"],
  [["new york", "nyc", "纽约"], "NYC", 280, 179, "纽约", "right"],
  [["miami", "迈阿密"], "MIA", 237, 249, "迈阿密", "bottom"],
  [["dallas", "达拉斯"], "DFW", 172, 211, "达拉斯", "bottom"],

  // Europe (London cx=99/cy=21, Paris cx=101/cy=25, Frankfurt cx=105/cy=25, Nürnberg cx=106/cy=27)
  [["london", "伦敦"], "LON", 630, 134, "伦敦", "top"],
  [["paris", "巴黎"], "CDG", 643, 160, "巴黎", "left"],
  [["frankfurt", "法兰克福", "euserv"], "FRA", 669, 160, "法兰克福", "top"],
  [["nürnberg", "nurnberg", "纽伦堡", "netcup"], "NUE", 675, 173, "纽伦堡", "bottom"],
  [["amsterdam", "阿姆斯特丹"], "AMS", 650, 148, "阿姆斯特丹", "top"],

  // South America (São Paulo cx=62/cy=72)
  [["sao paulo", "saopaulo", "são paulo", "圣保罗", "brazil", "brasil"], "GRU", 395, 461, "圣保罗", "bottom"],

  // Asia & Oceania (Tokyo cx=173/cy=32, HK cx=161/cy=41, Singapore cx=157/cy=54, Sydney cx=185/cy=79)
  [["tokyo", "东京"], "TYO", 1102, 205, "东京", "right"],
  [["osaka", "大阪"], "OSA", 1092, 214, "大阪", "left"],
  [["hongkong", "hong kong", "香港", "hk", "hytron"], "HKG", 1025, 262, "香港", "bottom"],
  [["taiwan", "taipei", "台湾", "台北"], "TPE", 1045, 252, "台北", "right"],
  [["singapore", "新加坡", "sg"], "SIN", 1000, 346, "新加坡", "bottom"],
  [["seoul", "首尔", "kr"], "SEL", 1070, 198, "首尔", "top"],
  [["beijing", "北京"], "PEK", 1015, 178, "北京", "top"],
  [["shanghai", "上海"], "PVG", 1045, 225, "上海", "right"],
  [["sydney", "悉尼"], "SYD", 1178, 506, "悉尼", "bottom"]
];

function resolveServerLocation(
  node: HomeNodeSummary,
  displayName: string
): { code: string; name: string; x: number; y: number; pos: LabelPosition } {
  const nameLower = (displayName || "").toLowerCase();
  const regUpper = (node.region || "US").toUpperCase();

  // 1. Check city keywords first
  for (const [keywords, code, x, y, cname, pos] of CITY_KEYWORDS) {
    if (keywords.some((k) => nameLower.includes(k))) {
      return { code, name: cname, x, y, pos };
    }
  }

  // 2. Check codeMaps by region
  const code = countryCodeMapping[regUpper as keyof typeof countryCodeMapping] || regUpper;
  const mapped = (codeMaps as Record<string, { x?: number; y?: number; lon: number; lat: number; name: string }>)[code];

  if (mapped && mapped.x && mapped.y) {
    return {
      code,
      name: mapped.name || regUpper,
      x: mapped.x,
      y: mapped.y,
      pos: "bottom"
    };
  }

  if (mapped) {
    const x = Math.round(((mapped.lon + 180) / 360) * 1280);
    const y = Math.round(((90 - mapped.lat) / 180) * 621);
    return {
      code,
      name: mapped.name || regUpper,
      x,
      y,
      pos: "bottom"
    };
  }

  // 3. Fallback coordinate (US West Coast on Pacific dot)
  return {
    code: "US",
    name: "美国",
    x: 102,
    y: 211,
    pos: "bottom"
  };
}

export function ServerWorldMap({ nodes, nameByUuid, className = "" }: ServerWorldMapProps) {
  const [activeTooltipKey, setActiveTooltipKey] = useState<string | null>(null);

  // Group servers by location
  const locations = useMemo(() => {
    const map = new Map<string, MapLocation>();

    nodes.forEach((node) => {
      const displayName = nameByUuid?.get(node.uuid) || node.region || "";
      const loc = resolveServerLocation(node, displayName);
      const existing = map.get(loc.code);

      if (existing) {
        existing.servers.push({ node, displayName });
        if (node.online) existing.onlineCount += 1;
      } else {
        map.set(loc.code, {
          key: loc.code,
          name: loc.name,
          x: loc.x,
          y: loc.y,
          pos: loc.pos,
          servers: [{ node, displayName }],
          onlineCount: node.online ? 1 : 0
        });
      }
    });

    return Array.from(map.values());
  }, [nodes, nameByUuid]);

  const totalOnline = useMemo(() => nodes.filter((n) => n.online).length, [nodes]);

  // Directional offsets for tag badges
  const getBadgeStyle = (pos: LabelPosition) => {
    switch (pos) {
      case "top":
        return {
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "7px"
        };
      case "left":
        return {
          right: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginRight: "8px"
        };
      case "right":
        return {
          left: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginLeft: "8px"
        };
      case "bottom":
      default:
        return {
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "7px"
        };
    }
  };

  return (
    <div
      className={`server-world-map-card relative overflow-hidden select-none flex flex-col justify-between w-full h-full ${className}`}
      style={{
        background: "radial-gradient(circle at 50% 120%, rgba(14, 165, 233, 0.15) 0%, rgba(8, 15, 30, 0.98) 75%)",
        border: "1px solid rgba(255, 255, 255, 0.09)",
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.75)"
      }}
      onClick={() => setActiveTooltipKey(null)}
    >
      {/* Top Header - Enclosing full width */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] shadow-[0_0_8px_#facc15]" />
          <span className="text-[14px] font-bold text-white tracking-wide uppercase">
            全球节点分布 ({nodes.length}台)
          </span>
        </div>
        <div className="text-[12.5px] font-mono text-white/60">
          已覆盖 {locations.length} 个地区 · {totalOnline} 在线
        </div>
      </div>

      {/* Main Map Container:
          - Vertically fills the entire available height of the red box!
          - Horizontally maintains the natural 1280:621 aspect ratio without stretching!
          - Sides naturally leave space filled with card background!
      */}
      <div
        className="relative w-full flex-1 flex items-center justify-center p-3 overflow-hidden min-h-0"
      >
        <div
          className="relative max-w-full max-h-full"
          style={{
            aspectRatio: "1280 / 621",
            height: "100%",
            width: "auto"
          }}
        >
          {/* SVG Dotted Matrix World Map Background: Unstretched, natural aspect ratio */}
          <img
            src={worldMapSvg}
            alt="World Map"
            className="w-full h-full object-contain pointer-events-none opacity-85 select-none"
            style={{
              filter: "drop-shadow(0 0 1px rgba(255,255,255,0.15))"
            }}
          />

          {/* Location Points & Badges: Bound strictly to 1280x621 proportions */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            {locations.map((loc) => {
              const leftPct = (loc.x / 1280) * 100;
              const topPct = (loc.y / 621) * 100;
              const isHovered = activeTooltipKey === loc.key;
              const badgePosStyle = getBadgeStyle(loc.pos);

              return (
                <div
                  key={loc.key}
                  className="absolute group z-10 pointer-events-auto"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: "translate(-50%, -50%)"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(isHovered ? null : loc.key);
                  }}
                  onMouseEnter={() => setActiveTooltipKey(loc.key)}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                >
                  {/* Yellow Target Point (nazhua concentric style) */}
                  <div className="relative flex items-center justify-center cursor-pointer">
                    {/* Outer pulse ripple */}
                    <span
                      className="absolute rounded-full border border-[#facc15] animate-ping pointer-events-none"
                      style={{
                        width: "18px",
                        height: "18px",
                        opacity: 0.65
                      }}
                    />
                    {/* Concentric outer ring */}
                    <span
                      className="absolute rounded-full border-[1.5px] border-[#facc15] pointer-events-none"
                      style={{
                        width: "13px",
                        height: "13px"
                      }}
                    />
                    {/* Core yellow dot */}
                    <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] shadow-[0_0_6px_#facc15]" />
                  </div>

                  {/* Black Tag Badge (+25% font size increase: 13.5px bold) */}
                  <div
                    className="absolute px-2.5 py-0.5 rounded text-[13.5px] font-semibold whitespace-nowrap pointer-events-none transition-transform group-hover:scale-105 z-20"
                    style={{
                      ...badgePosStyle,
                      background: "rgba(0, 0, 0, 0.88)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.22)",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.65)"
                    }}
                  >
                    {loc.name},{loc.servers.length}台
                  </div>

                  {/* Hover / Click Detail Popover */}
                  {isHovered && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3.5 py-2.5 rounded-lg text-sm z-50 whitespace-nowrap"
                      style={{
                        background: "rgba(9, 18, 36, 0.96)",
                        border: "1px solid rgba(250, 204, 21, 0.4)",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
                        color: "#e2e8f0"
                      }}
                    >
                      <div className="font-semibold text-[#facc15] mb-1.5 flex items-center gap-1.5 border-b border-white/10 pb-1">
                        <span>{loc.name}</span>
                        <span className="text-xs text-white/50">({loc.servers.length} 台设备)</span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                        {loc.servers.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                s.node.online ? "bg-[#34d399]" : "bg-[#ef4444]"
                              }`}
                            />
                            <span className="text-white/90">{s.displayName}</span>
                            <span className="text-white/40 text-[11px]">
                              {s.node.online ? "在线" : "离线"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep export alias for backwards compatibility
export const ServerGlobe = ServerWorldMap;
