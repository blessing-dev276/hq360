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
