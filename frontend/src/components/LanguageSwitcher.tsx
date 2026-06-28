import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('settings.language')}</span>
      <select
        value={i18n.language}
        onChange={handleChange}
        aria-label={t('settings.language')}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
