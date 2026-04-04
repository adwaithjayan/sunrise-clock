"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { ClockState, defaultState } from "./clockStore";

export function useClock() {
  const [state, setState] = useState<ClockState>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async (ip: string) => {
    try {
      const res = await fetch(`http://${ip}/discover`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error("no response");
      const data = await res.json();

      localStorage.setItem("clockIp", ip);

      setState(s => ({
        ...s,
        ip,
        deviceName: data.name,
        version: data.version,
        connected: true,
      }));

      // Open WebSocket
      if (wsRef.current) wsRef.current.close();
      const socket = new WebSocket(`ws://${ip}:81`);
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "led_state")
          setState(s => ({ ...s, ledColors: msg.leds }));
        if (msg.type === "ota_progress")
          setState(s => ({ ...s, otaProgress: msg.pct } as any));
      };
      socket.onclose = () => {
        setState(s => ({ ...s, connected: false }));
      };
      wsRef.current = socket;
      setState(s => ({ ...s, ws: socket }));
      return true;
    } catch {
      return false;
    }
  }, []);

  // On mount — try saved IP silently, no UI flash
  useEffect(() => {
    const saved = localStorage.getItem("clockIp");
    if (saved) connect(saved);
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem("clockIp");
    wsRef.current?.close();
    setState(defaultState);
  }, []);

  return { state, connect, disconnect };
}