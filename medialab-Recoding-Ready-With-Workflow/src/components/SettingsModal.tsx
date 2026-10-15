import React from 'react';
import {
  X,
  Sliders,
  MousePointer,
  Volume2,
  Mic,
  Timer,
  Keyboard,
  Clock,
} from 'lucide-react';
import {
  ToggleSettings,
  StorageSettings,
  SharpnessMode,
  VideoFormat,
} from '../types/recorder';
import { Language, translations } from '../utils/translations';

interface SettingsModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  toggles: ToggleSettings;
  setToggles: React.Dispatch<React.SetStateAction<ToggleSettings>>;
  storage: StorageSettings;
  setStorage: React.Dispatch<React.SetStateAction<StorageSettings>>;
  sharpness: SharpnessMode;
  setSharpness: (mode: SharpnessMode) => void;
  videoFormat: VideoFormat;
  setVideoFormat: (fmt: VideoFormat) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  lang,
  isOpen,
  onClose,
  toggles,
  setToggles,
  storage,
  setStorage,
  sharpness,
  setSharpness,
  videoFormat,
  setVideoFormat,
}) => {
  if (!isOpen) return null;
  const t = translations[lang];

  const handleToggle = (key: keyof ToggleSettings) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAutoStopHoursChange = (hrs: number) => {
    const safeHrs = Math.max(0, Math.min(24, hrs || 0));
    setToggles((prev) => ({
      ...prev,
      autoStopHours: safeHrs,
    }));
  };

  const handleAutoStopMinutesChange = (mins: number) => {
    const safeMins = Math.max(0, Math.min(59, mins || 0));
    setToggles((prev) => ({
      ...prev,
      autoStopMinutes: safeMins,
    }));
  };

  const handleAutoStopSecondsChange = (secs: number) => {
    const safeSecs = Math.max(0, Math.min(59, secs || 0));
    setToggles((prev) => ({
      ...prev,
      autoStopSeconds: safeSecs,
    }));
  };

  const applyPreset = (hrs: number, mins: number, secs: number) => {
    setToggles((prev) => ({
      ...prev,
      autoStopHours: hrs,
      autoStopMinutes: mins,
      autoStopSeconds: secs,
    }));
  };

  const totalAutoStopSecs =
    (toggles.autoStopHours || 0) * 3600 +
    (toggles.autoStopMinutes || 0) * 60 +
    (toggles.autoStopSeconds || 0);

  const formatTargetDuration = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 p-6 animate-in zoom-in-95 duration-150 text-[#1E1D1B]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F4F3F0] border border-[#E5E2DC] flex items-center justify-center text-[#D85631]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1D1B]">{t.settingsTitle}</h3>
              <p className="text-[11px] text-[#7E7B75]">{t.settingsDesc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F4F3F0] flex items-center justify-center text-[#7E7B75] hover:text-[#1E1D1B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Audio & Cursor */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-[#7E7B75] uppercase tracking-wider">
            {t.audioAndCursor}
          </div>

          <div className="space-y-2">
            <div
              onClick={() => handleToggle('hideCursor')}
              className="p-3 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] hover:border-[#D5D2CB] transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <MousePointer className="w-4 h-4 text-[#7E7B75]" />
                <span className="text-xs font-bold text-[#1E1D1B]">{t.hideCursor}</span>
              </div>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  toggles.hideCursor ? 'bg-[#D85631]' : 'bg-[#D5D2CB]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                    toggles.hideCursor ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <div
              onClick={() => handleToggle('systemAudio')}
              className="p-3 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] hover:border-[#D5D2CB] transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-[#7E7B75]" />
                <span className="text-xs font-bold text-[#1E1D1B]">{t.systemAudio}</span>
              </div>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  toggles.systemAudio ? 'bg-[#D85631]' : 'bg-[#D5D2CB]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                    toggles.systemAudio ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <div
              onClick={() => handleToggle('micAudio')}
              className="p-3 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] hover:border-[#D5D2CB] transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-[#7E7B75]" />
                <span className="text-xs font-bold text-[#1E1D1B]">{t.micAudio}</span>
              </div>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  toggles.micAudio ? 'bg-[#D85631]' : 'bg-[#D5D2CB]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                    toggles.micAudio ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <div
              onClick={() => handleToggle('countdown3s')}
              className="p-3 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] hover:border-[#D5D2CB] transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Timer className="w-4 h-4 text-[#7E7B75]" />
                <span className="text-xs font-bold text-[#1E1D1B]">{t.countdown}</span>
              </div>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  toggles.countdown3s ? 'bg-[#D85631]' : 'bg-[#D5D2CB]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                    toggles.countdown3s ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Auto-Stop Timer (Requested feature) */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-[#7E7B75] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D85631]" />
            <span>{t.autoStopTitle}</span>
          </div>

          <div className="p-3.5 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] space-y-3">
            {/* Toggle switch for auto-stop */}
            <div
              onClick={() => handleToggle('autoStopEnabled')}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#1E1D1B] block">
                  {t.autoStopLabel}
                </span>
                <span className="text-[11px] text-[#7E7B75] block">
                  {t.autoStopTargetNotice} {formatTargetDuration(totalAutoStopSecs > 0 ? totalAutoStopSecs : 300)}
                </span>
              </div>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                  toggles.autoStopEnabled ? 'bg-[#D85631]' : 'bg-[#D5D2CB]'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                    toggles.autoStopEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Custom Hours, Minutes, Seconds Inputs & Preset Pills */}
            {toggles.autoStopEnabled && (
              <div className="pt-3 border-t border-[#E5E2DC] space-y-3 animate-in fade-in duration-150">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-[#7E7B75] font-bold block">
                    {t.autoStopDuration}
                  </span>

                  {/* 3 Input Columns: Hours, Minutes, Seconds */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Hours */}
                    <div className="p-2 bg-[#F4F3F0] border border-[#E5E2DC] rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-[#7E7B75] font-bold mb-1">
                        {t.autoStopHours}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={toggles.autoStopHours ?? 0}
                        onChange={(e) => handleAutoStopHoursChange(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#D85631] rounded-lg py-1 px-1 text-sm font-mono font-bold text-center text-[#1E1D1B] outline-none"
                      />
                    </div>

                    {/* Minutes */}
                    <div className="p-2 bg-[#F4F3F0] border border-[#E5E2DC] rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-[#7E7B75] font-bold mb-1">
                        {t.autoStopMinutes}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={toggles.autoStopMinutes ?? 0}
                        onChange={(e) => handleAutoStopMinutesChange(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#D85631] rounded-lg py-1 px-1 text-sm font-mono font-bold text-center text-[#1E1D1B] outline-none"
                      />
                    </div>

                    {/* Seconds */}
                    <div className="p-2 bg-[#F4F3F0] border border-[#E5E2DC] rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-[#7E7B75] font-bold mb-1">
                        {t.autoStopSeconds}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={toggles.autoStopSeconds ?? 0}
                        onChange={(e) => handleAutoStopSecondsChange(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-[#E5E2DC] focus:border-[#D85631] rounded-lg py-1 px-1 text-sm font-mono font-bold text-center text-[#1E1D1B] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Preset Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-[#7E7B75] font-bold uppercase tracking-wider block">
                    {lang === 'en' ? 'Quick Presets' : 'اختيارات سريعة للمدة'}
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: t.preset30s, h: 0, m: 0, s: 30 },
                      { label: t.preset1m, h: 0, m: 1, s: 0 },
                      { label: t.preset2m, h: 0, m: 2, s: 0 },
                      { label: t.preset5m, h: 0, m: 5, s: 0 },
                      { label: t.preset10m, h: 0, m: 10, s: 0 },
                      { label: t.preset15m, h: 0, m: 15, s: 0 },
                      { label: t.preset30m, h: 0, m: 30, s: 0 },
                      { label: t.preset60m, h: 1, m: 0, s: 0 },
                    ].map((preset) => {
                      const isSelected =
                        (toggles.autoStopHours || 0) === preset.h &&
                        (toggles.autoStopMinutes || 0) === preset.m &&
                        (toggles.autoStopSeconds || 0) === preset.s;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset.h, preset.m, preset.s)}
                          className={`py-1.5 px-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer text-center ${
                            isSelected
                              ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
                              : 'bg-[#F4F3F0] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#EAE8E2]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Notice Banner */}
                <div className="p-2.5 bg-[#F4F3F0] rounded-xl border border-[#E5E2DC] flex items-center justify-between text-xs">
                  <span className="text-[#7E7B75] font-bold">
                    {t.autoStopTargetNotice}
                  </span>
                  <span className="text-[#D85631] font-mono font-black text-xs bg-white px-2 py-0.5 rounded border border-[#E5E2DC]">
                    {formatTargetDuration(totalAutoStopSecs)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Bitrate & Quality */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-[#7E7B75] uppercase tracking-wider">
            {t.bitrateTitle}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ultra', label: t.ultraQuality },
              { id: 'high', label: t.highQuality },
              { id: 'balanced', label: t.balancedQuality },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSharpness(item.id as SharpnessMode)}
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer truncate ${
                  sharpness === item.id
                    ? 'bg-[#D85631] text-white border-[#D85631]'
                    : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F4F3F0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Format */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-[#7E7B75] uppercase tracking-wider">
            {t.formatTitle}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['mp4', 'mkv', 'mov'] as VideoFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setVideoFormat(fmt)}
                className={`py-2 px-2 text-xs font-bold rounded-xl uppercase font-mono border transition-colors cursor-pointer ${
                  videoFormat === fmt
                    ? 'bg-[#D85631] text-white border-[#D85631]'
                    : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F4F3F0]'
                }`}
              >
                .{fmt}
              </button>
            ))}
          </div>

          <div className="p-2.5 bg-[#F4F3F0] rounded-xl border border-[#E5E2DC] flex items-center justify-between text-xs">
            <span className="font-bold text-[#1E1D1B]">{t.autoSequential}</span>
            <span className="text-[#D85631] font-mono font-bold text-[11px]">
              {t.activeDefault}
            </span>
          </div>
        </div>

        {/* Section 5: Hotkeys */}
        <div className="space-y-2 pt-2 border-t border-[#E5E2DC]">
          <div className="text-[11px] font-bold text-[#7E7B75] uppercase tracking-wider flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            <span>{t.shortcutsTitle}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] flex items-center justify-between">
              <span className="truncate">{t.startStopKey}</span>
              <kbd className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E5E2DC] text-[10px]">
                Ctrl+Shift+R
              </kbd>
            </div>
            <div className="p-2 bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] flex items-center justify-between">
              <span className="truncate">{t.pauseResumeKey}</span>
              <kbd className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E5E2DC] text-[10px]">
                Ctrl+Shift+P
              </kbd>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#E5E2DC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#D85631] hover:bg-[#C24623] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {t.saveAndClose}
          </button>
        </div>
      </div>
    </div>
  );
};
