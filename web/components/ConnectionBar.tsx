"use client";
import { useState } from "react";
import { useClock } from "../lib/useClock";

type Props = {
  hook: ReturnType<typeof useClock>;
};

export default function ConnectionBar({ hook }: Props) {
  const { state, connect, disconnect } = hook;
  const [manualIp, setManualIp] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  // ── Already connected — show minimal locked bar ──
  if (state.connected) {
    return (
      <div className="flex items-center justify-between px-4 py-3 border border-gray-700 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-300">
            {state.deviceName}
          </span>
          <span className="text-xs text-gray-600">
            {state.ip} · {state.version}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          disconnect
        </button>
      </div>
    );
  }

  // ── Not connected — show full connection panel ──
  async function scan() {
    setScanning(true);
    setError("");
    const bases = ["192.168.1", "192.168.0", "10.0.0"];
    for (const base of bases) {
      for (let i = 2; i <= 254; i++) {
        try {
          const res = await fetch(`http://${base}.${i}/discover`, {
            signal: AbortSignal.timeout(250),
          });
          if (res.ok) {
            const ok = await connect(`${base}.${i}`);
            if (ok) { setScanning(false); return; }
          }
        } catch {}
      }
    }
    setError("Clock not found. Enter IP manually.");
    setScanning(false);
  }

  async function connectManual() {
    if (!manualIp.trim()) return;
    setError("");
    const ok = await connect(manualIp.trim());
    if (!ok) setError("Could not reach clock at that IP.");
  }

  return (
    <div className="flex flex-col gap-4 p-4 border border-gray-700 rounded-xl">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm text-gray-400">Not connected</span>
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
      >
        {scanning ? "Scanning network…" : "Find Clock"}
      </button>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          placeholder="192.168.1.x"
          value={manualIp}
          onChange={(e) => setManualIp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connectManual()}
        />
        <button
          onClick={connectManual}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Connect
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}