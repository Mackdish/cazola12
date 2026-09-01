/**
 * Server-only payment configuration service.
 *
 * Provides access to supported currencies, payment providers,
 * and payment methods. All data comes from database configuration tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type CurrencyConfig = {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  countryCode: string;
  countryName: string;
  active: boolean;
  minimumDeposit: number;
  decimalPlaces: number;
};

export type PaymentProvider = {
  id: string;
  name: string;
  displayName: string;
  apiBaseUrl: string;
  active: boolean;
  supportedCountries: string[];
  supportedCurrencies: string[];
};

export type PaymentMethod = {
  id: string;
  name: string;
  displayName: string;
  countryCode: string;
  currencyCode: string;
  providerId: string;
  providerName: string;
  active: boolean;
  minimumAmount: number;
  maximumAmount: number | null;
  iconUrl: string | null;
  description: string | null;
};

export class PaymentConfigError extends Error {}

function fail(message: string): never {
  throw new PaymentConfigError(message);
}

export async function getSupportedCurrencies(supabase: Client): Promise<CurrencyConfig[]> {
  const { data, error } = await (supabase as any)
    .from("supported_currencies")
    .select("*")
    .eq("active", true)
    .order("currency_code");

  if (error) fail("We couldn't load supported currencies.");

  return (data ?? []).map((row: any) => ({
    currencyCode: row.currency_code,
    currencyName: row.currency_name,
    symbol: row.symbol,
    countryCode: row.country_code,
    countryName: row.country_name,
    active: row.active,
    minimumDeposit: Number(row.minimum_deposit),
    decimalPlaces: row.decimal_places,
  }));
}

export async function getActivePaymentMethods(
  supabase: Client,
  countryCode: string,
  currencyCode: string,
): Promise<PaymentMethod[]> {
  const { data, error } = await (supabase as any)
    .from("payment_methods")
    .select("*, payment_providers(name)")
    .eq("country_code", countryCode)
    .eq("currency_code", currencyCode)
    .eq("active", true)
    .order("display_name");

  if (error) fail("We couldn't load payment methods.");

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    countryCode: row.country_code,
    currencyCode: row.currency_code,
    providerId: row.provider_id,
    providerName: row.payment_providers?.name ?? "",
    active: row.active,
    minimumAmount: Number(row.minimum_amount),
    maximumAmount: row.maximum_amount ? Number(row.maximum_amount) : null,
    iconUrl: row.icon_url,
    description: row.description,
  }));
}

export async function getPaymentProvider(
  supabase: Client,
  providerId: string,
): Promise<PaymentProvider | null> {
  const { data, error } = await (supabase as any)
    .from("payment_providers")
    .select("*")
    .eq("id", providerId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    displayName: data.display_name,
    apiBaseUrl: data.api_base_url,
    active: data.active,
    supportedCountries: data.supported_countries ?? [],
    supportedCurrencies: data.supported_currencies ?? [],
  };
}

export async function getCurrencyConfig(
  supabase: Client,
  currencyCode: string,
): Promise<CurrencyConfig | null> {
  const { data, error } = await (supabase as any)
    .from("supported_currencies")
    .select("*")
    .eq("currency_code", currencyCode)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    currencyCode: data.currency_code,
    currencyName: data.currency_name,
    symbol: data.symbol,
    countryCode: data.country_code,
    countryName: data.country_name,
    active: data.active,
    minimumDeposit: Number(data.minimum_deposit),
    decimalPlaces: data.decimal_places,
  };
}
