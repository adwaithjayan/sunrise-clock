"use client";
import { useState } from "react";
import { useClock } from "@/lib/useClock";
import ConnectionBar from "@/components/ConnectionBar";
import TabBar, { Tab } from "@/components/TabBar";
import AlarmTab from "@/tabs/AlarmTab";
import SunriseTab from "@/tabs/SunriseTab";
import DisplayTab from "@/tabs/DisplayTab";
import SettingsTab from "@/tabs/SettingsTab";
import ClockTab from "@/tabs/ClockTab";


export default function Home() {
  const hook        = useClock();
  const { state }   = hook;
  const [tab, setTab] = useState<Tab>("clock");

  return (
<div className="flex flex-col h-dvh w-full max-w-xl lg:max-w-4xl xl:max-w-6xl mx-auto bg-black overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-lg font-bold text-amber-400 tracking-widest">
          🌅 SUNRISE CLOCK
        </h1>
      </div>

      {/* Connection bar */}
      <div className="px-4 pb-3 shrink-0">
        <ConnectionBar hook={hook} />
      </div>

      {/* Tabs — only show when connected */}
      {state.connected && state.ip ? (
        <>
          <TabBar active={tab} onChange={setTab} />

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {tab === "clock"    && <ClockTab ip={state.ip} />}
            {tab === "alarm"    && <AlarmTab    />}
            {tab === "sunrise"  && <SunriseTab  />}
            {tab === "display"  && <DisplayTab  />}
            {tab === "settings" && (
              <SettingsTab ip={state.ip} deviceName={state.deviceName} />
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-700 text-sm">
            Connect to your clock to continue
          </p>
        </div>
      )}

    </div>
  );
}