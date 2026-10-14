import React from 'react';
import {
  MousePointer,
  Volume2,
  Mic,
  Timer,
  Sliders,
  Sparkles,
  VolumeX,
  MicOff,
} from 'lucide-react';
import { ToggleSettings } from '../types/recorder';

interface AudioAndCursorTogglesProps {
  toggles: ToggleSettings;
  setToggles: React.Dispatch<React.SetStateAction<ToggleSettings>>;
}

export const AudioAndCursorToggles: React.FC<AudioAndCursorTogglesProps> = ({
  toggles,
  setToggles,
}) => {
  const [micLevel, setMicLevel] = React.useState<number>(65);
  const [systemLevel, setSystemLevel] = React.useState<number>(85);

  const handleToggle = (key: keyof ToggleSettings) => {
    setToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <section className="bg-[#111827] rounded-2xl border border-[#1F2937] p-5 lg:p-6 shadow-xl space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1F2937]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              التحكم في الماوس والصوت والخصائص الإضافية
              <span className="text-xs font-normal text-slate-400">
                (المؤشر، الصوت والبدء الذكي)
              </span>
            </h2>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>المنافذ الصوتية جاهزة</span>
        </div>
      </div>

      {/* Grid of 4 Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle 1: Hide Mouse Cursor */}
        <div
          onClick={() => handleToggle('hideCursor')}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start justify-between gap-4 ${
            toggles.hideCursor
              ? 'bg-gradient-to-r from-indigo-950/40 to-[#0B1120] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
              : 'bg-[#0B1120] border-[#1F2937] hover:border-slate-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                toggles.hideCursor
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <MousePointer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>إخفاء مؤشر الماوس أثناء التسجيل</span>
                {toggles.hideCursor && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    مخفي
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                منع ظهور حركة الماوس داخل المنطقة المسجلة نهائياً
              </p>
            </div>
          </div>

          {/* iOS-style Switch */}
          <div className="shrink-0 mt-0.5">
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                toggles.hideCursor ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  toggles.hideCursor ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Toggle 2: System Audio */}
        <div
          onClick={() => handleToggle('systemAudio')}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start justify-between gap-4 ${
            toggles.systemAudio
              ? 'bg-gradient-to-r from-indigo-950/40 to-[#0B1120] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
              : 'bg-[#0B1120] border-[#1F2937] hover:border-slate-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                toggles.systemAudio
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {toggles.systemAudio ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>تسجيل صوت النظام</span>
                {toggles.systemAudio && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    نشط
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                التقاط الصوت الداخلي للكمبيوتر بجودة نقية (Stereo 320kbps)
              </p>
              {toggles.systemAudio && (
                <div
                  className="mt-2.5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-400 font-mono">مستوى الصوت:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={systemLevel}
                    onChange={(e) => setSystemLevel(parseInt(e.target.value))}
                    className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="font-mono text-[10px] text-cyan-400 tabular-nums">
                    {systemLevel}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Switch */}
          <div className="shrink-0 mt-0.5">
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                toggles.systemAudio ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  toggles.systemAudio ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Toggle 3: Microphone Audio */}
        <div
          onClick={() => handleToggle('micAudio')}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start justify-between gap-4 ${
            toggles.micAudio
              ? 'bg-gradient-to-r from-indigo-950/40 to-[#0B1120] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
              : 'bg-[#0B1120] border-[#1F2937] hover:border-slate-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                toggles.micAudio
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {toggles.micAudio ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>تسجيل المايكروفون</span>
                {toggles.micAudio && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    موصول
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                دمج التعليق الصوتي مع التسجيل مع عزل الضوضاء الخلفية
              </p>
              {toggles.micAudio && (
                <div
                  className="mt-2.5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-400 font-mono">حساسية اللاقط:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={micLevel}
                    onChange={(e) => setMicLevel(parseInt(e.target.value))}
                    className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="font-mono text-[10px] text-cyan-400 tabular-nums">
                    {micLevel}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Switch */}
          <div className="shrink-0 mt-0.5">
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                toggles.micAudio ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  toggles.micAudio ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Toggle 4: Countdown 3s */}
        <div
          onClick={() => handleToggle('countdown3s')}
          className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start justify-between gap-4 ${
            toggles.countdown3s
              ? 'bg-gradient-to-r from-indigo-950/40 to-[#0B1120] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30'
              : 'bg-[#0B1120] border-[#1F2937] hover:border-slate-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                toggles.countdown3s
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>عداد تنازلي قبل البدء (3s Countdown)</span>
                {toggles.countdown3s && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    3..2..1
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                إظهار عداد 3..2..1 قبل بدء التصوير الفعلي للاستعداد
              </p>

              {toggles.countdown3s && (
                <div
                  className="mt-2.5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-400">مدة العداد:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setToggles((prev) => ({ ...prev, countdownDuration: 3 }))
                      }
                      className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                        toggles.countdownDuration === 3
                          ? 'bg-cyan-500 text-[#090D16]'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      3 ثوانٍ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setToggles((prev) => ({ ...prev, countdownDuration: 5 }))
                      }
                      className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                        toggles.countdownDuration === 5
                          ? 'bg-cyan-500 text-[#090D16]'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      5 ثوانٍ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Switch */}
          <div className="shrink-0 mt-0.5">
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                toggles.countdown3s ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  toggles.countdown3s ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
