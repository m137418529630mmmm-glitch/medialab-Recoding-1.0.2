import React, { useState } from 'react';
import {
  Film,
  Play,
  Download,
  Trash2,
  Copy,
  Check,
  X,
  FileVideo,
} from 'lucide-react';
import { SavedRecording } from '../types/recorder';

interface SavedRecordingsLibraryProps {
  recordings: SavedRecording[];
  onDeleteRecording: (id: string) => void;
  onClearAll: () => void;
  onTriggerRecordCTA: () => void;
}

export const SavedRecordingsLibrary: React.FC<SavedRecordingsLibraryProps> = ({
  recordings,
  onDeleteRecording,
  onClearAll,
  onTriggerRecordCTA,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<SavedRecording | null>(null);

  const handleCopyPath = (rec: SavedRecording) => {
    navigator.clipboard?.writeText(rec.fullPath);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownload = (rec: SavedRecording) => {
    const element = document.createElement('a');
    const file = new Blob([`Simulated MP4 Recording: ${rec.fileName}`], {
      type: 'text/plain',
    });
    element.href = URL.createObjectURL(file);
    element.download = rec.fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E2DC] p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F4F3F0] text-[#D85631] flex items-center justify-center">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E1D1B] flex items-center gap-2">
              <span>التسجيلات المحفوظة</span>
              <span className="font-mono text-xs bg-[#F4F3F0] text-[#D85631] px-2 py-0.5 rounded-full border border-[#E5E2DC]">
                {recordings.length}
              </span>
            </h2>
            <p className="text-xs text-[#7E7B75]">
              المقاطع المسجلة بالترتيب التلقائي المنظم
            </p>
          </div>
        </div>

        {recordings.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-rose-50 transition-colors cursor-pointer"
          >
            مسح السجل
          </button>
        )}
      </div>

      {/* List or Empty State */}
      {recordings.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E2DC] p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F4F3F0] border border-[#E5E2DC] flex items-center justify-center text-[#7E7B75]">
            <FileVideo className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1E1D1B]">لا توجد تسجيلات محفوظة حالياً</h3>
            <p className="text-xs text-[#7E7B75] mt-1">
              ابدأ جلستك الأولى وسيتم الترقيم التلقائي (0.mp4, 1.mp4...)
            </p>
          </div>
          <button
            type="button"
            onClick={onTriggerRecordCTA}
            className="px-5 py-2.5 bg-[#D85631] hover:bg-[#C24623] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            بدء تسجيل جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#FFFFFF] rounded-2xl border border-[#E5E2DC] hover:border-[#D85631]/50 p-4 transition-all duration-150 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div className="space-y-3">
                <div className="relative aspect-video w-full rounded-xl bg-[#22211F] overflow-hidden flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setPreviewClip(rec)}
                    className="w-10 h-10 rounded-full bg-[#D85631] hover:bg-[#C24623] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>

                  <span className="absolute bottom-2 right-2 font-mono text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {rec.durationFormatted}
                  </span>

                  <span className="absolute top-2 left-2 text-[10px] font-mono bg-white/90 text-[#1E1D1B] px-1.5 py-0.5 rounded font-bold">
                    {rec.resolution}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-sm font-bold text-[#1E1D1B]">
                      {rec.fileName}
                    </h4>
                    <span className="font-mono text-xs text-[#7E7B75]">
                      {rec.sizeMb} MB
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#7E7B75] mt-0.5">
                    <span>{rec.modeName}</span>
                    <span>·</span>
                    <span className="font-mono">{rec.fps} FPS</span>
                    <span>·</span>
                    <span>{rec.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5E2DC] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyPath(rec)}
                    title="نسخ المسار"
                    className="p-1.5 rounded-lg text-[#7E7B75] hover:text-[#1E1D1B] hover:bg-[#F4F3F0] transition-colors cursor-pointer"
                  >
                    {copiedId === rec.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(rec)}
                    title="تنزيل الملف"
                    className="p-1.5 rounded-lg text-[#7E7B75] hover:text-[#D85631] hover:bg-[#F4F3F0] transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteRecording(rec.id)}
                  title="حذف المقطع"
                  className="p-1.5 rounded-lg text-[#7E7B75] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-[#1E1D1B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DC]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#D85631]" />
                <h3 className="font-mono text-sm font-bold text-[#1E1D1B]">
                  {previewClip.fileName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClip(null)}
                className="text-[#7E7B75] hover:text-[#1E1D1B] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full bg-[#22211F] rounded-xl flex items-center justify-center text-white relative">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#D85631] text-white flex items-center justify-center mx-auto shadow-md">
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                </div>
                <div className="text-xs font-mono text-white/80">
                  تشغيل المقطع ({previewClip.durationFormatted})
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-[#7E7B75] truncate max-w-sm" dir="ltr">
                {previewClip.fullPath}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(previewClip)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#D85631] hover:bg-[#C24623] text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
