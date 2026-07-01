import { useUIStore } from '@/store';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { useEffect } from 'react';

export function useTranslation() {
  const language = useUIStore((s) => s.language);
  const { t: i18nT, i18n } = useI18nextTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    return i18nT(key, params) as unknown as string;
  };

  return { t, language };
}
