import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { bnMessages } from './messages';

const LANGUAGE_KEY = 'safeher-language';
const LanguageContext = createContext(null);

function readInitialLanguage() {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'bn' || saved === 'en') return saved;
  } catch {
    // Storage may be disabled; use the browser's language preference instead.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('bn')
    ? 'bn'
    : 'en';
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'bn' ? 'bn-BD' : 'en';
    document.title = language === 'bn'
      ? 'SafeHer — বাংলাদেশের নিরাপত্তার সঙ্গী'
      : 'SafeHer — Help, kept close';
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = language === 'bn'
        ? 'SafeHer বাংলাদেশে বিশ্বস্ত যোগাযোগ, SOS, লাইভ লোকেশন শেয়ার এবং সীমিত এলাকার রুটের অনুমান একসঙ্গে রাখে।'
        : 'SafeHer is a Bengali-first safety companion for Bangladesh with trusted contacts, a hold-to-activate SOS, live location sharing, and limited-area route estimates.';
    }
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // The current in-memory selection still works for this visit.
    }
  }, [language]);

  const t = useCallback((message, values = {}) => {
    const template = language === 'bn' ? (bnMessages[message] || message) : message;
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
  }, [language]);

  const context = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, t]);

  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
