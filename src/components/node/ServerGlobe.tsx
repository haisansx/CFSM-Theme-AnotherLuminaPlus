import { useEffect, useRef, useMemo } from "react";
import type { HomeNodeSummary } from "@/services/wsStore";

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

// Known coordinates mapping
const CITY_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  "san jose": { lat: 37.3382, lng: -121.8863, city: "San Jose" },
  "sanjose": { lat: 37.3382, lng: -121.8863, city: "San Jose" },
  "oregon": { lat: 44.0000, lng: -120.5000, city: "Oregon" },
  "los angeles": { lat: 34.0522, lng: -118.2437, city: "Los Angeles" },
  "la": { lat: 34.0522, lng: -118.2437, city: "Los Angeles" },
  "london": { lat: 51.5074, lng: -0.1278, city: "London" },
  "paris": { lat: 48.8566, lng: 2.3522, city: "Paris" },
  "nürnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "nurnberg": { lat: 49.4521, lng: 11.0767, city: "Nürnberg" },
  "frankfurt": { lat: 50.1109, lng: 8.6821, city: "Frankfurt" },
  "tokyo": { lat: 35.6762, lng: 139.6503, city: "Tokyo" },
  "singapore": { lat: 1.3521, lng: 103.8198, city: "Singapore" },
  "hongkong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "hong kong": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" },
  "hk": { lat: 22.3193, lng: 114.1694, city: "Hong Kong" }
};

const COUNTRY_DEFAULTS: Record<string, { lat: number; lng: number; city: string; flag: string }> = {
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

// Generate stylized landmass points for earth surface
function generateLandPoints(): [number, number][] {
  const points: [number, number][] = [];
  // Sample continents roughly by polygon bounding boxes
  const landBoxes = [
    // North America
    { minLat: 25, maxLat: 65, minLng: -130, maxLng: -65, step: 6 },
    // South America
    { minLat: -50, maxLat: 10, minLng: -80, maxLng: -35, step: 7 },
    // Europe
    { minLat: 36, maxLat: 68, minLng: -10, maxLng: 40, step: 5 },
    // Africa
    { minLat: -35, maxLat: 35, minLng: -15, maxLng: 50, step: 6 },
    // Asia
    { minLat: 10, maxLat: 70, minLng: 45, maxLng: 145, step: 6 },
    // Australia & NZ
    { minLat: -42, maxLat: -12, minLng: 112, maxLng: 154, step: 7 },
    // Japan
    { minLat: 30, maxLat: 45, minLng: 128, maxLng: 146, step: 4 },
    // UK
    { minLat: 50, maxLat: 58, minLng: -6, maxLng: 2, step: 4 }
  ];

  for (const box of landBoxes) {
    for (let lat = box.minLat; lat <= box.maxLat; lat += box.step) {
      for (let lng = box.minLng; lng <= box.maxLng; lng += box.step) {
        const jitterLat = lat + (Math.sin(lat * 12 + lng) * 0.8);
        const jitterLng = lng + (Math.cos(lat + lng * 15) * 0.8);
        points.push([jitterLat, jitterLng]);
      }
    }
  }
  return points;
}

const LAND_POINTS = generateLandPoints();

export function ServerGlobe({ nodes, nameByUuid, className = "" }: ServerGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<number>(1.2);
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number>(0);

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
        rotationRef.current += 0.0035; // Slow rotation
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

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.38;
      const rot = rotationRef.current;
      const tilt = 0.22;

      // 1. Atmosphere halo
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.25);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.12)");
      haloGrad.addColorStop(0.5, "rgba(243, 128, 32, 0.06)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // 2. Earth base dark globe sphere
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.1,
        cx,
        cy,
        radius
      );
      sphereGrad.addColorStop(0, "#1c2333");
      sphereGrad.addColorStop(0.7, "#111622");
      sphereGrad.addColorStop(1, "#0a0d14");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Projection: lat/lng to 3D
      const project = (lat: number, lng: number): { x: number; y: number; z: number; visible: boolean } => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng * (Math.PI / 180)) + rot;

        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);

        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;

        return {
          x: cx + x * radius,
          y: cy - y2 * radius,
          z: z2,
          visible: z2 > -0.15
        };
      };

      // 3. Draw Land Dots
      for (const [lat, lng] of LAND_POINTS) {
        const p = project(lat, lng);
        if (p.visible && p.z > 0) {
          const alpha = Math.min(1, Math.max(0.1, p.z));
          ctx.fillStyle = `rgba(100, 116, 139, ${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Draw Active VPS Location Markers
      const visibleMarkers: {
        loc: NodeLocation;
        p: { x: number; y: number; z: number };
      }[] = [];

      for (const loc of activeLocations) {
        const p = project(loc.lat, loc.lng);
        if (p.z > 0.05) {
          visibleMarkers.push({ loc, p });
        }
      }

      visibleMarkers.sort((a, b) => a.p.z - b.p.z);

      for (const { loc, p } of visibleMarkers) {
        const alpha = Math.min(1, Math.max(0.2, (p.z - 0.05) / 0.5));
        const pulseSize = 3 + Math.sin(pulseTime * 2.5) * 2;

        // Outer pulsing ripple ring
        ctx.strokeStyle = `rgba(243, 128, 32, ${alpha * 0.75})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseSize + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Core dot
        ctx.fillStyle = loc.online ? "#f38020" : "#94a3b8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Beacon vertical line
        const beaconHeight = 24 * p.z;
        ctx.strokeStyle = `rgba(243, 128, 32, ${alpha * 0.8})`;
        ctx.lineWidth = 1;
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
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = "rgba(243, 128, 32, 0.45)";
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
  }, [activeLocations]);

  return (
    <div
      ref={containerRef}
      className={`server-globe-card relative overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col items-center justify-center ${className}`}
      style={{
        minHeight: "330px",
        height: "100%",
        background: "radial-gradient(circle at 50% 50%, rgba(243, 128, 32, 0.05) 0%, rgba(15, 20, 28, 0.95) 75%)",
        borderRadius: "22px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.6)"
      }}
    >
      <div className="absolute top-4 left-5 flex items-center gap-2 pointer-events-none z-10">
        <span className="w-2 h-2 rounded-full bg-[#f38020] animate-ping" />
        <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
          Global Nodes ({activeLocations.length})
        </span>
      </div>

      <div className="absolute top-4 right-5 text-[11px] text-white/40 pointer-events-none z-10">
        可拖拽旋转 3D 地球
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%", minHeight: "300px" }}
      />
    </div>
  );
}
