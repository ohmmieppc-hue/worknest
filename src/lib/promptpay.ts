// Thai QR Payment (PromptPay) payload, EMVCo merchant-presented format.
// https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf

const field = (id: string, value: string) => `${id}${value.length.toString().padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo.
export function crc16(input: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * @param target 10-digit mobile number or 13-digit national/tax ID
 * @param amount baht; omit for an open-amount QR
 */
export function promptPayPayload(target: string, amount?: number) {
  const id = target.replace(/\D/g, "");
  let account: string;
  if (id.length === 10) {
    // Mobile: 0066 + number without the leading 0, 13 digits in total.
    account = field("01", `0066${id.slice(1)}`);
  } else if (id.length === 13) {
    account = field("02", id);
  } else {
    throw new Error("PromptPay target must be a 10-digit phone or 13-digit ID");
  }

  const hasAmount = amount != null && amount > 0;
  const body =
    field("00", "01") +
    field("01", hasAmount ? "12" : "11") +
    field("29", field("00", "A000000677010111") + account) +
    field("53", "764") +
    (hasAmount ? field("54", amount.toFixed(2)) : "") +
    field("58", "TH") +
    "6304";
  return body + crc16(body);
}
