// Simple shared state — no external library needed yet
export type ClockState = {
  ip: string | null;
  connected: boolean;
  deviceName: string;
  version: string;
  ws: WebSocket | null;
  ledColors: [number, number, number][];
};

export const defaultState: ClockState = {
  ip: null,
  connected: false,
  deviceName: "",
  version: "",
  ws: null,
  ledColors: Array(34).fill([30, 30, 30]),
};