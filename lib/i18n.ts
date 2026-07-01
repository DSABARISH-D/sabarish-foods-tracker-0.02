import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import translations
import ta from '@/locales/ta.json';
import en from '@/locales/en.json';

const resources = {
  ta: { translation: ta },
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ta', // Default language is Tamil
    fallbackLng: 'ta',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export { i18n };

export function setLocale(locale: 'ta' | 'en') {
  i18n.changeLanguage(locale);
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
