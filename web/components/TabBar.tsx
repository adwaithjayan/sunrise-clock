"use client";

export type Tab = "clock" | "alarm" | "sunrise" | "display" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "clock",    label: "Clock",    icon: "🕐" },
  { id: "alarm",    label: "Alarm",    icon: "⏰" },
  { id: "sunrise",  label: "Sunrise",  icon: "🌅" },
  { id: "display",  label: "Display",  icon: "💡" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export default function TabBar({ active, onChange }: Props) {
  return (
    <div className="flex border-b border-gray-800 bg-black sticky top-0 z-10">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium
            transition-colors border-b-2
            ${active === tab.id
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-gray-600 hover:text-gray-400"
            }
          `}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="tracking-wide">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}