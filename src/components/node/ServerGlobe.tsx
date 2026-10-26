import { useState, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";
import worldMapSvg from "./world-map.svg";
import { codeMaps, countryCodeMapping } from "./code-maps";

interface ServerWorldMapProps {
  nodes: HomeNodeSummary[];
  nameByUuid?: Map<string, string>;
  className?: string;
}

interface MapLocation {
  key: string;
  name: string;
  x: number;
  y: number;
  servers: { node: HomeNodeSummary; displayName: string }[];
  onlineCount: number;
}

// City keyword overrides for Chinese and English names
const CITY_KEYWORDS: [string[], string, number, number, string][] = [
  // [keywords], code, x, y, chinese name
  [["san jose", "sanjose", "圣何塞"], "SJC", 220, 196, "圣何塞"],
  [["los angeles", "la", "洛杉矶"], "LAX", 233, 209, "洛杉矶"],
  [["oregon", "俄勒冈", "pdx"], "PDX", 224, 168, "俄勒冈"],
  [["seattle", "西雅图", "sea"], "SEA", 226, 153, "西雅图"],
  [["chicago", "芝加哥"], "ORD", 298, 175, "芝加哥"],
  [["new york", "nyc", "纽约"], "NYC", 336, 178, "纽约"],
  [["miami", "迈阿密"], "MIA", 322, 237, "迈阿密"],
  [["dallas", "达拉斯"], "DFW", 277, 212, "达拉斯"],
  [["nürnberg", "nurnberg", "纽伦堡", "netcup"], "NUE", 659, 168, "纽伦堡"],
  [["frankfurt", "法兰克福", "euserv"], "FRA", 651, 165, "法兰克福"],
  [["london", "伦敦"], "LON", 624, 151, "伦敦"],
  [["paris", "巴黎"], "CDG", 633, 164, "巴黎"],
  [["amsterdam", "阿姆斯特丹"], "AMS", 637, 153, "阿姆斯特丹"],
  [["sao paulo", "saopaulo", "são paulo", "圣保罗", "brazil", "brasil"], "GRU", 420, 470, "圣保罗"],
  [["tokyo", "东京"], "TYO", 1115, 198, "东京"],
  [["osaka", "大阪"], "OSA", 1109, 207, "大阪"],
  [["hongkong", "hong kong", "香港", "hk", "hytron"], "HKG", 1039, 263, "香港"],
  [["taiwan", "taipei", "台湾", "台北"], "TPE", 1067, 253, "台北"],
  [["singapore", "新加坡", "sg"], "SIN", 1018, 352, "新加坡"],
  [["seoul", "首尔", "kr"], "SEL", 1083, 198, "首尔"],
  [["beijing", "北京"], "PEK", 1025, 178, "北京"],
  [["shanghai", "上海"], "PVG", 1057, 225, "上海"],
  [["guangzhou", "广州"], "CAN", 1032, 258, "广州"],
  [["shenzhen", "深圳"], "SZX", 1037, 261, "深圳"],
  [["sydney", "悉尼"], "SYD", 1180, 505, "悉尼"]
];

function resolveServerLocation(
  node: HomeNodeSummary,
  displayName: string
): { code: string; name: string; x: number; y: number } {
  const nameLower = (displayName || "").toLowerCase();
  const regUpper = (node.region || "US").toUpperCase();

  // 1. Check city keywords
  for (const [keywords, code, x, y, cname] of CITY_KEYWORDS) {
    if (keywords.some((k) => nameLower.includes(k))) {
      return { code, name: cname, x, y };
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
      y: mapped.y
    };
  }

  if (mapped) {
    const x = Math.round(((mapped.lon + 180) / 360) * 1280);
    const y = Math.round(((90 - mapped.lat) / 180) * 621);
    return {
      code,
      name: mapped.name || regUpper,
      x,
      y
    };
  }

  // 3. Fallback coordinate
  return {
    code: "US",
    name: "美国",
    x: 233,
    y: 209
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
          servers: [{ node, displayName }],
          onlineCount: node.online ? 1 : 0
        });
      }
    });

    return Array.from(map.values());
  }, [nodes, nameByUuid]);

  const totalOnline = useMemo(() => nodes.filter((n) => n.online).length, [nodes]);

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

                {/* Black Tag Badge (nazhua style: '东京,1台') */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium whitespace-nowrap pointer-events-none transition-transform group-hover:scale-105"
                  style={{
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
