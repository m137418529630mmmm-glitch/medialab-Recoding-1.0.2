import React from 'react';
import {
  ResolutionOption,
  FpsOption,
} from '../types/recorder';
import { Language, translations } from '../utils/translations';

interface QualitySettingsProps {
  lang: Language;
  resolution: ResolutionOption;
  setResolution: (res: ResolutionOption) => void;
  fps: FpsOption;
  setFps: (fps: FpsOption) => void;
}

export const QualitySettings: React.FC<QualitySettingsProps> = ({
  lang,
  resolution,
  setResolution,
  fps,
  setFps,
}) => {
  const t = translations[lang];

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 1. Resolution / Quality - Exact clone of screenshot QUALITY row */}
      <div className="space-y-2 w-full min-w-0">
        <label className="block text-xs font-bold text-[#7E7B75] uppercase tracking-wider">
          {t.resolution}
        </label>
        <div className="grid grid-cols-4 gap-2 w-full min-w-0">
          {[
            { id: 'native', label: t.native },
            { id: '4k', label: '4K' },
            { id: '1080p', label: '1080p' },
            { id: '720p', label: '720p' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setResolution(item.id as ResolutionOption)}
              className={`py-3 px-1 sm:px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center truncate ${
                resolution === item.id
                  ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
                  : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F9F8F6]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Framerate / FPS */}
      <div className="space-y-2 w-full min-w-0">
        <label className="block text-xs font-bold text-[#7E7B75] uppercase tracking-wider">
          {t.framerate}
        </label>
        <div className="grid grid-cols-3 gap-2 w-full min-w-0">
          {[
            { id: 60, label: '60 FPS' },
            { id: 30, label: '30 FPS' },
            { id: 24, label: '24 FPS' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFps(item.id as FpsOption)}
              className={`py-3 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center truncate ${
                fps === item.id
                  ? 'bg-[#D85631] text-white border-[#D85631] shadow-sm'
                  : 'bg-[#FFFFFF] text-[#1E1D1B] border-[#E5E2DC] hover:bg-[#F9F8F6]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
