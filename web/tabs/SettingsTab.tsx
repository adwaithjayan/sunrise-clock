"use client";
import OtaPanel from "@/components/OtaPanel";
import { useState } from "react";

type Props = { ip: string; deviceName: string };

export default function SettingsTab({ ip, deviceName }: Props) {
  const [name, setName]         = useState(deviceName);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [otaOpen, setOtaOpen]   = useState(false);

  async function saveName() {
    setSaving(true);
    try {
      await fetch(`http://${ip}/settings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function forgetWifi() {
    if (!confirm("This will wipe WiFi credentials and reboot the clock into setup mode. Continue?")) return;
    await fetch(`http://${ip}/wifi/forget`, { method: "POST" });
  }

  return (
    <div className="flex flex-col gap-6 p-4">

      {/* Device name */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-gray-500 uppercase tracking-widest">Device</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            placeholder="Device name"
          />
          <button
            onClick={saveName}
            disabled={saving || name === deviceName}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? "Saved ✓" : saving ? "…" : "Save"}
          </button>
        </div>
      </section>

      {/* WiFi */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-gray-500 uppercase tracking-widest">WiFi</h2>
        <button
          onClick={forgetWifi}
          className="w-full py-2.5 border border-red-900 text-red-400 hover:bg-red-900/20 rounded-lg text-sm transition-colors"
        >
          Forget WiFi &amp; reboot to setup mode
        </button>
      </section>

      {/* OTA — collapsible */}
      <section className="flex flex-col gap-3">
        <button
          onClick={() => setOtaOpen(o => !o)}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-xs text-gray-500 uppercase tracking-widest">
            Firmware Update
          </h2>
          <span className="text-gray-600 text-sm">
            {otaOpen ? "▲ hide" : "▼ show"}
          </span>
        </button>
        {otaOpen && <OtaPanel ip={ip} />}
      </section>

    </div>
  );
}