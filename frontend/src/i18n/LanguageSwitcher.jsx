import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === 'bn' ? 'en' : 'bn';

  return (
    <button
      type="button"
      className={`language-switcher ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        setLanguage(nextLanguage);
      }}
      aria-label={t(nextLanguage === 'bn' ? 'Switch to Bengali' : 'Switch to English')}
      title={t(nextLanguage === 'bn' ? 'Switch to Bengali' : 'Switch to English')}
      aria-live="polite"
    >
      <Languages size={16} aria-hidden="true" />
      <span>{nextLanguage === 'bn' ? 'বাংলা' : 'English'}</span>
    </button>
  );
}
