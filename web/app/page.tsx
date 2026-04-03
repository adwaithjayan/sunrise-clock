"use client";
import { useClock } from "@/lib/useClock";
import ConnectionBar from "@/components/ConnectionBar";
import OtaPanel from "@/components/OtaPanel";
import ClockDisplay from "@/components/ClockDisplay";

export default function Home() {
  const hook = useClock();
  const { state } = hook;

  return (
    <main className="max-w-xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-amber-400 tracking-widest">
        🌅 SUNRISE CLOCK
      </h1>

      <ConnectionBar hook={hook} />

      {state.connected && state.ip && (
        <>
          <ClockDisplay ip={state.ip} />
          <OtaPanel ip={state.ip} />
        </>
      )}
    </main>
  );
}