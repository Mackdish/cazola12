import { BarChart3, Globe2, Megaphone } from "lucide-react";

import { useInView } from "@/hooks/use-in-view";
import { useCountUp } from "@/hooks/use-count-up";
import { usePlatformStats } from "@/hooks/use-platform-stats";

function StatCounter({
  icon: Icon,
  label,
  value,
  active,
  suffix = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  active: boolean;
  suffix?: string;
}) {
  const display = useCountUp(value, active);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-white/10 text-mkt-emerald">
        <Icon className="size-5" />
      </div>
      <p className="text-numeric mt-4 text-3xl font-semibold text-white sm:text-4xl">
        {display.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

/**
 * Live platform metrics, pulled from the real database via fetchPlatformStats.
 * Counters animate up once the section scrolls into view. No numbers are invented;
 * if the platform is early-stage and counts are low, that's what's shown.
 */
export function PlatformMetrics() {
  const { ref, inView } = useInView();
  const stats = usePlatformStats();

  const data = stats.data ?? { advertisers: 0, publishers: 0, websites: 0, monthlyImpressions: 0 };
  const active = inView && stats.isSuccess;

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCounter icon={Megaphone} label="Advertisers" value={data.advertisers} active={active} />
      <StatCounter icon={Globe2} label="Publishers" value={data.publishers} active={active} />
      <StatCounter icon={BarChart3} label="Active Websites" value={data.websites} active={active} />
    </div>
  );
}
