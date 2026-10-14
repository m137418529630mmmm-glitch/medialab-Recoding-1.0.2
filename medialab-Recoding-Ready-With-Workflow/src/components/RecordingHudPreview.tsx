import React from 'react';
import {
  Pause,
  Play,
  Square,
  Trash2,
  Camera,
  EyeOff,
  Move,
  Radio,
} from 'lucide-react';
import { StorageSettings, ToggleSettings, RegionCoordinates } from '../types/recorder';

interface RecordingHudPreviewProps {
  storage: StorageSettings;
  toggles: ToggleSettings;
  region: RegionCoordinates;
  onSaveRecording: (customDuration?: number) => void;
  onDiscardRecording: () => void;
}

export const RecordingHudPreview: React.FC<RecordingHudPreviewProps> = ({
  storage,
  toggles,
  region,
  onSaveRecording,
  onDiscardRecording,
}) => {
  const [hudState, setHudState] = React.useState<'recording' | 'paused'>('recording');
  const [seconds, setSeconds] = React.useState<number>(14);
  const [hudPosition, setHudPosition] = React.useState<'bottom-center' | 'top-right' | 'bottom-right'>('bottom-center');

  React.useEffect(() => {
    let interval: any = null;
    if (hudState === 'recording') {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hudState]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    setHudState((prev) => (prev === 'recording' ? 'paused' : 'recording'));
  };

  const handleSave = () => {
    onSaveRecording(seconds);
    setSeconds(0);
    setHudState('recording');
  };

  const handleDiscard = () => {
    onDiscardRecording();
    setSeconds(0);
    setHudState('recording');
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E2DC] p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1E1D1B] flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#D85631] animate-pulse" />
            <span>معاينة شريط التحكم العائم (HUD)</span>
          </h2>
          <p className="text-xs text-[#7E7B75] mt-0.5">
            محاكاة دقيقة للشريط العائم وإطار التسجيل المنقط
          </p>
        </div>

        {/* Position Switcher */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#7E7B75] font-bold">الموضع:</span>
          <div className="flex items-center gap-1 bg-[#F4F3F0] p-1 rounded-xl border border-[#E5E2DC]">
            {[
              { id: 'bottom-center', label: 'أسفل المنتصف' },
              { id: 'top-right', label: 'أعلى اليمين' },
              { id: 'bottom-right', label: 'أسفل اليمين' },
            ].map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => setHudPosition(pos.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  hudPosition === pos.id
                    ? 'bg-[#D85631] text-white shadow-sm'
                    : 'text-[#7E7B75] hover:text-[#1E1D1B]'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screen Preview Canvas */}
      <div className="relative w-full aspect-[16/9] min-h-[420px] bg-[#22211F] rounded-2xl border border-[#E5E2DC] overflow-hidden shadow-md flex items-center justify-center p-6">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#FFF 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Boundary Frame */}
        <div className="relative w-full max-w-3xl h-[78%] rounded-xl border-2 border-dashed border-[#D85631] shadow-[0_0_20px_rgba(216,86,49,0.2)] flex flex-col justify-between p-3 pointer-events-none">
          {/* Top Frame Tag */}
          <div className="flex items-center justify-between text-xs pointer-events-auto">
            <div className="bg-[#FFFFFF] px-3 py-1 rounded-lg border border-[#E5E2DC] text-[#D85631] font-mono text-[11px] font-bold shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D85631] animate-pulse" />
              <span>منطقة التسجيل: {region.width} × {region.height} px</span>
            </div>
            <div className="bg-[#FFFFFF] px-3 py-1 rounded-lg border border-[#E5E2DC] text-[#7E7B75] text-[11px] font-mono">
              60 FPS · MP4
            </div>
          </div>

          {/* Corner Resizing Handles */}
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#D85631] rounded-sm shadow-md" />
          <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-[#D85631] rounded-sm shadow-md" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#D85631] rounded-sm shadow-md" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-[#D85631] rounded-sm shadow-md" />

          {/* Floating HUD Bar */}
          <div
            className={`pointer-events-auto transition-all duration-300 flex flex-col items-center gap-2 ${
              hudPosition === 'bottom-center'
                ? 'self-center mb-2'
                : hudPosition === 'top-right'
                ? 'self-start mt-6'
                : 'self-start mb-2'
            }`}
          >
            <div className="flex items-center gap-3 bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl px-4 py-2.5 shadow-xl select-none text-[#1E1D1B]">
              <div className="text-[#7E7B75] hover:text-[#1E1D1B] cursor-grab p-0.5">
                <Move className="w-3.5 h-3.5" />
              </div>

              {/* Status Dot & REC */}
              <div className="flex items-center gap-2 pr-1 border-r border-[#E5E2DC]">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hudState === 'recording'
                      ? 'bg-[#D85631] animate-ping'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-black font-mono text-[#D85631]">
                  {hudState === 'recording' ? 'REC' : 'PAUSED'}
                </span>
              </div>

              {/* Monospace Timer */}
              <div className="font-mono text-base font-extrabold text-[#1E1D1B] tracking-wider tabular-nums px-2">
                {formatTimer(seconds)}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 border-r border-[#E5E2DC] pr-2">
                {/* Pause/Resume */}
                <button
                  type="button"
                  onClick={handlePauseResume}
                  className="p-2 rounded-xl text-[#1E1D1B] hover:bg-[#F4F3F0] transition-all cursor-pointer"
                  title="إيقاف مؤقت / استئناف"
                >
                  {hudState === 'recording' ? (
                    <Pause className="w-4 h-4 fill-current text-amber-500" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-emerald-600" />
                  )}
                </button>

                {/* Save */}
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D85631] hover:bg-[#C24623] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  title="حفظ وإنهاء"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>حفظ وإنهاء</span>
                </button>

                {/* Discard */}
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="p-2 rounded-xl text-[#7E7B75] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                  title="إلغاء وحذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note */}
            <div className="flex items-center gap-1.5 bg-[#FFFFFF]/90 backdrop-blur-sm px-3 py-0.5 rounded-full border border-[#E5E2DC] text-[10px] font-bold text-[#7E7B75] shadow-sm">
              <EyeOff className="w-3 h-3 text-[#D85631]" />
              <span>مخفي تلقائياً من الظهور داخل الفيديو المسجل</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
