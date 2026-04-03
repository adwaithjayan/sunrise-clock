"use client";
import { useState, useEffect } from "react";
import { useClock } from "@/lib/useClock";
import OtaPanel from "@/components/OtaPanel";
import ConnectionBar from "@/components/ConnectionBar";

export default function Home() {
  const { state, discover, checkSavedIp } = useClock();

  useEffect(() => {
    checkSavedIp();
  }, []);

  return (
    <main className="max-w-xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-amber-400 tracking-widest">
        🌅 SUNRISE CLOCK
      </h1>
      <ConnectionBar onConnected={() => {}} />
      {state.connected && state.ip && (
        <OtaPanel ip={state.ip} />
      )}
      {!state.connected && (
        <p className="text-gray-500 text-sm">
          Connect to your clock to see controls.
        </p>
      )}
    </main>
  );
}