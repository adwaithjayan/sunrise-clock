"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── Segment layout matching your exact LED mapping ───────────────────────────
// Each segment: [x, y, width, height] in mm-scale units
// Segments order: a b c d e f g
const SEG_H_W = 1.8; // horizontal segment width
const SEG_H_H = 0.4; // horizontal segment height
const SEG_V_W = 0.4; // vertical segment width
const SEG_V_H = 1.6; // vertical segment height
const DIG_W   = 2.2;
const DIG_H   = 4.0;
const GAP     = 0.6; // gap between digits

// segments for one digit at origin (a,b,c,d,e,f,g)
function digitSegments(ox: number, oy: number = 0) {
  return [
    // a — top horizontal
    { x: ox + 0.2,           y: oy + DIG_H - SEG_H_H, w: SEG_H_W, h: SEG_H_H },
    // b — top-right vertical
    { x: ox + DIG_W - SEG_V_W, y: oy + DIG_H/2,        w: SEG_V_W, h: SEG_V_H },
    // c — bottom-right vertical
    { x: ox + DIG_W - SEG_V_W, y: oy,                   w: SEG_V_W, h: SEG_V_H },
    // d — bottom horizontal
    { x: ox + 0.2,           y: oy,                     w: SEG_H_W, h: SEG_H_H },
    // e — bottom-left vertical
    { x: ox,                 y: oy,                     w: SEG_V_W, h: SEG_V_H },
    // f — top-left vertical
    { x: ox,                 y: oy + DIG_H/2,           w: SEG_V_W, h: SEG_V_H },
    // g — middle horizontal
    { x: ox + 0.2, y: oy + DIG_H/2 - SEG_H_H/2,        w: SEG_H_W, h: SEG_H_H },
  ];
}

const DIGITS_SEGMENTS = [
  digitSegments(0),
  digitSegments(DIG_W + GAP),
  digitSegments((DIG_W + GAP) * 2 + GAP * 2), // extra gap for colon
  digitSegments((DIG_W + GAP) * 3 + GAP * 2),
];

// Colon dots
const COLON_X = (DIG_W + GAP) * 2 + GAP * 0.5;
const COLON = [
  { x: COLON_X, y: DIG_H * 0.65, w: 0.35, h: 0.35 },
  { x: COLON_X, y: DIG_H * 0.28, w: 0.35, h: 0.35 },
];

const DIGIT_PATTERNS = [
  [1,1,1,1,1,1,0], // 0
  [0,1,1,0,0,0,0], // 1
  [1,1,0,1,1,0,1], // 2
  [1,1,1,1,0,0,1], // 3
  [0,1,1,0,0,1,1], // 4
  [1,0,1,1,0,1,1], // 5
  [1,0,1,1,1,1,1], // 6
  [1,1,1,0,0,0,0], // 7
  [1,1,1,1,1,1,1], // 8
  [1,1,1,1,0,1,1], // 9
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

type Props = { ip: string };

export default function ClockDisplay({ ip }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const sceneRef   = useRef<THREE.Scene | null>(null);
  const meshesRef  = useRef<THREE.Mesh[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const colorRef   = useRef("#ff8c00");

  const [color, setColor]     = useState("#ff8c00");
  const [time, setTime]       = useState({ h: 0, m: 0 });
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build Three.js scene ──────────────────────────────────────────────────
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
    sceneRef.current = scene;

    const totalW = (DIG_W + GAP) * 4 + GAP * 2;
    const camera = new THREE.OrthographicCamera(
      -totalW / 2 - 0.5, totalW / 2 + 0.5,
       DIG_H / 2 + 0.8, -DIG_H / 2 - 0.8,
      0.1, 100
    );
    camera.position.z = 10;

    // Background panel
    const bgGeo  = new THREE.PlaneGeometry(totalW + 1.5, DIG_H + 1.8);
    const bgMat  = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(totalW / 2 - 0.1, DIG_H / 2, -0.1);
    scene.add(bgMesh);

    const meshes: THREE.Mesh[] = [];

    // Build segment meshes for all 4 digits
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

    // Colon meshes
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

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // ── Update segment colors when time or color changes ─────────────────────
  const updateDisplay = useCallback((h: number, m: number, hex: string) => {
    const meshes = meshesRef.current;
    if (!meshes.length) return;
    const { r, g, b } = hexToRgb(hex);
    const onColor  = new THREE.Color(r / 255, g / 255, b / 255);
    const offColor = new THREE.Color(0x1a1a1a);

    const digits = [
      Math.floor(h / 10), h % 10,
      Math.floor(m / 10), m % 10,
    ];

    let idx = 0;
    digits.forEach((d) => {
      const pattern = DIGIT_PATTERNS[d];
      for (let s = 0; s < 7; s++) {
        (meshes[idx].material as THREE.MeshBasicMaterial).color.set(
          pattern[s] ? onColor : offColor
        );
        idx++;
      }
    });

    // Colon — always on in preview
    for (let c = 0; c < 2; c++) {
      (meshes[idx].material as THREE.MeshBasicMaterial).color.set(onColor);
      idx++;
    }
  }, []);

  // Poll time from clock every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`http://${ip}/time`);
        const data = await res.json();
        setTime({ h: data.h, m: data.m });
        updateDisplay(data.h, data.m, colorRef.current);
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [ip]);

  // ── Send color to clock, debounced 80ms ──────────────────────────────────
  const onColorChange = useCallback((hex: string) => {
    setColor(hex);
    colorRef.current = hex;
    const { r, g, b } = hexToRgb(hex);
    updateDisplay(time.h, time.m, hex);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch(`http://${ip}/color`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ r, g, b }),
        });
      } catch {}
    }, 80);
  }, [ip, time]);

  return (
    <div className="flex flex-col gap-4 p-4 border border-gray-700 rounded-xl">
      <h2 className="text-sm text-gray-400 uppercase tracking-wider">Display</h2>

      {/* Three.js preview */}
      <div
        ref={mountRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: 220, background: "#111" }}
      />

      {/* Color picker row */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">Color</label>
        <div className="relative">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
            style={{ appearance: "none" }}
          />
        </div>
        <span className="text-sm text-gray-500 font-mono">{color.toUpperCase()}</span>

        {/* Quick presets */}
        <div className="flex gap-2 ml-auto">
          {[
            { hex: "#ff8c00", label: "Amber"  },
            { hex: "#ffffff", label: "White"  },
            { hex: "#ff3c00", label: "Red"    },
            { hex: "#00cfff", label: "Cyan"   },
            { hex: "#00ff88", label: "Green"  },
          ].map((p) => (
            <button
              key={p.hex}
              title={p.label}
              onClick={() => onColorChange(p.hex)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background:   p.hex,
                borderColor:  color === p.hex ? "#fff" : "transparent",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}