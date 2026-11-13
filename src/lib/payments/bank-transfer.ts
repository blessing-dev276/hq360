/** Account details and receiving restrictions supplied by the account holder. */
export const bankDetails = [
  ["Account name", "Blessing Durosinmi"],
  ["IBAN", "GB04CLJU04130735848221"],
  ["SWIFT / BIC", "CLJUGB21XXX"],
  ["Account number", "35848221"],
  ["Sort code", "041307"],
  ["Bank name", "Clear Junction Limited"],
  ["Bank address", "4th Floor Imperial House, 15 Kingsway, London, United Kingdom, WC2B 6UN"],
] as const;
export const bankInstructions =
  "Send EUR only via SEPA or SEPA Instant from a bank within the EEA. Use the invoice number as your payment reference. This account does not support other currencies or SWIFT wire transfers. Payment is confirmed after HQ360 checks receipt in the bank account.";

export type BankTransferDetails = {
  instructions: string;
  fields: { label: string; value: string }[];
};
export const defaultBankTransferDetails: BankTransferDetails = {
  instructions: bankInstructions,
  fields: bankDetails.map(([label, value]) => ({ label, value })),
};

export const usdBankTransferDetails: BankTransferDetails = {
  instructions:
    "Send USD to the checking account below. Use the invoice number as your payment reference. Payment is confirmed after HQ360 checks receipt in the bank account.",
  fields: [
    { label: "Account name", value: "Emmanuel Durosinmi" },
    { label: "Bank name", value: "Lead bank" },
    { label: "Account number", value: "210683730708" },
    { label: "Account type", value: "Checking" },
    { label: "Routing number", value: "101019644" },
    { label: "Bank address", value: "1801 Main St. Kansas City, MO 64108, USA" },
  ],
};

export function defaultBankDetailsFor(currency: "USD" | "EUR", eurAmount?: number | null) {
  return currency === "USD" && !eurAmount ? usdBankTransferDetails : defaultBankTransferDetails;
}

export function invoiceBankDetails(
  value: BankTransferDetails | null | undefined,
): BankTransferDetails {
  return value ?? defaultBankTransferDetails;
}
