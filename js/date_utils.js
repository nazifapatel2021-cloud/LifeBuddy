/* LifeBuddy Date Parsing & Normalization Utilities */

/**
 * Returns local date string in YYYY-MM-DD format (locale-aware, not UTC shifted)
 */
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes any date string (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO timestamp)
 * into a canonical YYYY-MM-DD string for reliable lexicographical comparison.
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // 2. YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10).replace(/\//g, '-');
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Fallback native Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return trimmed;
}

/**
 * Formats canonical date string into human-friendly representation:
 * "Today", "Tomorrow", "Yesterday", or "Mon, 16 Nov".
 */
export function formatFriendlyDate(dateStr) {
  const norm = normalizeDate(dateStr);
  if (!norm) return '';
  const today = getLocalDateString();
  if (norm === today) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (norm === getLocalDateString(tomorrow)) return 'Tomorrow';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (norm === getLocalDateString(yesterday)) return 'Yesterday';

  const [y, m, d] = norm.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Formats YYYY-MM into "Month Year" (e.g. "November 2026")
 */
export function formatMonthDisplay(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const dt = new Date(year, month - 1, 1);
  return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

