"use client";

import ClockDisplay from "@/components/ClockDisplay";

type Props = { ip: string };

export default function ClockTab({ ip }: Props) {
  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <ClockDisplay ip={ip} />
      </div>
    </div>
  );
}