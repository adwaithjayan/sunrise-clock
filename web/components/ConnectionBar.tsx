"use client";
import { useState } from "react";
import { useClock } from "@/lib/useClock";

export default function ConnectionBar({
  onConnected,
}: {
  onConnected: (state: ReturnType<typeof useClock>["state"]) => void;
}) {
  const { state, discover, checkSavedIp } = useClock();
  const [manualIp, setManualIp] = useState("");
  const [scanning, setScanning] = useState(false);

  async function scan() {
    setScanning(true);
    // Try saved IP first
    const saved = localStorage.getItem("clockIp");
    if (saved) {
      await discover(saved);
      setScanning(false);
      return;
    }
    // Scan common local IPs (192.168.1.x and 192.168.0.x)
    const bases = ["192.168.1", "192.168.0"];
    for (const base of bases) {
      for (let i = 2; i <= 254; i++) {
        try {
          const res = await fetch(`http://${base}.${i}/discover`, {
            signal: AbortSignal.timeout(300),
          });
          if (res.ok) {
            await discover(`${base}.${i}`);
            setScanning(false);
            return;
          }
        } catch {}
      }
    }
    setScanning(false);
  }

  return (
    <div className="flex flex-col gap-3 p-4 border border-gray-700 rounded-xl">
      <div className="flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${
            state.connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-sm">
          {state.connected
            ? `${state.deviceName} — ${state.ip} — ${state.version}`
            : "Not connected"}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={scan}
          disabled={scanning}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Find Clock"}
        </button>

        <input
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 text-sm"
          placeholder="Or enter IP manually e.g. 192.168.1.47"
          value={manualIp}
          onChange={(e) => setManualIp(e.target.value)}
        />
        <button
          onClick={() => discover(manualIp)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          Connect
        </button>
      </div>
    </div>
  );
}