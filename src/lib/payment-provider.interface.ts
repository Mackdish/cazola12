/**
 * Standard payment provider interface.
 *
 * All payment providers must implement this contract.
 * This keeps the wallet/billing engine provider-agnostic.
 */

export type PaymentInitializeInput = {
  amount: number;
  currency: string;
  reference: string;
  phoneNumber?: string;
  description?: string;
  callbackUrl: string;
  customerEmail?: string;
  customerName?: string;
  /** When true, use the provider's hosted checkout page instead of an STK push. */
  hostedCheckout?: boolean;
  redirectUrl?: string;
  cancelUrl?: string;
};


export type PaymentInitializeResult = {
  paymentUrl: string;
  reference: string;
  providerReference?: string;
  status: string;
};

export type PaymentVerificationResult = {
  reference: string;
  status: string;
  amount?: number;
  currency?: string;
  providerTransactionId?: string;
  providerReceipt?: string;
};

export type WebhookVerificationResult = {
  valid: boolean;
  payload: unknown;
};

export interface PaymentProvider {
  readonly name: string;

  initializePayment(input: PaymentInitializeInput): Promise<PaymentInitializeResult>;

  verifyPayment(reference: string): Promise<PaymentVerificationResult>;

  verifyWebhookSignature(payload: string, signature: string | null): boolean;

  getPaymentStatus?(reference: string): Promise<{ status: string }>;
}
