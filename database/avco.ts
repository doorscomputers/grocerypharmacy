/**
 * Perpetual Weighted Average Cost (Moving Average Cost / AVCO).
 *
 * Formula:
 *   new_avco = (current_qty × current_avco + incoming_qty × incoming_cost)
 *              ÷ (current_qty + incoming_qty)
 *
 * Used on EVERY purchase receiving (GRN) to update products.cost.
 * The AVCO chain originates from Beginning Inventory entered via
 * InitialInventoryScreen — that is the cost anchor for a new business.
 *
 * All quantities and costs are expected to be expressed in the product's
 * SELLING UNIT (purchase qty must already be converted via conversion_factor).
 */

export function computeNewAvco(
  currentQty: number,
  currentAvco: number,
  incomingQty: number,
  incomingCost: number
): number {
  const cq = Number(currentQty) || 0;
  const ca = Number(currentAvco) || 0;
  const iq = Number(incomingQty) || 0;
  const ic = Number(incomingCost) || 0;

  if (iq <= 0) return ca;

  if (cq <= 0 || ca <= 0) {
    return ic;
  }

  const totalQty = cq + iq;
  if (totalQty <= 0) return ca;

  return (cq * ca + iq * ic) / totalQty;
}

export function roundAvco(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
