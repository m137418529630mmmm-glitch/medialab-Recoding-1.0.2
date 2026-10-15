import React from 'react';
import {
  Settings as SettingsIcon,
  Pause,
  Play,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { MediaLabLogo } from './MediaLabLogo';

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
  onOpenSettings: () => void;
  recordingStatus: 'idle' | 'countdown' | 'recording' | 'paused';
  recordingTimer: string;
  onStopRecording: () => void;
  onPauseResumeRecording: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  onOpenSettings,
  recordingStatus,
  recordingTimer,
  onStopRecording,
  onPauseResumeRecording,
}) => {
  const t = translations[lang];

  const isRecordingOrPaused = recordingStatus === 'recording' || recordingStatus === 'paused';

  return (
    <header className="bg-[#F4F3F0] border-b border-[#E5E2DC] sticky top-0 z-40">
      <div className="max-w-xl mx-auto px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo Area: Exact mediaLab publishing logo without any square box */}
          <div className="flex items-center">
<MediaLabLogo className="h-10 sm:h-11 w-auto" />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5">
            {/* Active Recording status pill in header */}
            {isRecordingOrPaused && (
              <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#D85631] rounded-xl px-2.5 py-1 shadow-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    recordingStatus === 'recording' ? 'bg-[#D85631] animate-ping' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono text-xs font-bold text-[#1E1D1B] tabular-nums">
                  {recordingTimer}
                </span>
                <button
                  onClick={onPauseResumeRecording}
                  className="p-0.5 text-[#7E7B75] hover:text-[#1E1D1B]"
                >
                  {recordingStatus === 'recording' ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 text-emerald-600" />
                  )}
                </button>
                <button
                  onClick={onStopRecording}
                  className="px-2 py-0.5 bg-[#D85631] hover:bg-[#C24623] text-white text-[10px] font-bold rounded"
                >
                  {t.stopRecording}
                </button>
              </div>
            )}

            {/* Language Switcher (EN | AR) - Default EN, stable orientation */}
            <div className="flex items-center bg-[#FFFFFF] border border-[#E5E2DC] rounded-xl p-0.5 text-xs font-bold shadow-sm">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-[#D85631] text-white shadow-sm'
                    : 'text-[#7E7B75] hover:text-[#1E1D1B]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ar')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === 'ar'
                    ? 'bg-[#D85631] text-white shadow-sm'
                    : 'text-[#7E7B75] hover:text-[#1E1D1B]'
                }`}
              >
                AR
              </button>
            </div>

            {/* Settings Button */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F9F8F6] text-[#1E1D1B] text-xs font-bold rounded-xl border border-[#E5E2DC] shadow-sm transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[#7E7B75]" />
              <span>{t.settings}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
