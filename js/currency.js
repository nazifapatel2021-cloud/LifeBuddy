/* LifeBuddy Unified Currency Formatter (en-IN / INR)
   - Single source of truth for all currency formatting across the entire app
   - Indian numbering system (e.g., ₹25,000, ₹1,50,000)
*/

export function formatCurrency(amount, options = {}) {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : Number(amount) || 0;
  const decimals = options.decimals !== undefined ? options.decimals : 0;
  
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }).format(num);
  } catch (e) {
    // Fallback if Intl is unavailable
    const parts = num.toFixed(decimals).split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    
    // Indian digit grouping: last 3 digits, then groups of 2
    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return '₹' + formattedInteger + decimalPart;
  }
}

export function parseCurrencyInput(value) {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
