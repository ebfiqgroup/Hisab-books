import { Wifi, WifiOff, Loader2 } from "lucide-react";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

export function RealtimeStatusBadge({ status }: { status: RealtimeStatus }) {
  const map = {
    connected: {
      label: "লাইভ",
      title: "রিয়েলটাইম সংযোগ সক্রিয়",
      icon: <Wifi className="w-3.5 h-3.5" />,
      color: "#16a34a",
      bg: "color-mix(in oklab, #16a34a 12%, transparent)",
      border: "color-mix(in oklab, #16a34a 35%, transparent)",
      dot: "#16a34a",
      pulse: true,
    },
    connecting: {
      label: "সংযোগ হচ্ছে",
      title: "রিয়েলটাইম সংযোগ স্থাপন হচ্ছে",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      color: "#d97706",
      bg: "color-mix(in oklab, #d97706 12%, transparent)",
      border: "color-mix(in oklab, #d97706 35%, transparent)",
      dot: "#d97706",
      pulse: false,
    },
    disconnected: {
      label: "অফলাইন",
      title: "রিয়েলটাইম সংযোগ বিচ্ছিন্ন",
      icon: <WifiOff className="w-3.5 h-3.5" />,
      color: "#e11d48",
      bg: "color-mix(in oklab, #e11d48 12%, transparent)",
      border: "color-mix(in oklab, #e11d48 35%, transparent)",
      dot: "#e11d48",
      pulse: false,
    },
  }[status];

  return (
    <div
      title={map.title}
      aria-label={map.title}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium"
      style={{ background: map.bg, borderColor: map.border, color: map.color }}
    >
      <span className="relative flex h-2 w-2">
        {map.pulse && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
            style={{ background: map.dot }}
          />
        )}
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: map.dot }} />
      </span>
      <span className="hidden sm:inline">{map.label}</span>
    </div>
  );
}