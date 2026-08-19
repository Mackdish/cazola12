import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DateRange } from "@/hooks/use-analytics";

const PRESETS = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "7 days", key: "7d" },
  { label: "30 days", key: "30d" },
  { label: "Custom", key: "custom" },
];

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? date.toISOString();
}

function toDateRange(preset: string): DateRange {
  const now = new Date();
  const to = toDateString(now);
  switch (preset) {
    case "today":
      return { from: to, to };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const yesterday = toDateString(d);
      return { from: yesterday, to: yesterday };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toDateString(d), to };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toDateString(d), to };
    }
    default:
      return { from: to, to };
  }
}

export function AnalyticsDateFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [preset, setPreset] = useState<string>("7d");

  const handlePresetChange = (key: string) => {
    setPreset(key);
    if (key !== "custom") {
      onChange(toDateRange(key));
    }
  };

  const handleFromChange = (from: string) => {
    setPreset("custom");
    onChange({ ...value, from });
  };

  const handleToChange = (to: string) => {
    setPreset("custom");
    onChange({ ...value, to });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={preset} onValueChange={handlePresetChange}>
        <TabsList>
          {PRESETS.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">From</span>
        <input
          type="date"
          value={value.from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
        />
        <span className="text-muted-foreground">To</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => handleToChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

export function CsvExportButton({
  onExport,
  disabled,
}: {
  onExport: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onExport} disabled={disabled}>
      <Download className="mr-2 size-3.5" />
      Export CSV
    </Button>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  format = "number",
  currency = "USD",
}: {
  label: string;
  value: number;
  hint?: string;
  format?: "number" | "currency" | "percent";
  currency?: string;
}) {
  const display =
    format === "currency"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
      : format === "percent"
        ? (value * 100).toFixed(2) + "%"
        : value.toLocaleString();

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1.5">
          <p className="text-eyebrow">{label}</p>
          <p className="text-numeric text-2xl font-semibold leading-none">{display}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
