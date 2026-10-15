// Thai baht amount in words, e.g. 1250.50 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์".
// Follows the same conventions as Excel's BAHTTEXT (เอ็ด, ยี่สิบ, ล้าน grouping).

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// Reads up to six digits. `hasHigher` = a higher group (ล้าน) precedes it.
function readGroup(digits: string, hasHigher: boolean) {
  const s = digits.replace(/^0+/, "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - i - 1;
    if (d === 0) continue;
    if (place === 0 && d === 1 && (s.length > 1 || hasHigher)) out += "เอ็ด";
    else if (place === 1 && d === 1) out += "";
    else if (place === 1 && d === 2) out += "ยี่";
    else out += DIGITS[d];
    out += PLACES[place];
  }
  return out;
}

function readInteger(digits: string): string {
  if (digits.length <= 6) return readGroup(digits, false);
  const head = digits.slice(0, -6);
  const tail = digits.slice(-6);
  return readInteger(head) + "ล้าน" + readGroup(tail, true);
}

export function bahtText(value: string | number) {
  const n = Math.abs(Number(value) || 0);
  const [bahtPart, satangPart] = n.toFixed(2).split(".");
  const baht = bahtPart.replace(/^0+/, "");
  const satang = Number(satangPart);

  if (!baht && !satang) return "ศูนย์บาทถ้วน";
  const bahtWords = baht ? `${readInteger(baht)}บาท` : "";
  const satangWords = satang ? `${readGroup(satangPart, false)}สตางค์` : "ถ้วน";
  return bahtWords + satangWords;
}
