import React, { useState } from 'react';
import {
  Pause,
  Play,
  Square,
  Trash2,
  Camera,
  EyeOff,
  Move,
  Eye,
} from 'lucide-react';
import {
  StorageSettings,
  ToggleSettings,
  RegionCoordinates,
  CaptureMode,
} from '../types/recorder';
import { Language, translations } from '../utils/translations';

interface LiveRecordingOverlayProps {
  lang: Language;
  isActive: boolean;
  status: 'idle' | 'countdown' | 'recording' | 'paused';
  timerFormatted: string;
  secondsElapsed: number;
  countdownValue: number;
  storage: StorageSettings;
  toggles: ToggleSettings;
  region: RegionCoordinates;
  captureMode: CaptureMode;
  onPauseResume: () => void;
  onSave: () => void;
  onTakeSnapshot: () => void;
  onShowToast: (msg: string) => void;
}

export const LiveRecordingOverlay: React.FC<LiveRecordingOverlayProps> = ({
  lang,
  isActive,
  status,
  timerFormatted,
  secondsElapsed,
  countdownValue,
  storage,
  toggles,
  region,
  captureMode,
  onPauseResume,
  onSave,
  onTakeSnapshot,
  onShowToast,
}) => {
  const t = translations[lang];
  const [hudOffset, setHudOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingHud, setIsDraggingHud] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // State to hide and show the recording control bar while recording continues
  const [isBarVisible, setIsBarVisible] = useState<boolean>(true);

  const targetSecs = toggles.autoStopEnabled
    ? (toggles.autoStopHours || 0) * 3600 +
      (toggles.autoStopMinutes || 0) * 60 +
      (toggles.autoStopSeconds || 0)
    : 0;

  const formatTargetTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent = targetSecs > 0 ? Math.min(100, (secondsElapsed / targetSecs) * 100) : 0;

  if (!isActive) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingHud(true);
    setDragStart({ x: e.clientX - hudOffset.x, y: e.clientY - hudOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingHud) return;
    setHudOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingHud(false);
  };

  // When trash can is clicked: Hide the bar, but recording continues normally!
  const handleTrashClick = () => {
    setIsBarVisible(false);
    onShowToast(t.barHiddenToast);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between p-6 select-none"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] -z-10" />

      {/* Countdown (3..2..1) */}
      {status === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30">
          <div className="text-center space-y-3 animate-in zoom-in-75 duration-200">
            <div className="font-mono text-8xl font-black text-[#D85631] animate-pulse">
              {countdownValue}
            </div>
            <div className="text-sm font-bold text-white">
              {lang === 'en' ? 'Preparing to record...' : 'الاستعداد لبدء التسجيل...'}
            </div>
          </div>
        </div>
      )}

      {/* Recording boundary frame */}
      {captureMode === 'region' ? (
        <div
          className="absolute rounded-xl border-[3px] border-solid border-[#000000] shadow-none pointer-events-none transition-all duration-200"
          style={{
            left: `${Math.max(20, Math.min(window.innerWidth - 300, region.x / 2))}px`,
            top: `${Math.max(20, Math.min(window.innerHeight - 200, region.y / 2))}px`,
            width: `${Math.min(window.innerWidth - 60, region.width / 2)}px`,
            height: `${Math.min(window.innerHeight - 100, region.height / 2)}px`,
          }}
        >
          <div className="absolute -top-6 right-0 bg-black text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-none">
            REC {region.width} × {region.height} px
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-[#D85631] rounded-sm" />
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-[#D85631] rounded-sm" />
          <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-[#D85631] rounded-sm" />
          <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-[#D85631] rounded-sm" />
        </div>
      ) : (
        <div className="absolute inset-3 rounded-2xl border-2 border-[#D85631]/70 pointer-events-none" />
      )}

      {/* If bar is HIDDEN: Show small compact button to restore controls */}
      {!isBarVisible && (
        <div className="self-center mb-4 z-40 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => setIsBarVisible(true)}
            className="flex items-center gap-2.5 bg-[#FFFFFF] hover:bg-[#F9F8F6] border border-[#E5E2DC] hover:border-[#D85631] px-4 py-2 rounded-full shadow-2xl text-xs font-bold text-[#1E1D1B] cursor-pointer transition-all"
            title={t.showBar}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'recording' ? 'bg-[#D85631] animate-ping' : 'bg-amber-500'
              }`}
            />
            <span className="font-mono tabular-nums">{timerFormatted}</span>
            {toggles.autoStopEnabled && targetSecs > 0 && (
              <span className="text-[10px] font-mono text-[#7E7B75]">
                / {formatTargetTime(targetSecs)}
              </span>
            )}
            <span className="text-[#7E7B75] flex items-center gap-1 border-r border-[#E5E2DC] pr-2">
              <Eye className="w-3.5 h-3.5 text-[#D85631]" />
              <span>{t.showBar}</span>
            </span>
          </button>
        </div>
      )}

      {/* Floating HUD Bar (Visible) */}
      {isBarVisible && (
        <div
          style={{
            transform: `translate(${hudOffset.x}px, ${hudOffset.y}px)`,
          }}
          className="self-center mb-6 flex flex-col items-center gap-2 transition-transform duration-75 animate-in fade-in duration-150"
        >
          <div className="relative flex items-center gap-3 bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl px-4 py-2.5 shadow-2xl select-none text-[#1E1D1B] overflow-hidden">
            {/* Auto-Stop Progress Line */}
            {toggles.autoStopEnabled && targetSecs > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#F4F3F0]">
                <div
                  className="h-full bg-[#D85631] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Drag Handle */}
            <div
              onMouseDown={handleMouseDown}
              title={lang === 'en' ? 'Drag bar' : 'اسحب الشريط'}
              className="text-[#7E7B75] hover:text-[#1E1D1B] cursor-grab active:cursor-grabbing p-1"
            >
              <Move className="w-4 h-4" />
            </div>

            {/* REC Indicator */}
            <div className="flex items-center gap-2 pr-1 border-r border-[#E5E2DC]">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status === 'recording' ? 'bg-[#D85631] animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-black font-mono text-[#D85631]">
                {status === 'recording' ? 'REC' : status === 'paused' ? 'PAUSED' : 'READY'}
              </span>
            </div>

            {/* Timer + Auto-stop indicator */}
            <div className="font-mono text-base font-black text-[#1E1D1B] tracking-wider tabular-nums px-2 flex items-center gap-1">
              <span>{timerFormatted}</span>
              {toggles.autoStopEnabled && targetSecs > 0 && (
                <span className="text-[11px] font-bold text-[#7E7B75] font-mono">
                  / {formatTargetTime(targetSecs)}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 border-r border-[#E5E2DC] pr-2">
              {/* Pause / Resume */}
              <button
                type="button"
                onClick={onPauseResume}
                title={status === 'recording' ? t.pause : t.resume}
                className="p-1.5 rounded-xl text-[#1E1D1B] hover:bg-[#F4F3F0] transition-colors cursor-pointer"
              >
                {status === 'recording' ? (
                  <Pause className="w-4 h-4 fill-current text-amber-500" />
                ) : (
                  <Play className="w-4 h-4 fill-current text-emerald-600" />
                )}
              </button>

              {/* Stop & Save */}
              <button
                type="button"
                onClick={onSave}
                title={t.stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D85631] hover:bg-[#C24623] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t.stopRecording}</span>
              </button>

              {/* Trash Icon -> HIDES THE BAR WHILE RECORDING CONTINUES! */}
              <button
                type="button"
                onClick={handleTrashClick}
                title={t.hideBar}
                className="p-1.5 rounded-xl text-[#7E7B75] hover:text-[#D85631] hover:bg-[#F4F3F0] transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Camera Snapshot */}
              <button
                type="button"
                onClick={onTakeSnapshot}
                title={lang === 'en' ? 'Snapshot' : 'لقطة شاشة'}
                className="p-1.5 rounded-xl text-[#7E7B75] hover:text-[#D85631] hover:bg-[#F4F3F0] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subtitle tag */}
          <div className="flex items-center gap-1.5 bg-white/95 px-3 py-0.5 rounded-full border border-[#E5E2DC] text-[10px] font-bold text-[#7E7B75] shadow-sm">
            <EyeOff className="w-3 h-3 text-[#D85631]" />
            <span>
              {lang === 'en'
                ? 'Hidden from recorded video'
                : 'مخفي تلقائياً من الظهور داخل الفيديو المسجل'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
