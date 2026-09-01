import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState, LoadingState } from "@/components/patterns/states";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";
import { usePlatformSettings, useUpdatePlatformSettings } from "@/hooks/use-admin-settings";
import { Settings, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Platform Admin — TradeMall" },
      {
        name: "description",
        content: "Platform-wide configuration: revenue share, limits and moderation rules.",
      },
      { property: "og:title", content: "Settings — Platform Admin — TradeMall" },
      {
        property: "og:description",
        content: "Platform-wide configuration: revenue share, limits and moderation rules.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const ALL_COUNTRIES = [
  "US",
  "GB",
  "CA",
  "AU",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "IE",
  "BE",
  "AT",
  "CH",
  "PT",
  "GR",
  "PL",
  "CZ",
  "HU",
  "RO",
  "BG",
  "HR",
  "SK",
  "SI",
  "LT",
  "LV",
  "EE",
  "CY",
  "MT",
  "LU",
  "JP",
  "KR",
  "SG",
  "HK",
  "NZ",
  "IL",
  "AE",
  "SA",
  "BR",
  "MX",
  "AR",
  "CL",
  "CO",
  "PE",
  "IN",
  "PK",
  "BD",
  "LK",
  "MM",
  "KH",
  "LA",
  "TH",
  "VN",
  "MY",
  "ID",
  "PH",
  "TW",
  "CN",
  "HK",
  "MO",
  "NG",
  "ZA",
  "KE",
  "EG",
  "MA",
  "TN",
  "GH",
  "ET",
  "TZ",
  "UG",
  "ZM",
  "ZW",
  "RW",
  "MZ",
  "AO",
  "CM",
  "CI",
  "SN",
  "ML",
  "BF",
  "NE",
  "TD",
  "DJ",
  "ER",
  "SO",
  "SD",
  "LY",
  "DZ",
  "MR",
  "ML",
  "GN",
  "GW",
  "SL",
  "LR",
  "GQ",
  "GA",
  "CG",
  "CD",
  "CF",
  "SS",
  "BW",
  "NA",
  "SZ",
  "LS",
  "MG",
  "MU",
  "SC",
  "KM",
  "MV",
  "FJ",
  "PG",
  "NC",
  "WS",
  "TO",
  "VU",
  "SB",
  "TL",
  "BN",
  "KH",
  "LA",
  "MM",
  "KP",
  "MN",
  "KZ",
  "UZ",
  "TM",
  "TJ",
  "KG",
  "AZ",
  "AM",
  "GE",
  "IQ",
  "IR",
  "SY",
  "LB",
  "JO",
  "PS",
  "YE",
  "OM",
  "KW",
  "QA",
  "BH",
  "CY",
  "TR",
];

const ALL_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "HRK",
  "SKK",
  "LTL",
  "LVL",
  "EEK",
  "MT",
  "IS",
  "JPY",
  "KRW",
  "SGD",
  "HKD",
  "TWD",
  "CNY",
  "INR",
  "PKR",
  "BDT",
  "LKR",
  "MMK",
  "KHR",
  "LAK",
  "THB",
  "VND",
  "MYR",
  "IDR",
  "PHP",
  "NGN",
  "ZAR",
  "KES",
  "EGP",
  "MAD",
  "TND",
  "GHS",
  "ETB",
  "TZS",
  "UGX",
  "ZMW",
  "ZWL",
  "RWF",
  "MZN",
  "AOA",
  "XAF",
  "XOF",
  "XAF",
  "XOF",
  "GNF",
  "GWP",
  "SLL",
  "LRD",
  "GMD",
  "CVE",
  "MUR",
  "SCR",
  "KMF",
  "MVR",
  "FJD",
  "PGK",
  "NZD",
  "WST",
  "TOP",
  "VUV",
  "SBD",
  "TLS",
  "BND",
];

function Page() {
  const settingsQuery = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);

  if (settingsQuery.isLoading) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Settings"
          description="Platform-wide configuration."
        />
        <LoadingState rows={6} label="Loading settings" />
      </WorkspaceGuard>
    );
  }

  if (settingsQuery.error || !settingsQuery.data) {
    return (
      <WorkspaceGuard workspace="admin">
        <PageHeader
          eyebrow="Platform Admin"
          title="Settings"
          description="Platform-wide configuration."
        />
        <ErrorState
          title="Couldn't load settings"
          message={settingsQuery.error?.message ?? "Something went wrong."}
        />
      </WorkspaceGuard>
    );
  }

  const s = settingsQuery.data;

  function handleSave() {
    update.mutate(
      {
        publisherRevenueShare: s.publisherRevenueShare,
        earningsHoldDays: s.earningsHoldDays,
        minimumPayoutAmount: s.minimumPayoutAmount,
        startingCpc: s.startingCpc,
        minimumDailyBudget: s.minimumDailyBudget,
        currency: s.currency,
        maximumBidAmount: s.maximumBidAmount,
        maximumCampaignBudget: s.maximumCampaignBudget,
        maximumDailyBudget: s.maximumDailyBudget,
        campaignMinimumBudget: s.campaignMinimumBudget,
        maximumCreativeSizeBytes: s.maximumCreativeSizeBytes,
        supportedCountries: selectedCountries.length > 0 ? selectedCountries : s.supportedCountries,
        supportedCurrencies:
          selectedCurrencies.length > 0 ? selectedCurrencies : s.supportedCurrencies,
        platformStatus: s.platformStatus,
      },
      {
        onSuccess: () => toast.success("Settings saved."),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  return (
    <WorkspaceGuard workspace="admin">
      <PageHeader
        eyebrow="Platform Admin"
        title="Settings"
        description="Platform-wide configuration: revenue share, limits and moderation rules."
        actions={
          <Button onClick={handleSave} disabled={update.isPending}>
            <Save className="size-4 mr-2" /> Save
          </Button>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" /> Billing
          </h3>
          <div className="space-y-2">
            <Label htmlFor="publisherRevenueShare">Publisher revenue share (0–1)</Label>
            <Input
              id="publisherRevenueShare"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={s.publisherRevenueShare}
              onChange={(e) =>
                settingsQuery.refetch() ||
                update.mutate({ publisherRevenueShare: Number(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Fraction of each event paid to publishers. Platform keeps the remainder.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="earningsHoldDays">Earnings hold days</Label>
            <Input
              id="earningsHoldDays"
              type="number"
              min="0"
              max="180"
              value={s.earningsHoldDays}
              onChange={(e) => update.mutate({ earningsHoldDays: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Days to hold earnings before they become available for payout.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumPayoutAmount">Minimum payout amount</Label>
            <Input
              id="minimumPayoutAmount"
              type="number"
              min="0"
              step="0.01"
              value={s.minimumPayoutAmount}
              onChange={(e) => update.mutate({ minimumPayoutAmount: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Publishers must reach this balance before requesting a payout.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" /> Pricing
          </h3>
          <div className="space-y-2">
            <Label htmlFor="startingCpc">Starting CPC ({s.currency})</Label>
            <Input
              id="startingCpc"
              type="number"
              min="0"
              step="0.01"
              value={s.startingCpc}
              onChange={(e) => update.mutate({ startingCpc: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Starting cost-per-click used for estimates and minimum bid validation.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumDailyBudget">Minimum daily budget ({s.currency})</Label>
            <Input
              id="minimumDailyBudget"
              type="number"
              min="0"
              step="0.01"
              value={s.minimumDailyBudget}
              onChange={(e) => update.mutate({ minimumDailyBudget: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Minimum allowed daily budget when creating a campaign.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={s.currency}
              onChange={(e) => update.mutate({ currency: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Default currency for pricing, billing and payouts.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" /> Campaign limits
          </h3>
          <div className="space-y-2">
            <Label htmlFor="campaignMinimumBudget">Campaign minimum budget ({s.currency})</Label>
            <Input
              id="campaignMinimumBudget"
              type="number"
              min="0"
              step="0.01"
              value={s.campaignMinimumBudget}
              onChange={(e) => update.mutate({ campaignMinimumBudget: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Minimum allowed budget when creating a campaign.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maximumBidAmount">Maximum bid amount ({s.currency})</Label>
            <Input
              id="maximumBidAmount"
              type="number"
              min="0"
              step="0.01"
              value={s.maximumBidAmount}
              onChange={(e) => update.mutate({ maximumBidAmount: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Maximum allowed bid amount per campaign.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maximumCampaignBudget">Maximum campaign budget ({s.currency})</Label>
            <Input
              id="maximumCampaignBudget"
              type="number"
              min="0"
              step="0.01"
              value={s.maximumCampaignBudget}
              onChange={(e) => update.mutate({ maximumCampaignBudget: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Maximum allowed total budget per campaign.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maximumDailyBudget">Maximum daily budget ({s.currency})</Label>
            <Input
              id="maximumDailyBudget"
              type="number"
              min="0"
              step="0.01"
              value={s.maximumDailyBudget}
              onChange={(e) => update.mutate({ maximumDailyBudget: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Maximum allowed daily budget per campaign.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maximumCreativeSizeBytes">Maximum creative size (bytes)</Label>
            <Input
              id="maximumCreativeSizeBytes"
              type="number"
              min="0"
              step="1"
              value={s.maximumCreativeSizeBytes}
              onChange={(e) => update.mutate({ maximumCreativeSizeBytes: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Maximum file size for uploaded creatives. Current:{" "}
              {(s.maximumCreativeSizeBytes / 1024 / 1024).toFixed(1)} MB.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" /> Geo & currency
          </h3>
          <div className="space-y-2">
            <Label>Supported countries</Label>
            <Select
              value=""
              onValueChange={(val) => {
                setSelectedCountries((prev) =>
                  prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
                );
              }}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Add country" />
              </SelectTrigger>
              <SelectContent>
                {ALL_COUNTRIES.filter((c) => !selectedCountries.includes(c)).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {(selectedCountries.length > 0 ? selectedCountries : s.supportedCountries ?? []).map(
                (c: string) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {c}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedCountries((prev) => prev.filter((x) => x !== c))}
                    >
                      ×
                    </button>
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Supported currencies</Label>
            <Select
              value=""
              onValueChange={(val) => {
                setSelectedCurrencies((prev) =>
                  prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
                );
              }}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Add currency" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CURRENCIES.filter((c) => !selectedCurrencies.includes(c)).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {(selectedCurrencies.length > 0 ? selectedCurrencies : s.supportedCurrencies ?? []).map(
                (c: string) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {c}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedCurrencies((prev) => prev.filter((x) => x !== c))}
                    >
                      ×
                    </button>
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="size-4" /> Platform status
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Platform status</p>
              <p className="text-xs text-muted-foreground">
                Controls whether new ads can be served.
              </p>
            </div>
            <Select
              value={s.platformStatus}
              onValueChange={(val) =>
                update.mutate({ platformStatus: val as "active" | "maintenance" | "disabled" })
              }
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      </div>
    </WorkspaceGuard>
  );
}
