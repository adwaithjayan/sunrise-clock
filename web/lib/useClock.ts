"use client";
import { useState, useCallback, useRef } from "react";
import { ClockState, defaultState } from "./clockStore";

export function useClock() {
  const [state, setState] = useState<ClockState>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);

  const discover = useCallback(async (ip: string) => {
    try {
      const res = await fetch(`http://${ip}/discover`);
      const data = await res.json();
      setState(s => ({
        ...s,
        ip,
        deviceName: data.name,
        version: data.version,
        connected: true,
      }));
      // Save IP for next visit
      localStorage.setItem("clockIp", ip);
      // Open WebSocket
      const socket = new WebSocket(`ws://${ip}:81`);
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "led_state") {
          setState(s => ({ ...s, ledColors: msg.leds }));
        }
        if (msg.type === "ota_progress") {
          setState(s => ({ ...s, otaProgress: msg.pct } as any));
        }
      };
      socket.onclose = () => setState(s => ({ ...s, connected: false }));
      wsRef.current = socket;
      setState(s => ({ ...s, ws: socket }));
    } catch {
      setState(s => ({ ...s, connected: false }));
    }
  }, []);

  const checkSavedIp = useCallback(() => {
    const saved = localStorage.getItem("clockIp");
    if (saved) discover(saved);
  }, [discover]);

  return { state, discover, checkSavedIp };
}