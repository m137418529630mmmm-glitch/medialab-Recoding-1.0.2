import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Check,
  X,
  Maximize2,
  Move,
  RotateCcw,
} from 'lucide-react';
import { RegionCoordinates, AspectRatioPreset } from '../types/recorder';

interface InteractiveRegionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentRegion: RegionCoordinates;
  onApplyRegion: (region: RegionCoordinates, preset?: AspectRatioPreset) => void;
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'draw' | null;

export const InteractiveRegionSelector: React.FC<InteractiveRegionSelectorProps> = ({
  isOpen,
  onClose,
  currentRegion,
  onApplyRegion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<RegionCoordinates>({ x: 100, y: 100, width: 640, height: 360 });
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; box: RegionCoordinates }>({
    mouseX: 0,
    mouseY: 0,
    box: { x: 0, y: 0, width: 0, height: 0 },
  });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize box to fit comfortably inside the canvas viewport
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasW = Math.max(300, rect.width || window.innerWidth - 80);
      const canvasH = Math.max(200, rect.height || window.innerHeight - 140);

      // Desired initial width & height
      let w = Math.min(canvasW * 0.7, 720);
      let h = Math.round((w * 9) / 16);
      if (h > canvasH * 0.8) {
        h = canvasH * 0.8;
        w = Math.round((h * 16) / 9);
      }

      const x = Math.max(20, Math.round((canvasW - w) / 2));
      const y = Math.max(20, Math.round((canvasH - h) / 2));

      setBox({ x, y, width: Math.round(w), height: Math.round(h) });
    }
  }, [isOpen]);

  // Pointer Down on Handle or Box
  const handleStartDrag = (handle: DragHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    setDragHandle(handle);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...box },
    });
  };

  // Pointer Down on empty canvas to draw fresh box
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    containerRef.current.setPointerCapture?.(e.pointerId);
    setDragHandle('draw');
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { x, y, width: 0, height: 0 },
    });
    setBox({ x, y, width: 0, height: 0 });
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.round(e.clientX - rect.left);
    const curY = Math.round(e.clientY - rect.top);
    setCursorPos({ x: curX, y: curY });

    if (!dragHandle) return;

    const dx = e.clientX - dragStart.mouseX;
    const dy = e.clientY - dragStart.mouseY;
    const initial = dragStart.box;
    const canvasW = rect.width;
    const canvasH = rect.height;

    if (dragHandle === 'move') {
      const newX = Math.max(0, Math.min(canvasW - initial.width, initial.x + dx));
      const newY = Math.max(0, Math.min(canvasH - initial.height, initial.y + dy));
      setBox((prev) => ({ ...prev, x: Math.round(newX), y: Math.round(newY) }));
    } else if (dragHandle === 'draw') {
      const startX = initial.x;
      const startY = initial.y;
      const x = Math.max(0, Math.min(startX, curX));
      const y = Math.max(0, Math.min(startY, curY));
      const width = Math.min(canvasW - x, Math.abs(curX - startX));
      const height = Math.min(canvasH - y, Math.abs(curY - startY));
      setBox({ x, y, width, height });
    } else {
      // Resizing with boundary constraints
      let { x, y, width, height } = initial;

      if (dragHandle.includes('e')) {
        width = Math.max(60, Math.min(canvasW - x, initial.width + dx));
      }
      if (dragHandle.includes('s')) {
        height = Math.max(50, Math.min(canvasH - y, initial.height + dy));
      }
      if (dragHandle.includes('w')) {
        const potentialW = initial.width - dx;
        if (potentialW >= 60) {
          x = Math.max(0, initial.x + dx);
          width = potentialW;
        }
      }
      if (dragHandle.includes('n')) {
        const potentialH = initial.height - dy;
        if (potentialH >= 50) {
          y = Math.max(0, initial.y + dy);
          height = potentialH;
        }
      }

      setBox({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    setDragHandle(null);
    // Enforce reasonable minimum dimensions
    setBox((prev) => ({
      x: prev.x,
      y: prev.y,
      width: Math.max(120, prev.width),
      height: Math.max(80, prev.height),
    }));
  };

  // Quick Preset Handlers
  const handlePreset = (preset: AspectRatioPreset | 'fullscreen' | 'center') => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasW = rect.width;
    const canvasH = rect.height;

    if (preset === 'fullscreen') {
      setBox({ x: 20, y: 20, width: Math.round(canvasW - 40), height: Math.round(canvasH - 40) });
      return;
    }

    if (preset === 'center') {
      const x = Math.max(0, Math.round((canvasW - box.width) / 2));
      const y = Math.max(0, Math.round((canvasH - box.height) / 2));
      setBox((prev) => ({ ...prev, x, y }));
      return;
    }

    let w = box.width;
    let h = box.height;

    if (preset === '16:9') {
      h = Math.round((w * 9) / 16);
      if (h > canvasH - box.y) {
        h = canvasH - box.y - 10;
        w = Math.round((h * 16) / 9);
      }
    } else if (preset === '9:16') {
      w = Math.round((h * 9) / 16);
      if (w > canvasW - box.x) {
        w = canvasW - box.x - 10;
        h = Math.round((w * 16) / 9);
      }
    } else if (preset === '1:1') {
      const size = Math.min(w, h, canvasW - box.x, canvasH - box.y);
      w = size;
      h = size;
    }

    setBox((prev) => ({ ...prev, width: Math.round(w), height: Math.round(h) }));
  };

  const handleConfirm = () => {
    // Return the actual pixel dimensions selected on screen
    onApplyRegion({
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col p-3 sm:p-5 animate-in fade-in duration-200 select-none">
      {/* Top Header Bar inside Overlay */}
      <div className="flex items-center justify-between bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl px-4 sm:px-6 py-3 shadow-xl mb-3 text-[#1E1D1B]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F4F3F0] text-[#D85631] flex items-center justify-center">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1E1D1B]">تحديد المساحة بالماوس</h3>
            <p className="text-[11px] text-[#7E7B75] hidden sm:block">
              اسحب الإطار لنقله أو اسحب المقابض البيضاء في الأطراف لتكبير وتصغير المساحة
            </p>
          </div>
        </div>

        {/* Live Coordinate Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="bg-[#F4F3F0] px-3 py-1.5 rounded-lg border border-[#E5E2DC] text-[#1E1D1B]">
            <span className="text-[#7E7B75]">المؤشر: </span>
            <span className="text-[#D85631] font-bold tabular-nums">
              X:{cursorPos.x} Y:{cursorPos.y}
            </span>
          </div>

          <div className="bg-[#F4F3F0] px-3 py-1.5 rounded-lg border border-[#E5E2DC] text-[#1E1D1B]">
            <span className="text-[#7E7B75]">الأبعاد: </span>
            <span className="font-bold tabular-nums text-[#D85631]">
              {box.width} × {box.height} px
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[#E5E2DC] bg-[#FFFFFF] text-[#7E7B75] hover:text-[#1E1D1B] text-xs font-bold transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#D85631] hover:bg-[#C24623] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>تثبيت الأبعاد</span>
          </button>
        </div>
      </div>

      {/* Quick Presets Strip */}
      <div className="flex items-center justify-between pb-2.5 px-2 text-xs text-white">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-white/80 ml-1">نسب سريعة:</span>
          <button
            type="button"
            onClick={() => handlePreset('16:9')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/25 text-white rounded-lg border border-white/20 transition-colors"
          >
            16:9 (عريض)
          </button>
          <button
            type="button"
            onClick={() => handlePreset('9:16')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/25 text-white rounded-lg border border-white/20 transition-colors"
          >
            9:16 (طولي)
          </button>
          <button
            type="button"
            onClick={() => handlePreset('1:1')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/25 text-white rounded-lg border border-white/20 transition-colors"
          >
            1:1 (مربع)
          </button>
          <button
            type="button"
            onClick={() => handlePreset('fullscreen')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/25 text-white rounded-lg border border-white/20 transition-colors flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            <span>كامل الشاشة</span>
          </button>
          <button
            type="button"
            onClick={() => handlePreset('center')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/25 text-white rounded-lg border border-white/20 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>توسيط</span>
          </button>
        </div>

        <div className="text-[11px] text-white/60 hidden sm:block">
          انقر داخل الإطار لتحريكه، أو اسحب أي مقبض للتعديل، أو انقر في الفراغ لرسم إطار جديد
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 bg-[#1A1918] rounded-2xl border-2 border-dashed border-[#7E7B75] overflow-hidden cursor-crosshair touch-none"
      >
        {/* Subtle Grid Pattern */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #FFF 1px, transparent 1px), linear-gradient(to bottom, #FFF 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Crosshair Cursor Lines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none"
          style={{ left: `${cursorPos.x}px` }}
        />
        <div
          className="absolute left-0 right-0 h-px bg-white/20 pointer-events-none"
          style={{ top: `${cursorPos.y}px` }}
        />

        {/* The Interactive Bounding Box */}
        {box.width > 0 && box.height > 0 && (
          <div
            onPointerDown={(e) => handleStartDrag('move', e)}
            className="absolute rounded-lg border-2 border-[#D85631] bg-[#D85631]/15 shadow-2xl cursor-move transition-none"
            style={{
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
          >
            {/* Dimension Tag over the box */}
            <div className="absolute -top-7 right-0 bg-[#D85631] text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow pointer-events-none flex items-center gap-1.5">
              <Move className="w-3 h-3" />
              <span>
                {box.width} × {box.height} px
              </span>
            </div>

            {/* Corner Handles (Large 14px grab targets) */}
            <span
              onPointerDown={(e) => handleStartDrag('nw', e)}
              className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-[#D85631] rounded-sm cursor-nwse-resize shadow-md"
            />
            <span
              onPointerDown={(e) => handleStartDrag('ne', e)}
              className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#D85631] rounded-sm cursor-nesw-resize shadow-md"
            />
            <span
              onPointerDown={(e) => handleStartDrag('sw', e)}
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-[#D85631] rounded-sm cursor-nesw-resize shadow-md"
            />
            <span
              onPointerDown={(e) => handleStartDrag('se', e)}
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-[#D85631] rounded-sm cursor-nwse-resize shadow-md"
            />

            {/* Edge Midpoint Handles */}
            <span
              onPointerDown={(e) => handleStartDrag('n', e)}
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-[#D85631] rounded-sm cursor-ns-resize shadow"
            />
            <span
              onPointerDown={(e) => handleStartDrag('s', e)}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-[#D85631] rounded-sm cursor-ns-resize shadow"
            />
            <span
              onPointerDown={(e) => handleStartDrag('w', e)}
              className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-6 w-3 bg-white border border-[#D85631] rounded-sm cursor-ew-resize shadow"
            />
            <span
              onPointerDown={(e) => handleStartDrag('e', e)}
              className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-6 w-3 bg-white border border-[#D85631] rounded-sm cursor-ew-resize shadow"
            />
          </div>
        )}
      </div>
    </div>
  );
};
