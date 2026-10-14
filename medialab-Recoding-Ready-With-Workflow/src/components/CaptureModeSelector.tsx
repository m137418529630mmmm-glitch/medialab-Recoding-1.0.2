import React, { useEffect, useState } from 'react';
import {
  Monitor,
  Crop,
  AppWindow,
  MousePointerClick,
  ChevronDown,
} from 'lucide-react';
import {
  CaptureMode,
  AspectRatioPreset,
  RegionCoordinates,
  AppWindowState,
} from '../types/recorder';
import { Language, translations } from '../utils/translations';

interface CaptureModeSelectorProps {
  lang: Language;
  captureMode: CaptureMode;
  setCaptureMode: (mode: CaptureMode) => void;
  aspectPreset: AspectRatioPreset;
  setAspectPreset: (preset: AspectRatioPreset) => void;
  region: RegionCoordinates;
  setRegion: React.Dispatch<React.SetStateAction<RegionCoordinates>>;
  onOpenRegionPickerModal: () => void;
  selectedWindowId: string;
  setSelectedWindowId: (id: string) => void;
}

const fallbackWindows: AppWindowState[] = [];

export const CaptureModeSelector: React.FC<CaptureModeSelectorProps> = ({
  lang,
  captureMode,
  setCaptureMode,
  aspectPreset,
  setAspectPreset,
  region,
  setRegion,
  onOpenRegionPickerModal,
  selectedWindowId,
  setSelectedWindowId,
}) => {
  const t = translations[lang];
  const [openWindows, setOpenWindows] = useState<AppWindowState[]>(fallbackWindows);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const api = window.electronAPI as any;
        const items = api?.getOpenWindows ? await api.getOpenWindows() : [];
        if (!mounted) return;
        setOpenWindows(items || []);
        if (items?.length && !items.some((w: AppWindowState) => w.id === selectedWindowId)) setSelectedWindowId(items[0].id);
      } catch { if (mounted) setOpenWindows([]); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [selectedWindowId, setSelectedWindowId]);

  const handleApplyPreset = (preset: AspectRatioPreset) => {
    setAspectPreset(preset);
    if (preset === '16:9') {
      const newHeight = Math.round((region.width * 9) / 16);
      setRegion((prev) => ({ ...prev, height: newHeight }));
    } else if (preset === '9:16') {
      const newWidth = Math.round((region.height * 9) / 16);
      setRegion((prev) => ({ ...prev, width: newWidth }));
    } else if (preset === '1:1') {
      const minDim = Math.min(region.width, region.height);
      setRegion((prev) => ({ ...prev, width: minDim, height: minDim }));
    }
  };

  const handleWidthChange = (val: number) => {
    const safeW = Math.max(100, Math.min(3840, val || 0));
    setRegion((prev) => ({ ...prev, width: safeW }));
  };

  const handleHeightChange = (val: number) => {
    const safeH = Math.max(100, Math.min(2160, val || 0));
    setRegion((prev) => ({ ...prev, height: safeH }));
  };

  const selectedWin = openWindows.find((w) => w.id === selectedWindowId) || openWindows[0];

  return (
    <div className="space-y-2 w-full min-w-0">
      {/* Top Label */}
      <div className="flex items-center justify-between text-xs">
        <label className="font-bold text-[#7E7B75] uppercase tracking-wider">
          {t.captureMode}
        </label>
        <span className="font-mono text-[#7E7B75] text-[11px]">
          {captureMode === 'fullscreen'
            ? '2560 × 1440'
            : captureMode === 'region'
            ? `${region.width} × ${region.height}`
            : (selectedWin?.appName || 'No window selected')}
        </span>
      </div>

      {/* 3 Main Segmented Buttons */}
      <div className="grid grid-cols-3 gap-2 w-full min-w-0">
        <button
          type="button"
          onClick={() => setCaptureMode('fullscreen')}
          className={`py-3 px-2 sm:px-4 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 truncate ${
            captureMode === 'fullscreen'
              ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
              : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F9F8F6]'
          }`}
        >
          <Monitor className="w-4 h-4 shrink-0" />
          <span className="truncate">{t.fullScreen}</span>
        </button>

        <button
          type="button"
          onClick={() => setCaptureMode('region')}
          className={`py-3 px-2 sm:px-4 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 truncate ${
            captureMode === 'region'
              ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
              : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F9F8F6]'
          }`}
        >
          <Crop className="w-4 h-4 shrink-0" />
          <span className="truncate">{t.customRegion}</span>
        </button>

        <button
          type="button"
          onClick={() => setCaptureMode('window')}
          className={`py-3 px-2 sm:px-4 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 truncate ${
            captureMode === 'window'
              ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
              : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F9F8F6]'
          }`}
        >
          <AppWindow className="w-4 h-4 shrink-0" />
          <span className="truncate">{t.appWindow}</span>
        </button>
      </div>

      {/* Custom Region Sub-panel */}
      {captureMode === 'region' && (
        <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-xl p-3.5 space-y-3 shadow-sm w-full min-w-0 box-border overflow-hidden">
          {/* Preset Buttons + Select Area on Screen */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['16:9', '9:16', '1:1', 'free'] as AspectRatioPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                    aspectPreset === preset
                      ? 'bg-[#D85631] text-white border-[#D85631]'
                      : 'bg-[#F4F3F0] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#EAE8E2]'
                  }`}
                >
                  {preset === 'free' ? t.freeAspect : preset}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenRegionPickerModal}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F4F3F0] text-[#1E1D1B] text-xs font-bold rounded-lg border border-[#E5E2DC] transition-colors cursor-pointer whitespace-nowrap"
            >
              <MousePointerClick className="w-3.5 h-3.5 text-[#D85631]" />
              <span>{t.selectAreaMouse}</span>
            </button>
          </div>

          {/* Show dimensions ONLY when 'free' (حر) is selected */}
          {aspectPreset === 'free' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full min-w-0 animate-in fade-in duration-150 pt-1">
              <div className="bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] px-2.5 py-1.5 min-w-0 overflow-hidden">
                <label className="block text-[10px] text-[#7E7B75] font-bold truncate">
                  {t.width}
                </label>
                <input
                  type="number"
                  min={100}
                  max={3840}
                  value={region.width}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-xs font-bold text-[#1E1D1B] outline-none tabular-nums"
                />
              </div>

              <div className="bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] px-2.5 py-1.5 min-w-0 overflow-hidden">
                <label className="block text-[10px] text-[#7E7B75] font-bold truncate">
                  {t.height}
                </label>
                <input
                  type="number"
                  min={100}
                  max={2160}
                  value={region.height}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono text-xs font-bold text-[#1E1D1B] outline-none tabular-nums"
                />
              </div>

              <div className="bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] px-2.5 py-1.5 min-w-0 overflow-hidden">
                <label className="block text-[10px] text-[#7E7B75] font-bold truncate">
                  {t.posX}
                </label>
                <input
                  type="number"
                  min={0}
                  max={3840}
                  value={region.x}
                  onChange={(e) =>
                    setRegion((prev) => ({
                      ...prev,
                      x: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-transparent font-mono text-xs font-bold text-[#1E1D1B] outline-none tabular-nums"
                />
              </div>

              <div className="bg-[#F4F3F0] rounded-lg border border-[#E5E2DC] px-2.5 py-1.5 min-w-0 overflow-hidden">
                <label className="block text-[10px] text-[#7E7B75] font-bold truncate">
                  {t.posY}
                </label>
                <input
                  type="number"
                  min={0}
                  max={2160}
                  value={region.y}
                  onChange={(e) =>
                    setRegion((prev) => ({
                      ...prev,
                      y: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-transparent font-mono text-xs font-bold text-[#1E1D1B] outline-none tabular-nums"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* App Window Selector Sub-panel */}
      {captureMode === 'window' && (
        <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-xl p-3 shadow-sm w-full min-w-0">
          <div className="relative w-full">
            <select
              value={selectedWindowId}
              onChange={(e) => setSelectedWindowId(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E5E2DC] text-[#1E1D1B] text-xs font-bold rounded-lg py-2.5 px-3 pr-8 outline-none appearance-none cursor-pointer truncate"
            >
              {openWindows.length === 0 && <option value="">No open application windows found</option>}
              {openWindows.map((win) => (
                <option key={win.id} value={win.id}>
                  {win.icon} {win.title} ({win.width} × {win.height})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#7E7B75]">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
