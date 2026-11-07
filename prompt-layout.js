// Binary searches keep long pasted commands as cheap to edit as short ones.
export function visibleInput(chars, caret, available, measure) {
  let low = 0, high = caret;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (measure(chars.slice(mid, caret).join('')) <= available) high = mid;
    else low = mid + 1;
  }
  const start = low;
  low = caret; high = chars.length;
  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    if (measure(chars.slice(start, mid).join('')) <= available) low = mid;
    else high = mid - 1;
  }
  return { start, end: low };
}
