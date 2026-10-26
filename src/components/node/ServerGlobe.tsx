import { useState, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";
import worldMapSvg from "./world-map.svg";
import { codeMaps, countryCodeMapping } from "./code-maps";

interface ServerWorldMapProps {
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

// Precise dot coordinates mapped directly to world-map.svg (1280x621)
const CITY_KEYWORDS: [string[], string, number, number, string, LabelPosition][] = [
  // West Coast USA (Strictly on real-world Pacific Coastline dots: Oregon north, San Jose mid, LA south)
  [["oregon", "俄勒冈", "pdx"], "PDX", 98, 170, "俄勒冈", "top"],
  [["san jose", "sanjose", "圣何塞"], "SJC", 92, 194, "圣何塞", "left"],
  [["los angeles", "la", "洛杉矶"], "LAX", 104, 212, "洛杉矶", "bottom"],
  [["seattle", "西雅图", "sea"], "SEA", 105, 158, "西雅图", "top"],
  // Central & East USA
  [["chicago", "芝加哥"], "ORD", 220, 175, "芝加哥", "top"],
  [["new york", "nyc", "纽约"], "NYC", 274, 182, "纽约", "right"],
  [["miami", "迈阿密"], "MIA", 286, 236, "迈阿密", "bottom"],
  [["dallas", "达拉斯"], "DFW", 196, 225, "达拉斯", "bottom"],
  // Europe
  [["london", "伦敦"], "LON", 635, 142, "伦敦", "top"],
  [["paris", "巴黎"], "CDG", 642, 155, "巴黎", "left"],
  [["frankfurt", "法兰克福", "euserv"], "FRA", 665, 160, "法兰克福", "top"],
  [["nürnberg", "nurnberg", "纽伦堡", "netcup"], "NUE", 670, 168, "纽伦堡", "bottom"],
  [["amsterdam", "阿姆斯特丹"], "AMS", 650, 148, "阿姆斯特丹", "top"],
  // South America
  [["sao paulo", "saopaulo", "são paulo", "圣保罗", "brazil", "brasil"], "GRU", 398, 460, "圣保罗", "bottom"],
  // Asia & Oceania
  [["tokyo", "东京"], "TYO", 1102, 208, "东京", "bottom"],
  [["osaka", "大阪"], "OSA", 1092, 214, "大阪", "left"],
  [["hongkong", "hong kong", "香港", "hk", "hytron"], "HKG", 1025, 260, "香港", "bottom"],
  [["taiwan", "taipei", "台湾", "台北"], "TPE", 1045, 252, "台北", "right"],
  [["singapore", "新加坡", "sg"], "SIN", 1005, 345, "新加坡", "bottom"],
  [["seoul", "首尔", "kr"], "SEL", 1070, 198, "首尔", "top"],
  [["beijing", "北京"], "PEK", 1015, 178, "北京", "top"],
  [["shanghai", "上海"], "PVG", 1045, 225, "上海", "right"],
  [["sydney", "悉尼"], "SYD", 1180, 505, "悉尼", "bottom"]
];

function resolveServerLocation(
  node: HomeNodeSummary,
  displayName: string
): { code: string; name: string; x: number; y: number; pos: LabelPosition } {
  const nameLower = (displayName || "").toLowerCase();
  const regUpper = (node.region || "US").toUpperCase();

  // 1. Check city keywords
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

  // 3. Fallback coordinate (US West Coast)
  return {
    code: "US",
    name: "美国",
    x: 104,
    y: 212,
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

  // Helper to get badge positioning style based on direction to prevent overlap
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
      className={`server-world-map-card relative overflow-hidden select-none flex flex-col justify-between ${className}`}
      style={{
        minHeight: "310px",
        height: "100%",
        background: "radial-gradient(circle at 50% 120%, rgba(14, 165, 233, 0.15) 0%, rgba(8, 15, 30, 0.98) 75%)",
        borderRadius: "22px",
        border: "1px solid rgba(255, 255, 255, 0.09)",
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.75)"
      }}
      onClick={() => setActiveTooltipKey(null)}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#facc15] shadow-[0_0_8px_#facc15]" />
          <span className="text-xs font-bold text-white tracking-wider uppercase">
            全球节点分布 ({nodes.length}台)
          </span>
        </div>
        <div className="text-[11px] font-mono text-white/50">
          已覆盖 {locations.length} 个地区 · {totalOnline} 在线
        </div>
      </div>

      {/* Main Map Canvas / Container */}
      <div className="relative w-full flex-1 flex items-center justify-center p-2 min-h-[220px]">
        {/* World Map Container (Aspect Ratio 1280:621) */}
        <div
          className="relative w-full"
          style={{
            maxWidth: "100%",
            aspectRatio: "1280 / 621"
          }}
        >
          {/* SVG Dotted Matrix World Map Background */}
          <img
            src={worldMapSvg}
            alt="World Map"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-85 select-none"
            style={{
              filter: "drop-shadow(0 0 1px rgba(255,255,255,0.15))"
            }}
          />

          {/* Location Points & Badges */}
          {locations.map((loc) => {
            const leftPct = (loc.x / 1280) * 100;
            const topPct = (loc.y / 621) * 100;
            const isHovered = activeTooltipKey === loc.key;
            const badgePosStyle = getBadgeStyle(loc.pos);

            return (
              <div
                key={loc.key}
                className="absolute group z-10"
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
                {/* Yellow Target Point (nazhua style) */}
                <div className="relative flex items-center justify-center cursor-pointer">
                  {/* Outer pulse ripple */}
                  <span
                    className="absolute rounded-full border border-[#facc15] animate-ping pointer-events-none"
                    style={{
                      width: "18px",
                      height: "18px",
                      opacity: 0.6
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
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#facc15] shadow-[0_0_6px_#facc15]"
                  />
                </div>

                {/* Black Tag Badge (nazhua style: '东京,1台') with smart positioning */}
                <div
                  className="absolute px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium whitespace-nowrap pointer-events-none transition-transform group-hover:scale-105 z-20"
                  style={{
                    ...badgePosStyle,
                    background: "rgba(0, 0, 0, 0.88)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.6)"
                  }}
                >
                  {loc.name},{loc.servers.length}台
                </div>

                {/* Hover / Click Detail Popover */}
                {isHovered && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-2 rounded-lg text-xs z-50 whitespace-nowrap"
                    style={{
                      background: "rgba(9, 18, 36, 0.96)",
                      border: "1px solid rgba(250, 204, 21, 0.4)",
                      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
                      color: "#e2e8f0"
                    }}
                  >
                    <div className="font-semibold text-[#facc15] mb-1 flex items-center gap-1.5 border-b border-white/10 pb-1">
                      <span>{loc.name}</span>
                      <span className="text-[10px] text-white/50">({loc.servers.length} 台设备)</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      {loc.servers.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.node.online ? "bg-[#34d399]" : "bg-[#ef4444]"
                            }`}
                          />
                          <span className="text-white/90">{s.displayName}</span>
                          <span className="text-white/40 text-[10px]">
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
  );
}

// Keep export alias for backwards compatibility with NodeGrid.tsx
export const ServerGlobe = ServerWorldMap;
