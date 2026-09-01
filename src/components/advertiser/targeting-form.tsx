import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveTargeting } from "@/hooks/use-advertiser";
import {
  BROWSER_OPTIONS,
  DEVICE_OPTIONS,
  OS_OPTIONS,
  parseSchedule,
  WEEKDAYS,
  type BrowserType,
  type CampaignTargeting,
  type DeviceType,
  type OsType,
  type Weekday,
} from "@/lib/advertiser-domain";
import { toFriendlyError } from "@/lib/errors";
import { WEBSITE_CATEGORIES, type WebsiteCategory } from "@/lib/publisher-domain";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function TargetingForm({
  campaignId,
  targeting,
  readOnly,
}: {
  campaignId: string;
  targeting: CampaignTargeting | null;
  readOnly?: boolean | undefined;
}) {
  const save = useSaveTargeting();
  const initialSchedule = parseSchedule(targeting?.schedule);

  const [countries, setCountries] = useState((targeting?.countries ?? []).join(", "));
  const [counties, setCounties] = useState((targeting?.counties ?? []).join(", "));
  const [cities, setCities] = useState((targeting?.cities ?? []).join(", "));
  const [devices, setDevices] = useState<DeviceType[]>((targeting?.devices ?? []) as DeviceType[]);
  const [systems, setSystems] = useState<OsType[]>(
    (targeting?.operating_systems ?? []) as OsType[],
  );
  const [browsers, setBrowsers] = useState<BrowserType[]>(
    (targeting?.browsers ?? []) as BrowserType[],
  );
  const [categories, setCategories] = useState<WebsiteCategory[]>(
    (targeting?.website_categories ?? []) as WebsiteCategory[],
  );
  const [days, setDays] = useState<Weekday[]>(
    WEEKDAYS.filter((day) => (initialSchedule[day]?.length ?? 0) > 0),
  );
  const [startHour, setStartHour] = useState(
    String(initialSchedule[days[0] ?? "mon"]?.[0]?.start ?? 0),
  );
  const [endHour, setEndHour] = useState(String(initialSchedule[days[0] ?? "mon"]?.[0]?.end ?? 24));

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  async function submit() {
    const start = Number(startHour);
    const end = Number(endHour);
    if (
      days.length > 0 &&
      (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end > 24 || start >= end)
    ) {
      toast.error("Pick an hour window between 0 and 24, with the start before the end.");
      return;
    }
    const schedule: Record<string, Array<{ start: number; end: number }>> = {};
    for (const day of days) schedule[day] = [{ start, end }];

    try {
      await save.mutateAsync({
        campaignId,
        countries: parseList(countries),
        counties: parseList(counties),
        cities: parseList(cities),
        devices,
        operatingSystems: systems,
        browsers,
        websiteCategories: categories,
        schedule,
      });
      toast.success("Targeting saved.");
    } catch (error) {
      toast.error(toFriendlyError(error, "We couldn't save targeting").message);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Targeting uses deterministic rules: leaving a group empty means "match everything" for that
        dimension.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="target-countries">Countries</Label>
          <Input
            id="target-countries"
            placeholder="KE, UG, TZ"
            value={countries}
            disabled={readOnly}
            onChange={(event) => setCountries(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target-counties">Counties / regions</Label>
          <Input
            id="target-counties"
            placeholder="Nairobi, Kiambu"
            value={counties}
            disabled={readOnly}
            onChange={(event) => setCounties(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target-cities">Cities</Label>
          <Input
            id="target-cities"
            placeholder="Nairobi, Mombasa"
            value={cities}
            disabled={readOnly}
            onChange={(event) => setCities(event.target.value)}
          />
        </div>
      </div>

      <CheckGroup
        legend="Devices"
        options={DEVICE_OPTIONS}
        selected={devices}
        disabled={readOnly}
        onToggle={(value) => toggle(devices, value, setDevices)}
      />
      <CheckGroup
        legend="Operating systems"
        options={OS_OPTIONS}
        selected={systems}
        disabled={readOnly}
        onToggle={(value) => toggle(systems, value, setSystems)}
      />
      <CheckGroup
        legend="Browsers"
        options={BROWSER_OPTIONS}
        selected={browsers}
        disabled={readOnly}
        onToggle={(value) => toggle(browsers, value, setBrowsers)}
      />
      <CheckGroup
        legend="Website categories"
        options={WEBSITE_CATEGORIES}
        selected={categories}
        disabled={readOnly}
        onToggle={(value) => toggle(categories, value, setCategories)}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Schedule</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={days.includes(day)}
                disabled={readOnly}
                onCheckedChange={() => toggle(days, day, setDays)}
              />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:max-w-xs sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="target-start-hour">From hour</Label>
            <Input
              id="target-start-hour"
              inputMode="numeric"
              value={startHour}
              disabled={readOnly}
              onChange={(event) => setStartHour(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-end-hour">To hour</Label>
            <Input
              id="target-end-hour"
              inputMode="numeric"
              value={endHour}
              disabled={readOnly}
              onChange={(event) => setEndHour(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
        </div>
      </fieldset>

      {!readOnly ? (
        <Button onClick={() => void submit()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save targeting"}
        </Button>
      ) : null}
    </div>
  );
}

function CheckGroup<T extends string>({
  legend,
  options,
  selected,
  disabled,
  onToggle,
}: {
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: T[];
  disabled?: boolean | undefined;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(option.value)}
              disabled={disabled}
              onCheckedChange={() => onToggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
