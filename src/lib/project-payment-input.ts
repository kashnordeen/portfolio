// UX guidance only. The backend independently enforces the approved payment range.
export function projectAmountPaise(input: string): number | null {
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return paise >= 20000 && paise <= 5000000 ? paise : null;
}

export function projectAmountError(input: string): string {
  if (!input || projectAmountPaise(input) !== null) return '';
  return /^\d+(\.\d{1,2})?$/.test(input)
    ? 'Enter an agreed amount between ₹200 and ₹50,000.'
    : 'Use numbers and up to two decimal places, for example 1250.50.';
}
