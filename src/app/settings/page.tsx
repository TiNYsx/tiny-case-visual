'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Globe, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [language, setLanguage] = useState(i18n.language);

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <div className="min-h-screen bg-grid bg-gradient-radial">
      <header className="glass border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="sm" className="!p-1.5" onClick={() => router.push('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg sm:text-xl font-bold">{t('nav.settings')}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 sm:p-6"
        >
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('nav.settings')}
          </h2>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="text-sm text-text-muted mb-2 block">Language / ภาษา</label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => changeLanguage('th')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-xl border transition-all text-sm sm:text-base ${language === 'th' ? 'border-accent bg-accent/10' : 'border-border hover:border-border-hover'}`}
                >
                  <span className="text-lg">🇹🇭</span>
                  <span className="ml-1 sm:ml-2">ไทย</span>
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-xl border transition-all text-sm sm:text-base ${language === 'en' ? 'border-accent bg-accent/10' : 'border-border hover:border-border-hover'}`}
                >
                  <span className="text-lg">🇬🇧</span>
                  <span className="ml-1 sm:ml-2">English</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}