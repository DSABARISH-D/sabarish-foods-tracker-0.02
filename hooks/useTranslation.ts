import { useUIStore } from '@/store';
import { i18n } from '@/lib/i18n';

export function useTranslation() {
  const language = useUIStore((s) => s.language);

  // Ensure i18n locale matches store
  if (i18n.locale !== language) {
    i18n.locale = language;
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    return i18n.t(key, params);
  };

  return { t, language };
}
