/**
 * Server-only payment routing service.
 *
 * Determines the appropriate payment provider based on country, currency,
 * and payment method. Ensures payments are routed through compatible providers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getPaymentProvider, getActivePaymentMethods, getCurrencyConfig } from "@/lib/payment-config.server";

type Client = SupabaseClient<Database>;

export class PaymentRoutingError extends Error {}

function fail(message: string): never {
  throw new PaymentRoutingError(message);
}

export async function resolvePaymentRoute(
  supabase: Client,
  input: {
    countryCode: string;
    currencyCode: string;
    paymentMethodId?: string;
  },
) {
  const currency = await getCurrencyConfig(supabase, input.currencyCode);
  if (!currency) {
    fail("Currency not supported.");
  }

  if (currency.countryCode !== input.countryCode) {
    fail("Currency and country do not match.");
  }

  const methods = await getActivePaymentMethods(supabase, input.countryCode, input.currencyCode);

  if (input.paymentMethodId) {
    const method = methods.find((m) => m.id === input.paymentMethodId);
    if (!method) {
      fail("Payment method not available for this country/currency.");
    }

    const provider = await getPaymentProvider(supabase, method.providerId);
    if (!provider) {
      fail("Payment provider not available.");
    }

    return {
      currency,
      method,
      provider,
    };
  }

  if (methods.length === 0) {
    fail("Payment method currently unavailable for this country/currency.");
  }

  const method = methods[0]!;
  const provider = await getPaymentProvider(supabase, method.providerId);
  if (!provider) {
    fail("Payment provider not available.");
  }

  return {
    currency,
    method,
    provider,
  };
}
