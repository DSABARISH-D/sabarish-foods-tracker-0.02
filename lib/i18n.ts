import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

// Import translations
import ta from '@/locales/ta.json';
import en from '@/locales/en.json';

export const i18n = new I18n({
  ta,
  en,
});

// Default language is Tamil
i18n.locale = 'ta';
i18n.enableFallback = true;
i18n.defaultLocale = 'ta';

export function setLocale(locale: 'ta' | 'en') {
  i18n.locale = locale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
