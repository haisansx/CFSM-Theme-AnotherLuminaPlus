import { useEffect, useRef, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";
import { COAST_LINES, COUNTRIES } from "./worldMapData";

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
const CITY_COORDS: Record<string, { lat: number; lng: number; city: string; country: string }> = {
  // Brazil & Latin America
  "sao paulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "saopaulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "são paulo": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "圣保罗": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "rio": { lat: -22.9068, lng: -43.1729, city: "Rio de Janeiro", country: "BR" },
  "brazil": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "brasil": { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "BR" },
  "santiago": { lat: -33.4489, lng: -70.6693, city: "Santiago", country: "CL" },
  "buenos aires": { lat: -34.6037, lng: -58.3816, city: "Buenos Aires", country: "AR" },
  // US & Canada
  "san jose": { lat: 37.3382, lng: -121.8863, city: "San Jose", country: "US" },
  "sanjose": { lat: 37.3382, lng: -121.8863, city: "San Jose", country: "US" },
  "圣何塞": { lat: 37.3382, lng: -121.8863, city: "San Jose", country: "US" },
  "oregon": { lat: 44.0000, lng: -120.5000, city: "Oregon", country: "US" },
  "俄勒冈": { lat: 44.0000, lng: -120.5000, city: "Oregon", country: "US" },
  "los angeles": { lat: 34.0522, lng: -118.2437, city: "Los Angeles", country: "US" },
  "la": { lat: 34.0522, lng: -118.2437, city: "Los Angeles", country: "US" },
  "洛杉矶": { lat: 34.0522, lng: -118.2437, city: "Los Angeles", country: "US" },
  "seattle": { lat: 47.6062, lng: -122.3321, city: "Seattle", country: "US" },
  "chicago": { lat: 41.8781, lng: -87.6298, city: "Chicago", country: "US" },
  "new york": { lat: 40.7128, lng: -74.0060, city: "New York", country: "US" },
  "dallas": { lat: 32.7767, lng: -96.7970, city: "Dallas", country: "US" },
  "miami": { lat: 25.7617, lng: -80.1918, city: "Miami", country: "US" },
  "toronto": { lat: 43.6532, lng: -79.3832, city: "Toronto", country: "CA" },
  // Europe
  "london": { lat: 51.5074, lng: -0.1278, city: "London", country: "GB" },
  "伦敦": { lat: 51.5074, lng: -0.1278, city: "London", country: "GB" },
  "paris": { lat: 48.8566, lng: 2.3522, city: "Paris", country: "FR" },
  "巴黎": { lat: 48.8566, lng: 2.3522, city: "Paris", country: "FR" },
  "nürnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg", country: "DE" },
  "nurnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg", country: "DE" },
  "纽伦堡": { lat: 49.4521, lng: 11.0767, city: "Nürnberg", country: "DE" },
  "netcup": { lat: 49.4521, lng: 11.0767, city: "Nürnberg", country: "DE" },
  "frankfurt": { lat: 50.1109, lng: 8.6821, city: "Frankfurt", country: "DE" },
  "法兰克福": { lat: 50.1109, lng: 8.6821, city: "Frankfurt", country: "DE" },
  "euserv": { lat: 50.1109, lng: 8.6821, city: "Frankfurt", country: "DE" },
  "amsterdam": { lat: 52.3676, lng: 4.9041, city: "Amsterdam", country: "NL" },
  // Asia & Oceania
  "tokyo": { lat: 35.6762, lng: 139.6503, city: "Tokyo", country: "JP" },
  "东京": { lat: 35.6762, lng: 139.6503, city: "Tokyo", country: "JP" },
  "osaka": { lat: 34.6937, lng: 135.5023, city: "Osaka", country: "JP" },
  "singapore": { lat: 1.3521, lng: 103.8198, city: "Singapore", country: "SG" },
  "新加坡": { lat: 1.3521, lng: 103.8198, city: "Singapore", country: "SG" },
  "hongkong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong", country: "HK" },
  "hong kong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong", country: "HK" },
  "hk": { lat: 22.3193, lng: 114.1694, city: "Hong Kong", country: "HK" },
  "香港": { lat: 22.3193, lng: 114.1694, city: "Hong Kong", country: "HK" },
  "hytron": { lat: 22.3193, lng: 114.1694, city: "Hong Kong", country: "HK" },
  "seoul": { lat: 37.5665, lng: 126.9780, city: "Seoul", country: "KR" },
  "首尔": { lat: 37.5665, lng: 126.9780, city: "Seoul", country: "KR" },
  "sydney": { lat: -33.8688, lng: 151.2093, city: "Sydney", country: "AU" },
  "悉尼": { lat: -33.8688, lng: 151.2093, city: "Sydney", country: "AU" }
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
  
  let matchCity: { lat: number; lng: number; city: string; country: string } | null = null;
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (nameLower.includes(key)) {
      matchCity = val;
      break;
    }
  }

  const country = matchCity ? matchCity.country : regUpper;
  const def = COUNTRY_DEFAULTS[country] || { lat: 20, lng: 0, city: country, flag: "🌐" };
  const lat = matchCity ? matchCity.lat : def.lat;
  const lng = matchCity ? matchCity.lng : def.lng;
  const city = matchCity ? matchCity.city : def.city;
  const flag = getCountryFlag(country);

  return {
    id: node.uuid,
    name: name || country,
    country,
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
  // Initial rotation angle facing Pacific / Americas
  const rotationRef = useRef<number>(1.85);
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

  // Set of deployed country ISO codes
  const deployedCountries = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach(n => {
      const name = nameByUuid?.get(n.uuid) || "";
      const loc = resolveLocation(n, name);
      if (loc.country) set.add(loc.country.toUpperCase());
      if (n.region) set.add(n.region.toUpperCase());
    });
    return set;
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
        rotationRef.current += 0.0025; // Slow smooth rotation
      }
      pulseTime += 0.04;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * window.devicePixelRatio || canvas.height !== height * window.devicePixelRatio) {
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
      }

      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space Cosmic Background
      const spaceGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.1,
        width * 0.5,
        height * 0.5,
        width * 0.75
      );
      spaceGrad.addColorStop(0, "#081325");
      spaceGrad.addColorStop(0.5, "#040915");
      spaceGrad.addColorStop(1, "#020409");
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars
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

      // 2. Earth Outer Atmosphere Limb (Cyan/Electric Blue Glow like Image 3)
      const atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.32);
      atmoGrad.addColorStop(0, "rgba(6, 182, 212, 0.45)");
      atmoGrad.addColorStop(0.35, "rgba(14, 165, 233, 0.22)");
      atmoGrad.addColorStop(0.7, "rgba(2, 132, 199, 0.08)");
      atmoGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.32, 0, Math.PI * 2);
      ctx.fill();

      // 3. Realistic 3D Earth Surface (Deep Blue-Black Ocean)
      const earthGrad = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      earthGrad.addColorStop(0, "#0d213f");
      earthGrad.addColorStop(0.5, "#07142b");
      earthGrad.addColorStop(0.85, "#030a17");
      earthGrad.addColorStop(1, "#01050d");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();

      // Sharp Cyan Horizon Edge
      ctx.strokeStyle = "rgba(34, 211, 238, 0.75)";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 3D Spherical Projection Formula
      // Standard geographic spherical projection:
      // x: East (+X) / West (-X)
      // y: North (+Y) / South (-Y)
      // z: Front (+Z) / Back (-Z)
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const project = (lng: number, lat: number, alt: number = 0): { x: number; y: number; z: number } => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng * (Math.PI / 180)) + rot;

        const x = Math.sin(phi) * Math.sin(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.cos(theta);

        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;

        const r = radius * (1 + alt);
        return {
          x: cx + x * r,
          y: cy - y2 * r,
          z: z2
        };
      };

      // Clip all land/polygons inside the Earth disc
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
      ctx.clip();

      // 4. Subtle Latitude/Longitude Graticule
      ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      ctx.lineWidth = 0.6;
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

      // 5. Global Coastlines (Subtle High-Tech Cyan Contours)
      ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
      ctx.lineWidth = 1.1;
      for (const line of COAST_LINES) {
        let isDrawing = false;
        for (let i = 0; i < line.length; i++) {
          const [lng, lat] = line[i];
          const p = project(lng, lat);
          if (p.z > 0.02) {
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
      }

      // 6. Highlighted Deployed Countries (Exact Image 3 Cyan Style!)
      for (const code of deployedCountries) {
        const country = COUNTRIES[code];
        if (!country) continue;

        for (const ring of country.rings) {
          // Check if ring has points on visible hemisphere
          let frontCount = 0;
          for (let i = 0; i < ring.length; i += 2) {
            const p = project(ring[i][0], ring[i][1]);
            if (p.z > 0.02) frontCount++;
          }
          if (frontCount < 2) continue;

          // Draw filled country polygon
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < ring.length; i++) {
            const [lng, lat] = ring[i];
            const p = project(lng, lat);
            if (p.z > 0.01) {
              if (!started) {
                ctx.moveTo(p.x, p.y);
                started = true;
              } else {
                ctx.lineTo(p.x, p.y);
              }
            }
          }

          if (started) {
            ctx.closePath();
            // Luminous Cyan Fill (Image 3)
            ctx.fillStyle = "rgba(6, 182, 212, 0.32)";
            ctx.fill();

            // Glowing Cyan Boundary Stroke (Image 3)
            ctx.strokeStyle = "#00f0ff";
            ctx.lineWidth = 1.8;
            ctx.shadowColor = "#00f0ff";
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // 7. Night City Lights ("夜间灯火" - Space View)
      for (const [lng, lat, intensity] of CITY_LIGHTS) {
        const p = project(lng, lat);
        if (p.z > 0.03) {
          const zFactor = Math.min(1, Math.max(0.15, p.z));
          const flicker = 0.85 + 0.15 * Math.sin(pulseTime * 2 + lng);
          const alpha = zFactor * intensity * flicker;

          const bloom = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 4.5);
          bloom.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          bloom.addColorStop(0.5, `rgba(245, 158, 11, ${alpha * 0.45})`);
          bloom.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore(); // End Earth disc clipping

      // 8. 3D Flight Arcs between deployed nodes (Image 3)
      if (activeLocations.length >= 2) {
        const numArcs = Math.min(activeLocations.length - 1, 4);
        for (let i = 0; i < numArcs; i++) {
          const locA = activeLocations[i];
          const locB = activeLocations[(i + 1) % activeLocations.length];
          const steps = 30;
          ctx.beginPath();
          let arcVisible = false;

          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const curLat = locA.lat * (1 - t) + locB.lat * t;
            const curLng = locA.lng * (1 - t) + locB.lng * t;
            // Parabolic elevation above surface
            const alt = Math.sin(t * Math.PI) * 0.18;
            const p = project(curLng, curLat, alt);

            if (p.z > 0.05) {
              if (!arcVisible) {
                ctx.moveTo(p.x, p.y);
                arcVisible = true;
              } else {
                ctx.lineTo(p.x, p.y);
              }
            } else {
              arcVisible = false;
            }
          }

          if (arcVisible) {
            const arcGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
            arcGrad.addColorStop(0, "rgba(0, 240, 255, 0.75)");
            arcGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.8)");
            arcGrad.addColorStop(1, "rgba(56, 189, 248, 0.75)");
            ctx.strokeStyle = arcGrad;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      }

      // 9. Active Deployed VPS Nodes with Smart Non-Overlapping Leader Lines (引导线)
      interface VisibleMarker {
        loc: NodeLocation;
        p: { x: number; y: number; z: number };
        badgeOffset: { x: number; y: number };
        dir: "left" | "right";
      }

      const visibleMarkers: VisibleMarker[] = [];
      for (const loc of activeLocations) {
        const p = project(loc.lng, loc.lat);
        if (p.z > 0.05) {
          visibleMarkers.push({
            loc,
            p,
            badgeOffset: { x: 0, y: 0 },
            dir: "right"
          });
        }
      }

      // Sort by vertical position (North to South)
      visibleMarkers.sort((a, b) => a.p.y - b.p.y);

      // Detect clustered markers (nearby nodes like Oregon, San Jose, Los Angeles)
      // and assign staggered leader lines (引导线)
      const clusters: VisibleMarker[][] = [];
      const visited = new Set<VisibleMarker>();

      for (let i = 0; i < visibleMarkers.length; i++) {
        const m1 = visibleMarkers[i];
        if (visited.has(m1)) continue;
        const cluster = [m1];
        visited.add(m1);

        for (let j = i + 1; j < visibleMarkers.length; j++) {
          const m2 = visibleMarkers[j];
          if (visited.has(m2)) continue;
          const dx = m1.p.x - m2.p.x;
          const dy = m1.p.y - m2.p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 65) {
            cluster.push(m2);
            visited.add(m2);
          }
        }
        clusters.push(cluster);
      }

      // Assign leader line offsets per cluster to prevent ANY label overlap
      for (const cluster of clusters) {
        if (cluster.length === 1) {
          const m = cluster[0];
          const goesRight = m.p.x < cx;
          m.dir = goesRight ? "right" : "left";
          m.badgeOffset = {
            x: goesRight ? 32 : -32,
            y: -24
          };
        } else {
          // Multiple nearby cities! Fan out leader lines at different angles & lengths
          // Patterns: Top-Left, Top-Right, High-Up, Down-Left, Down-Right
          const offsets = [
            { x: -55, y: -36, dir: "left" as const },   // Upper Left
            { x: 55, y: -32, dir: "right" as const },   // Upper Right
            { x: -50, y: -68, dir: "left" as const },   // Far Upper Left
            { x: 50, y: -64, dir: "right" as const },   // Far Upper Right
            { x: -60, y: 12, dir: "left" as const },    // Lower Left
            { x: 60, y: 16, dir: "right" as const }     // Lower Right
          ];
          for (let k = 0; k < cluster.length; k++) {
            const m = cluster[k];
            const cfg = offsets[k % offsets.length];
            m.badgeOffset = { x: cfg.x, y: cfg.y };
            m.dir = cfg.dir;
          }
        }
      }

      // Render Leader Lines & Clean Badges (Image 3 Style)
      for (const m of visibleMarkers) {
        const { loc, p, badgeOffset, dir } = m;
        const alpha = Math.min(1, Math.max(0.2, (p.z - 0.05) / 0.45));

        // 1. Globe surface node anchor dot
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.stroke();

        // 2. High-Tech Angled Leader Line (引导线)
        const targetX = p.x + badgeOffset.x;
        const targetY = p.y + badgeOffset.y;
        const elbowX = p.x + (badgeOffset.x * 0.45);

        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.85})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(elbowX, targetY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Small leader line joint dot
        ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Clean Rounded Capsule Badge (Image 3 Style)
        const tagText = `${loc.flag} ${loc.city}`;
        ctx.font = "600 11px Inter, sans-serif";
        const textWidth = ctx.measureText(tagText).width;
        const tagW = textWidth + 22;
        const tagH = 22;

        const tagX = dir === "right" ? targetX + 4 : targetX - tagW - 4;
        const tagY = targetY - tagH / 2;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Dark glass background with cyan border glow
        ctx.fillStyle = "rgba(6, 18, 38, 0.94)";
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(0, 240, 255, 0.5)";
        ctx.shadowBlur = 6;

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 6);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.rect(tagX, tagY, tagW, tagH);
          ctx.fill();
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(tagText, tagX + 8, tagY + 15);

        // Online status dot
        ctx.fillStyle = loc.online ? "#00f0ff" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(tagX + tagW - 8, tagY + tagH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

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
      rotationRef.current += delta * 0.007;
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
      rotationRef.current += delta * 0.007;
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
  }, [activeLocations, deployedCountries, stars]);

  return (
    <div
      ref={containerRef}
      className={`server-globe-card relative overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col items-center justify-center ${className}`}
      style={{
        minHeight: "330px",
        height: "100%",
        background: "radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.07) 0%, rgba(4, 9, 21, 0.98) 75%)",
        borderRadius: "22px",
        border: "1px solid rgba(0, 240, 255, 0.2)",
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.65)"
      }}
    >
      {/* Title with Cyan Glow like Image 3 */}
      <div className="absolute top-4 left-5 flex items-center gap-2 pointer-events-none z-10">
        <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
        <span
          className="text-xs font-bold tracking-wider uppercase"
          style={{
            color: "#00f0ff",
            textShadow: "0 0 10px rgba(0, 240, 255, 0.7)"
          }}
        >
          服务器全球分布区域 · GLOBAL NODES ({activeLocations.length})
        </span>
      </div>

      {/* Top right indicator */}
      <div className="absolute top-4 right-5 text-[11px] text-[#38bdf8]/60 pointer-events-none z-10 font-mono">
        {deployedCountries.size} REGIONS · {activeLocations.length} NODES
      </div>

      {/* HUD Info Card (matching top-left HUD in Image 3) */}
      <div
        className="absolute bottom-4 left-5 pointer-events-none z-10 px-3 py-2 rounded-lg text-[11px] font-mono leading-relaxed"
        style={{
          background: "rgba(4, 15, 33, 0.82)",
          border: "1px solid rgba(0, 240, 255, 0.35)",
          color: "#38bdf8",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)"
        }}
      >
        <div>检测到 {deployedCountries.size} 个部署区域</div>
        <div>加载 {activeLocations.length} 个节点位置...</div>
        <div className="text-[#00f0ff] font-semibold">状态: 实时监控中</div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%", minHeight: "300px" }}
      />
    </div>
  );
}
