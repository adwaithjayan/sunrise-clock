"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Slider } from "@/components/ui/slider";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SEG_H_W = 1.8;
const SEG_H_H = 0.4;
const SEG_V_W = 0.4;
const SEG_V_H = 1.6;
const DIG_W   = 2.2;
const DIG_H   = 4.0;
const GAP     = 0.6;

// Indicator LEDs — vertical column left of display
const IND_W     = 0.5;
const IND_H     = 0.5;
const IND_GAP   = 0.4;
const IND_X     = -1.4; // left of display
const IND_START_Y = DIG_H - IND_H;

const INDICATORS = [0, 1, 2, 3].map((i) => ({
  x: IND_X,
  y: IND_START_Y - i * (IND_H + IND_GAP),
  w: IND_W,
  h: IND_H,
}));

function digitSegments(ox: number, oy: number = 0) {
  return [
    { x: ox + 0.2,              y: oy + DIG_H - SEG_H_H, w: SEG_H_W, h: SEG_H_H }, // a
    { x: ox + DIG_W - SEG_V_W, y: oy + DIG_H / 2,        w: SEG_V_W, h: SEG_V_H }, // b
    { x: ox + DIG_W - SEG_V_W, y: oy,                     w: SEG_V_W, h: SEG_V_H }, // c
    { x: ox + 0.2,              y: oy,                     w: SEG_H_W, h: SEG_H_H }, // d
    { x: ox,                    y: oy,                     w: SEG_V_W, h: SEG_V_H }, // e
    { x: ox,                    y: oy + DIG_H / 2,         w: SEG_V_W, h: SEG_V_H }, // f
    { x: ox + 0.2, y: oy + DIG_H / 2 - SEG_H_H / 2,       w: SEG_H_W, h: SEG_H_H }, // g
  ];
}

const DIGITS_SEGMENTS = [
  digitSegments(0),
  digitSegments(DIG_W + GAP),
  digitSegments((DIG_W + GAP) * 2 + GAP * 2),
  digitSegments((DIG_W + GAP) * 3 + GAP * 2),
];

const COLON_X = (DIG_W + GAP) * 2 + GAP * 0.5;
const COLON = [
  { x: COLON_X, y: DIG_H * 0.65, w: 0.35, h: 0.35 },
  { x: COLON_X, y: DIG_H * 0.28, w: 0.35, h: 0.35 },
];

const DIGIT_PATTERNS = [
  [1,1,1,1,1,1,0],
  [0,1,1,0,0,0,0],
  [1,1,0,1,1,0,1],
  [1,1,1,1,0,0,1],
  [0,1,1,0,0,1,1],
  [1,0,1,1,0,1,1],
  [1,0,1,1,1,1,1],
  [1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,0,1,1],
];

// Indicator colors matching firmware
const IND_COLORS = [
  new THREE.Color(1, 0.9, 0.7),   // 0 AM/PM — warm white
  new THREE.Color(0, 0.8, 0.2),   // 1 WiFi — green
  new THREE.Color(0, 0.8, 0.2),   // 2 Battery — green
  new THREE.Color(1, 0.6, 0),     // 3 Alarm — amber
];

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

type Props = { ip: string };

export default function ClockDisplay({ ip }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const meshesRef   = useRef<THREE.Mesh[]>([]);
  const indMeshRef  = useRef<THREE.Mesh[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const readyRef    = useRef(false);
  const colorRef    = useRef("#ff8c00");
  const timeRef     = useRef({ h: 0, m: 0 });

  const [color, setColor]       = useState("#ff8c00");
  const [brightness, setBrightness] = useState(80);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorSendRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = 220;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene  = new THREE.Scene();
    const totalW = (DIG_W + GAP) * 4 + GAP * 2;

    // Camera — wider to fit indicators
    const camera = new THREE.OrthographicCamera(
      -totalW / 2 - 2.0, totalW / 2 + 0.8,
       DIG_H / 2 + 0.8,  -DIG_H / 2 - 0.8,
      0.1, 100
    );
    camera.position.z = 10;

    // Background
    const bgW  = totalW + 3.2;
    const bgGeo = new THREE.PlaneGeometry(bgW, DIG_H + 1.8);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(totalW / 2 - 0.1 - 0.7, DIG_H / 2, -0.1);
    scene.add(bgMesh);

    const meshes: THREE.Mesh[] = [];

    // Digit segments
    DIGITS_SEGMENTS.forEach((segs) => {
      segs.forEach((seg) => {
        const geo  = new THREE.PlaneGeometry(seg.w, seg.h);
        const mat  = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          seg.x + seg.w / 2 - totalW / 2 + 0.1,
          seg.y + seg.h / 2 - DIG_H / 2,
          0
        );
        scene.add(mesh);
        meshes.push(mesh);
      });
    });

    // Colon
    COLON.forEach((dot) => {
      const geo  = new THREE.PlaneGeometry(dot.w, dot.h);
      const mat  = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        dot.x + dot.w / 2 - totalW / 2 + 0.1,
        dot.y + dot.h / 2 - DIG_H / 2,
        0
      );
      scene.add(mesh);
      meshes.push(mesh);
    });

    meshesRef.current = meshes;

    // Indicator LEDs
    const indMeshes: THREE.Mesh[] = [];
    INDICATORS.forEach((ind, i) => {
      // Glow bg circle
      const glowGeo = new THREE.CircleGeometry(IND_W * 0.8, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: IND_COLORS[i],
        transparent: true,
        opacity: 0.15,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(
        ind.x + ind.w / 2 - totalW / 2 + 0.1,
        ind.y + ind.h / 2 - DIG_H / 2,
        -0.05
      );
      scene.add(glow);

      // LED dot
      const geo  = new THREE.CircleGeometry(IND_W * 0.35, 16);
      const mat  = new THREE.MeshBasicMaterial({ color: IND_COLORS[i] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        ind.x + ind.w / 2 - totalW / 2 + 0.1,
        ind.y + ind.h / 2 - DIG_H / 2,
        0
      );
      scene.add(mesh);
      indMeshes.push(mesh);
    });

    indMeshRef.current = indMeshes;
    readyRef.current = true;

    // Initial render
    updateDisplay(timeRef.current.h, timeRef.current.m, colorRef.current, meshes);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      readyRef.current = false;
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement))
        mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // ── Update segments ──────────────────────────────────────────────────────
  const updateDisplay = useCallback((
    h: number, m: number, hex: string,
    meshOverride?: THREE.Mesh[]
  ) => {
    const meshes = meshOverride ?? meshesRef.current;
    if (!meshes.length) return;
    const { r, g, b } = hexToRgb(hex);
    const onColor  = new THREE.Color(r / 255, g / 255, b / 255);
    const offColor = new THREE.Color(0x1a1a1a);
    const digs = [Math.floor(h / 10), h % 10, Math.floor(m / 10), m % 10];

    let idx = 0;
    digs.forEach((d) => {
      DIGIT_PATTERNS[d].forEach((on) => {
        (meshes[idx++].material as THREE.MeshBasicMaterial).color
          .set(on ? onColor : offColor);
      });
    });
    // Colon always on
    for (let c = 0; c < 2; c++) {
      (meshes[idx++].material as THREE.MeshBasicMaterial).color.set(onColor);
    }
  }, []);

  // ── Poll time every second ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchTime() {
      try {
        const res  = await fetch(`http://${ip}/time`,
          { signal: AbortSignal.timeout(800) });
        const data = await res.json();
        timeRef.current = { h: data.h, m: data.m };
        if (readyRef.current)
          updateDisplay(data.h, data.m, colorRef.current);
      } catch {}
    }
    fetchTime();
    const id = setInterval(fetchTime, 1000);
    return () => clearInterval(id);
  }, [ip, updateDisplay]);

  // ── Color change — instant preview, throttled send ───────────────────────
  const onColorChange = useCallback((hex: string) => {
    setColor(hex);
    colorRef.current = hex;
    if (readyRef.current)
      updateDisplay(timeRef.current.h, timeRef.current.m, hex);

    // Throttle network sends to max 1 per 150ms
    if (colorSendRef.current) return;
    colorSendRef.current = setTimeout(async () => {
      colorSendRef.current = null;
      const { r, g, b } = hexToRgb(colorRef.current);
      try {
        await fetch(`http://${ip}/color`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ r, g, b }),
        });
      } catch {}
    }, 150);
  }, [ip, updateDisplay]);

  // ── Brightness send ──────────────────────────────────────────────────────
  const onBrightnessChange = useCallback((val: number[]) => {
    setBrightness(val[0]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch(`http://${ip}/brightness`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ value: val[0] }),
        });
      } catch {}
    }, 200);
  }, [ip]);

  return (
    <div className="flex flex-col gap-5 p-4 border border-gray-800 rounded-xl bg-gray-950">
      <p className="text-xs text-gray-500 uppercase tracking-widest">Display</p>

      {/* Three.js preview */}
      <div
        ref={mountRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: 220 }}
      />

      {/* Color row */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400 w-16">Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
        />
        <span className="text-sm text-gray-500 font-mono">{color.toUpperCase()}</span>
        <div className="flex gap-2 ml-auto">
          {[
            { hex: "#ff8c00", label: "Amber" },
            { hex: "#ffffff", label: "White" },
            { hex: "#ff3c00", label: "Red"   },
            { hex: "#00cfff", label: "Cyan"  },
            { hex: "#00ff88", label: "Green" },
          ].map((p) => (
            <button
              key={p.hex}
              title={p.label}
              onClick={() => onColorChange(p.hex)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background:  p.hex,
                borderColor: color === p.hex ? "#fff" : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      {/* Brightness row */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400 w-16">Bright</span>
        <div className="flex-1">
          <Slider
            value={[brightness]}
            onValueChange={onBrightnessChange}
            min={5} max={255} step={1}
          />
        </div>
        <span className="text-sm text-gray-500 font-mono w-8 text-right">
          {brightness}
        </span>
      </div>
    </div>
  );
}