/** Customer review policy. Astra remains available to developers, never this service. */
export const CUSTOMER_MODEL_POLICY_VERSION = "anthropic-only-no-astra-v1";

export function assertCustomerModelAllowed(input: { provider: string; model: string; stage?: string }): void {
  const model = input.model.toLowerCase();
  if (input.provider !== "anthropic" || model.includes("astra") ||
      !/^claude-(sonnet|haiku)-[a-z0-9][a-z0-9.-]*$/.test(model) || model !== input.model) {
    throw new Error("Customer model blocked by provider policy.");
  }
}
