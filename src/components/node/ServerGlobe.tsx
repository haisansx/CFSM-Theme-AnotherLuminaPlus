import { useEffect, useRef, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";
import { COAST_LINES, BORDER_LINES } from "./worldMapData";

interface ServerGlobeProps {
  nodes: HomeNodeSummary[];
  nameByUuid?: Map<string, string>;
  className?: string;
}

interface NodeLocation {
  id: string;
  name: string;
  country: string;
  flag: string;
  city: string;
  lat: number;
  lng: number;
  online: boolean;
}

// Major global city lights clusters for realistic "Earth at Night" space view
const CITY_LIGHTS: [number, number, number][] = [
  // North America
  [-122.4, 37.8, 1.0], [-121.9, 37.3, 0.9], [-118.2, 34.0, 1.0], [-117.2, 32.7, 0.8],
  [-120.5, 44.0, 0.6], [-122.3, 47.6, 0.85], [-123.1, 49.3, 0.8], [-74.0, 40.7, 1.0],
  [-71.1, 42.4, 0.85], [-75.2, 39.9, 0.85], [-77.0, 38.9, 0.95], [-87.6, 41.9, 0.9],
  [-83.0, 42.3, 0.75], [-95.4, 29.8, 0.85], [-96.8, 32.8, 0.85], [-84.4, 33.7, 0.8],
  [-80.2, 25.8, 0.85], [-112.1, 33.4, 0.8], [-104.9, 39.7, 0.75], [-115.1, 36.2, 0.9],
  [-79.4, 43.7, 0.85], [-73.6, 45.5, 0.8], [-99.1, 19.4, 0.95],
  // South America (Brazil, São Paulo, Rio, etc.)
  [-46.6, -23.5, 1.0], [-43.2, -22.9, 0.95], [-47.9, -15.8, 0.8], [-43.9, -19.9, 0.8],
  [-51.2, -30.0, 0.8], [-58.4, -34.6, 0.95], [-70.7, -33.4, 0.85], [-77.0, -12.0, 0.8],
  // Western & Central Europe
  [-0.1, 51.5, 1.0], [-1.9, 52.5, 0.8], [-2.2, 53.5, 0.8], [-3.2, 55.9, 0.7],
  [2.3, 48.9, 1.0], [4.9, 52.4, 0.9], [4.4, 50.8, 0.85], [11.1, 49.5, 0.85],
  [8.7, 50.1, 0.95], [11.6, 48.1, 0.85], [13.4, 52.5, 0.9], [9.9, 53.5, 0.8],
  [6.9, 50.9, 0.85], [8.5, 47.4, 0.8], [9.2, 45.5, 0.9], [12.5, 41.9, 0.85],
  [14.3, 40.8, 0.75], [-3.7, 40.4, 0.9], [2.2, 41.4, 0.85], [-9.1, 38.7, 0.8],
  [16.4, 48.2, 0.8], [14.4, 50.1, 0.75], [21.0, 52.2, 0.8], [18.1, 59.3, 0.75],
  // East Asia & SE Asia
  [139.7, 35.7, 1.0], [135.5, 34.7, 0.95], [136.9, 35.2, 0.85], [130.4, 33.6, 0.8],
  [141.3, 43.1, 0.75], [127.0, 37.6, 1.0], [129.1, 35.2, 0.85], [121.5, 31.2, 1.0],
  [116.4, 39.9, 1.0], [117.2, 39.1, 0.85], [113.3, 23.1, 1.0], [114.1, 22.3, 1.0],
  [113.1, 23.0, 0.85], [120.2, 30.3, 0.9], [118.8, 32.1, 0.85], [114.3, 30.6, 0.85],
  [104.1, 30.7, 0.85], [106.5, 29.5, 0.85], [121.5, 25.0, 0.95], [120.3, 22.6, 0.8],
  [103.8, 1.35, 1.0], [101.7, 3.1, 0.85], [100.5, 13.7, 0.9], [105.8, 21.0, 0.8],
  [106.7, 10.8, 0.85], [106.8, -6.2, 0.9], [121.0, 14.6, 0.85],
  // South Asia, Middle East, Oceania
  [72.9, 19.1, 0.9], [77.2, 28.6, 0.9], [77.6, 13.0, 0.85], [80.3, 13.1, 0.8],
  [55.3, 25.3, 0.95], [54.4, 24.5, 0.85], [46.7, 24.7, 0.8], [34.8, 32.1, 0.85],
  [151.2, -33.9, 0.85], [144.9, -37.8, 0.85], [153.0, -27.5, 0.75], [115.9, -32.0, 0.7]
];

// Coordinates mapping for user's VPS locations
const CITY_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  // Brazil & Latin America
  "sao paulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "saopaulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "são paulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "圣保罗": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "rio": { lat: -22.9068, lng: -43.1729, city: "Rio de Janeiro" },
  "brazil": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "brasil": { lat: -23.5505, lng: -46.6333, city: "São Paulo" },
  "santiago": { lat: -33.4489, lng: -70.6693, city: "Santiago" },
  "buenos aires": { lat: -34.6037, lng: -58.3816, city: "Buenos Aires" },
  // US & Canada
  "san jose": { lat: 37.3382, lng: -121.8863, city: "San Jose" },
  "sanjose": { lat: 37.3382, lng: -121.8863, city: "San Jose" },
  "圣何塞": { lat: 37.3382, lng: -121.8863, city: "San Jose" },
  "oregon": { lat: 44.0000, lng: -120.5000, city: "Oregon" },
  "俄勒冈": { lat: 44.0000, lng: -120.5000, city: "Oregon" },
  "los angeles": { lat: 34.0522, lng: -118.2437, city: "Los Angeles" },
  "la": { lat: 34.0522, lng: -118.2437, city: "Los Angeles" },
  "洛杉矶": { lat: 34.0522, lng: -118.2437, city: "Los Angeles" },
  "seattle": { lat: 47.6062, lng: -122.3321, city: "Seattle" },
  "chicago": { lat: 41.8781, lng: -87.6298, city: "Chicago" },
  "new york": { lat: 40.7128, lng: -74.0060, city: "New York" },
  "dallas": { lat: 32.7767, lng: -96.7970, city: "Dallas" },
  "miami": { lat: 25.7617, lng: -80.1918, city: "Miami" },
  "toronto": { lat: 43.6532, lng: -79.3832, city: "Toronto" },
  // Europe
  "london": { lat: 51.5074, lng: -0.1278, city: "London" },
  "伦敦": { lat: 51.5074, lng: -0.1278, city: "London" },
  "paris": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "巴黎": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "nürnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "nurnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "纽伦堡": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "netcup": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "frankfurt": { lat: 50.1109, lng: 8.6821, city: "Frankfurt" },
  "法兰克福": { lat: 50.1109, lng: 8.6821, city: "Frankfurt" },
  "euserv": { lat: 50.1109, lng: 8.6821, city: "Frankfurt" },
  "amsterdam": { lat: 52.3676, lng: 4.9041, city: "Amsterdam" },
  // Asia & Oceania
  "tokyo": { lat: 35.6762, lng: 139.6503, city: "Tokyo" },
  "东京": { lat: 35.6762, lng: 139.6503, city: "Tokyo" },
  "osaka": { lat: 34.6937, lng: 135.5023, city: "Osaka" },
  "singapore": { lat: 1.3521, lng: 103.8198, city: "Singapore" },
  "新加坡": { lat: 1.3521, lng: 103.8198, city: "Singapore" },
  "hongkong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "hong kong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "hk": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "香港": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "hytron": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "seoul": { lat: 37.5665, lng: 126.9780, city: "Seoul" },
  "首尔": { lat: 37.5665, lng: 126.9780, city: "Seoul" },
  "sydney": { lat: -33.8688, lng: 151.2093, city: "Sydney" },
  "悉尼": { lat: -33.8688, lng: 151.2093, city: "Sydney" }
};

const COUNTRY_DEFAULTS: Record<string, { lat: number; lng: number; city: string; flag: string }> = {
  BR: { lat: -23.5505, lng: -46.6333, city: "São Paulo", flag: "🇧🇷" },
  CL: { lat: -33.4489, lng: -70.6693, city: "Santiago", flag: "🇨🇱" },
  AR: { lat: -34.6037, lng: -58.3816, city: "Buenos Aires", flag: "🇦🇷" },
  US: { lat: 37.0902, lng: -95.7129, city: "United States", flag: "🇺🇸" },
  DE: { lat: 51.1657, lng: 10.4515, city: "Germany", flag: "🇩🇪" },
  JP: { lat: 36.2048, lng: 138.2529, city: "Japan", flag: "🇯🇵" },
  HK: { lat: 22.3193, lng: 114.1694, city: "Hong Kong", flag: "🇭🇰" },
  SG: { lat: 1.3521, lng: 103.8198, city: "Singapore", flag: "🇸🇬" },
  GB: { lat: 55.3781, lng: -3.4360, city: "United Kingdom", flag: "🇬🇧" },
  FR: { lat: 46.2276, lng: 2.2137, city: "France", flag: "🇫🇷" },
  NL: { lat: 52.1326, lng: 5.2913, city: "Netherlands", flag: "🇳🇱" },
  AU: { lat: -25.2744, lng: 133.7751, city: "Australia", flag: "🇦🇺" },
  KR: { lat: 35.9078, lng: 127.7669, city: "South Korea", flag: "🇰🇷" },
  CA: { lat: 56.1304, lng: -106.3468, city: "Canada", flag: "🇨🇦" },
  TW: { lat: 23.6978, lng: 120.9605, city: "Taiwan", flag: "🇹🇼" },
  CN: { lat: 35.8617, lng: 104.1954, city: "China", flag: "🇨🇳" }
};

function getCountryFlag(code?: string): string {
  if (!code || code.length !== 2) return "🌐";
  const c = code.toUpperCase();
  if (COUNTRY_DEFAULTS[c]?.flag) return COUNTRY_DEFAULTS[c].flag;
  return String.fromCodePoint(
    c.charCodeAt(0) + 127397,
    c.charCodeAt(1) + 127397
  );
}

function resolveLocation(node: HomeNodeSummary, name: string): NodeLocation {
  const nameLower = (name || "").toLowerCase();
  const regUpper = (node.region || "US").toUpperCase();
  
  let matchCity: { lat: number; lng: number; city: string } | null = null;
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (nameLower.includes(key)) {
      matchCity = val;
      break;
    }
  }

  const def = COUNTRY_DEFAULTS[regUpper] || { lat: 20, lng: 0, city: regUpper, flag: "🌐" };
  const lat = matchCity ? matchCity.lat : def.lat;
  const lng = matchCity ? matchCity.lng : def.lng;
  const city = matchCity ? matchCity.city : def.city;
  const flag = getCountryFlag(regUpper);

  return {
    id: node.uuid,
    name: name || regUpper,
    country: regUpper,
    flag,
    city,
    lat,
    lng,
    online: Boolean(node.online)
  };
}

export function ServerGlobe({ nodes, nameByUuid, className = "" }: ServerGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<number>(1.2);
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number>(0);

  // Background starry deep space field
  const stars = useMemo(() => {
    const list: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 90; i++) {
      list.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.2 + 0.4,
        a: Math.random() * 0.7 + 0.2
      });
    }
    return list;
  }, []);

  // Group unique locations
  const activeLocations = useMemo(() => {
    const map = new Map<string, NodeLocation>();
    nodes.forEach(n => {
      const name = nameByUuid?.get(n.uuid) || "";
      const loc = resolveLocation(n, name);
      const key = `${loc.city}-${loc.country}`;
      if (!map.has(key) || loc.online) {
        map.set(key, loc);
      }
    });
    return Array.from(map.values());
  }, [nodes, nameByUuid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let pulseTime = 0;

    const render = () => {
      if (!isDraggingRef.current) {
        rotationRef.current += 0.0035; // Smooth realistic rotation
      }
      pulseTime += 0.05;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * window.devicePixelRatio || canvas.height !== height * window.devicePixelRatio) {
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
      }

      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space Background with Stars & Cosmic Nebula
      const spaceGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.1,
        width * 0.5,
        height * 0.5,
        width * 0.7
      );
      spaceGrad.addColorStop(0, "#0b1220");
      spaceGrad.addColorStop(0.6, "#060913");
      spaceGrad.addColorStop(1, "#020408");
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars in outer space
      for (const s of stars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.a * (0.8 + 0.2 * Math.sin(pulseTime + s.x * 20))})`;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.40;
      const rot = rotationRef.current;
      const tilt = 0.22;

      // 2. Earth Outer Atmosphere Limb (Electric Blue ISS Space Glow)
      const atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.30);
      atmoGrad.addColorStop(0, "rgba(56, 189, 248, 0.40)");
      atmoGrad.addColorStop(0.4, "rgba(14, 165, 233, 0.22)");
      atmoGrad.addColorStop(0.7, "rgba(2, 132, 199, 0.08)");
      atmoGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.30, 0, Math.PI * 2);
      ctx.fill();

      // 3. Realistic 3D Earth Surface (Deep Oceanic Blue & Curved Space Horizon)
      const earthGrad = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      earthGrad.addColorStop(0, "#0f2347");
      earthGrad.addColorStop(0.5, "#091730");
      earthGrad.addColorStop(0.85, "#040c1c");
      earthGrad.addColorStop(1, "#020610");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();

      // Thin sharp atmospheric horizon ring
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 3D Projection Formula
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const project = (lng: number, lat: number): { x: number; y: number; z: number } => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng * (Math.PI / 180)) + rot;

        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);

        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;

        return {
          x: cx + x * radius,
          y: cy - y2 * radius,
          z: z2
        };
      };

      // 4. Graticule (Subtle Lat/Lng navigation lines)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 0.7;

      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let isDrawing = false;
        for (let lng = -180; lng <= 180; lng += 4) {
          const p = project(lng, lat);
          if (p.z > 0.01) {
            if (!isDrawing) { ctx.moveTo(p.x, p.y); isDrawing = true; }
            else ctx.lineTo(p.x, p.y);
          } else {
            isDrawing = false;
          }
        }
        ctx.stroke();
      }

      for (let lng = -180; lng < 180; lng += 30) {
        ctx.beginPath();
        let isDrawing = false;
        for (let lat = -80; lat <= 80; lat += 4) {
          const p = project(lng, lat);
          if (p.z > 0.01) {
            if (!isDrawing) { ctx.moveTo(p.x, p.y); isDrawing = true; }
            else ctx.lineTo(p.x, p.y);
          } else {
            isDrawing = false;
          }
        }
        ctx.stroke();
      }

      // Polyline drawer
      const drawPolyline = (line: [number, number][]) => {
        let isDrawing = false;
        for (let i = 0; i < line.length; i++) {
          const [lng, lat] = line[i];
          const p = project(lng, lat);
          if (p.z > 0.01) {
            if (!isDrawing) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              isDrawing = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            if (isDrawing) {
              ctx.stroke();
              isDrawing = false;
            }
          }
        }
        if (isDrawing) {
          ctx.stroke();
        }
      };

      // 5. Standard Coastlines (Continental boundaries in vivid cyan)
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = 1.35;
      for (const line of COAST_LINES) {
        drawPolyline(line);
      }

      // 6. Standard Country Borders (Geopolitical boundaries in dashed amber)
      ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
      ctx.lineWidth = 0.95;
      ctx.setLineDash([3, 3]);
      for (const line of BORDER_LINES) {
        drawPolyline(line);
      }
      ctx.setLineDash([]);

      // 7. Night City Lights ("夜间灯火" - Golden Urban Clusters from Space)
      for (const [lng, lat, intensity] of CITY_LIGHTS) {
        const p = project(lng, lat);
        if (p.z > 0.03) {
          const zFactor = Math.min(1, Math.max(0.15, p.z));
          const flicker = 0.85 + 0.15 * Math.sin(pulseTime * 2 + lng);
          const alpha = zFactor * intensity * flicker;

          // Warm golden bloom halo
          const bloom = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 4.5);
          bloom.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          bloom.addColorStop(0.5, `rgba(245, 158, 11, ${alpha * 0.5})`);
          bloom.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Intense core city light
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 8. Active Deployed VPS Location Beacons
      const visibleMarkers: {
        loc: NodeLocation;
        p: { x: number; y: number; z: number };
      }[] = [];

      for (const loc of activeLocations) {
        const p = project(loc.lng, loc.lat);
        if (p.z > 0.05) {
          visibleMarkers.push({ loc, p });
        }
      }

      visibleMarkers.sort((a, b) => a.p.z - b.p.z);

      for (const { loc, p } of visibleMarkers) {
        const alpha = Math.min(1, Math.max(0.2, (p.z - 0.05) / 0.5));
        const pulseSize = 3 + Math.sin(pulseTime * 2.5) * 2;

        // Outer pulsing ripple ring
        ctx.strokeStyle = `rgba(243, 128, 32, ${alpha * 0.85})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseSize + 4.5, 0, Math.PI * 2);
        ctx.stroke();

        // Core dot
        ctx.fillStyle = loc.online ? "#f38020" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Beacon vertical beam
        const beaconHeight = 24 * p.z;
        ctx.strokeStyle = `rgba(243, 128, 32, ${alpha * 0.9})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - beaconHeight);
        ctx.stroke();

        // Tag badge
        const tagText = `${loc.flag} ${loc.city}`;
        ctx.font = "600 11px Inter, sans-serif";
        const textWidth = ctx.measureText(tagText).width;
        const tagW = textWidth + 14;
        const tagH = 20;
        const tagX = p.x - tagW / 2;
        const tagY = p.y - beaconHeight - tagH - 2;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(11, 18, 32, 0.92)";
        ctx.strokeStyle = "rgba(243, 128, 32, 0.55)";
        ctx.lineWidth = 1;

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 10);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.rect(tagX, tagY, tagW, tagH);
          ctx.fill();
          ctx.stroke();
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillText(tagText, tagX + 7, tagY + 14);
        ctx.restore();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      lastMouseXRef.current = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - lastMouseXRef.current;
      rotationRef.current += delta * 0.008;
      lastMouseXRef.current = e.clientX;
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDraggingRef.current = true;
        lastMouseXRef.current = e.touches[0].clientX;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length === 0) return;
      const delta = e.touches[0].clientX - lastMouseXRef.current;
      rotationRef.current += delta * 0.008;
      lastMouseXRef.current = e.touches[0].clientX;
    };
    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener("mousedown", onMouseDown);
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onTouchEnd);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (el) {
        el.removeEventListener("mousedown", onMouseDown);
        el.removeEventListener("touchstart", onTouchStart);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeLocations, stars]);

  return (
    <div
      ref={containerRef}
      className={`server-globe-card relative overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col items-center justify-center ${className}`}
      style={{
        minHeight: "330px",
        height: "100%",
        background: "radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 18, 0.98) 75%)",
        borderRadius: "22px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.6)"
      }}
    >
      <div className="absolute top-4 left-5 flex items-center gap-2 pointer-events-none z-10">
        <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
        <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
          Global Nodes ({activeLocations.length})
        </span>
      </div>

      <div className="absolute top-4 right-5 text-[11px] text-white/40 pointer-events-none z-10">
        太空白昼夜景 · 标准国界线
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%", minHeight: "300px" }}
      />
    </div>
  );
}
