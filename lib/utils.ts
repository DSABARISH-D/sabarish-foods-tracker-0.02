import { ExpenseCategory, InventoryItem, KadanStatus, SaleCategory } from '@/types';

// ── Date Utilities ─────────────────────────────────────────────────────
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string, locale: 'ta' | 'en' = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDate();
}

export function isPastDue(dateStr: string): boolean {
  const today = getTodayDate();
  return dateStr < today;
}

export function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function getWeekDates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getLast6Months(): { start: string; label: string }[] {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    months.push({
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return months;
}

// ── Currency ───────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(num: number): string {
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-IN');
}

// ── Greeting ───────────────────────────────────────────────────────────
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ── Category Helpers ───────────────────────────────────────────────────
export const EXPENSE_CATEGORY_EMOJIS: Record<ExpenseCategory, string> = {
  chicken_cost: '🐔',
  store_purchases: '🏪',
  market_purchases: '🛒',
  indian_market: '🌶️',
  electricity: '⚡',
  gas_cylinder: '🔥',
  staff: '👥',
  transport: '🚗',
  other: '📦',
};

export const INVENTORY_EMOJIS: Record<InventoryItem, string> = {
  chicken: '🐔',
  oil: '🛢️',
  masala: '🌶️',
  rice: '🍚',
  gas: '🔥',
  other: '📦',
};

export const INVENTORY_UNITS: Record<InventoryItem, string> = {
  chicken: 'kg',
  oil: 'litres',
  masala: 'kg',
  rice: 'kg',
  gas: 'cylinders',
  other: 'units',
};

export const INVENTORY_THRESHOLDS: Record<InventoryItem, number> = {
  chicken: 10,
  oil: 5,
  masala: 2,
  rice: 20,
  gas: 1,
  other: 1,
};

export const SALE_CATEGORY_LABELS: Record<SaleCategory, string> = {
  rice_meals: 'Rice Meals',
  noodles: 'Noodles',
  tiffin: 'Tiffin',
  beverages: 'Beverages',
  other: 'Other',
};

// ── Kadan Status Colors ────────────────────────────────────────────────
export const KADAN_STATUS_COLORS: Record<KadanStatus, string> = {
  pending: '#F59E0B',
  paid: '#22C55E',
  overdue: '#EF4444',
};

// ── Validation ─────────────────────────────────────────────────────────
export function validateMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

export function validateAmount(amount: string): boolean {
  const n = parseFloat(amount);
  return !isNaN(n) && n > 0;
}

// ── WhatsApp ───────────────────────────────────────────────────────────
export function buildWhatsAppURL(mobile: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/91${mobile}?text=${encoded}`;
}

// ── UUID ───────────────────────────────────────────────────────────────
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ── Debounce ───────────────────────────────────────────────────────────
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}
