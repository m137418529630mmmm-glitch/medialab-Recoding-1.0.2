import React from 'react';
import {
  Keyboard,
  Command,
  Zap,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const HotkeysGuide: React.FC = () => {
  const shortcuts = [
    {
      action: 'بدء / إنهاء التسجيل الفوري',
      keys: ['Ctrl', 'Shift', 'R'],
      description: 'يبدأ التسجيل فوراً مع العداد التنازلي أو يحفظ التسجيل النشط ويزيد الترقيم التلقائي.',
      tag: 'أساسي',
    },
    {
      action: 'إيقاف مؤقت / استئناف (Pause / Resume)',
      keys: ['Ctrl', 'Shift', 'P'],
      description: 'إيقاف مؤقت لتسجيل الشاشة دون إنهاء الجلسة، والضغط مجدداً للاستئناف بسلاسة.',
      tag: 'تحكم',
    },
    {
      action: 'التقاط صورة شاشة فورية (Screenshot)',
      keys: ['Ctrl', 'Shift', 'S'],
      description: 'حفظ صورة ثابتة فائقة الدقة داخل نفس مجلد التسجيلات الحالي.',
      tag: 'إضافي',
    },
    {
      action: 'إلغاء التسجيل وحذفه فوراً (Discard)',
      keys: ['Ctrl', 'Shift', 'D'],
      description: 'حذف جلسة التسجيل الحالية دون حفظ ودون زيادة العداد التسلسلي.',
      tag: 'تحكم',
    },
    {
      action: 'إظهار / إخفاء شريط HUD العائم',
      keys: ['Ctrl', 'H'],
      description: 'إخفاء أو إعادة إظهار الشريط العائم أثناء العمل على الشاشة.',
      tag: 'عرض',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#111827] rounded-2xl border border-[#1F2937] p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              اختصارات لوحة المفاتيح والتحكم السريع
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تحكم في التسجيل دون الحاجة لفتح الواجهة أثناء اللعب أو تقديم العروض
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/30 px-3 py-1.5 rounded-xl border border-cyan-500/30">
          <Zap className="w-3.5 h-3.5" />
          <span>الاختصارات مفعّلة في النظام</span>
        </div>
      </div>

      {/* Grid of Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shortcuts.map((sc, i) => (
          <div
            key={i}
            className="bg-[#111827] rounded-2xl border border-[#1F2937] p-4 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{sc.action}</span>
              <div className="flex items-center gap-1">
                {sc.keys.map((k, ki) => (
                  <kbd
                    key={ki}
                    className="font-mono text-xs font-bold bg-[#0B1120] text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{sc.description}</p>
          </div>
        ))}
      </div>

      {/* Quality Architecture Notes */}
      <div className="bg-[#0B1120] rounded-2xl border border-[#1F2937] p-5 space-y-3">
        <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
          <Info className="w-4 h-4" />
          <span>نصائح تقنية للحصول على أعلى أداء:</span>
        </h3>
        <ul className="text-xs text-slate-400 space-y-2 pr-4 list-disc">
          <li>
            <strong>تسمية متسلسلة تلقائية:</strong> عند تفعيل خيار التسمية التلقائية، يتم حفظ كل تسجيل فورياً برقم متتابع (0.mp4, 1.mp4, 2.mp4...) مما يسهل استيرادها المباشر في برامج المونتاج مثل Premiere Pro أو DaVinci Resolve.
          </li>
          <li>
            <strong>عزل الماوس:</strong> خيار "إخفاء مؤشر الماوس" يمنع تسجيل حركة المؤشر داخل الفيديو تماماً، ما يوفر مقاطع نظيفة واحترافية.
          </li>
          <li>
            <strong>إلغاء شريط HUD من الفيديو:</strong> شريط التحكم العائم مصمم بتقنية الاستبعاد الطبقي، بحيث يكون مرئياً لك فقط للتحكم ولا يظهر داخل ملف الفيديو النهائي.
          </li>
        </ul>
      </div>
    </div>
  );
};
