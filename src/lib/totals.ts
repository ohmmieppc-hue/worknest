// Client-side preview of the totals the database computes in
// documents_before_write(). The database stays the source of truth.

export interface LineInput {
  quantity: string;
  unit_price: string;
  discount_amount: string;
}

const toCents = (v: string | number) => Math.round((Number(v) || 0) * 100);

export function lineAmountCents(line: LineInput) {
  // round(quantity * unit_price - discount, 2)
  const qty = Number(line.quantity) || 0;
  return Math.round(qty * toCents(line.unit_price)) - toCents(line.discount_amount);
}

export function computeTotals(
  lines: LineInput[],
  opts: { discount: string; whtRate: string; vatRate?: string },
) {
  const subtotal = lines.reduce((sum, l) => sum + lineAmountCents(l), 0);
  const discount = toCents(opts.discount);
  const base = subtotal - discount;
  const vat = Math.round((base * (Number(opts.vatRate) || 0)) / 100);
  const total = base + vat;
  const wht = Math.round((base * (Number(opts.whtRate) || 0)) / 100);
  return {
    subtotal: subtotal / 100,
    discount: discount / 100,
    vat: vat / 100,
    total: total / 100,
    wht: wht / 100,
    payable: (total - wht) / 100,
    discountTooLarge: discount > subtotal,
  };
}
