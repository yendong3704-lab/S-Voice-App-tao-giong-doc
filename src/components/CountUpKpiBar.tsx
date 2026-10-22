import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Database, ShieldCheck, Clock } from 'lucide-react';

interface CountUpNumberProps {
  value: number;
  suffix?: string;
  durationMs?: number;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  suffix = '',
  durationMs = 750,
}) => {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = 0;
    const endVal = value;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return (
    <span className="font-mono font-bold tracking-tight">
      {displayVal.toLocaleString('vi-VN')}
      {suffix}
    </span>
  );
};

interface CountUpKpiBarProps {
  wordCount: number;
  estimatedDurationSec: number;
  resolvedIssuesCount: number;
  totalIssuesCount: number;
  cachedSegmentsCount: number;
  remainingDailyQuota: number;
  maxDailyQuota: number;
  cooldownRemaining: number;
}

export const CountUpKpiBar: React.FC<CountUpKpiBarProps> = ({
  wordCount,
  estimatedDurationSec,
  resolvedIssuesCount,
  totalIssuesCount,
  cachedSegmentsCount,
  remainingDailyQuota,
  maxDailyQuota,
  cooldownRemaining,
}) => {
  const mins = Math.floor(estimatedDurationSec / 60);
  const secs = Math.round(estimatedDurationSec % 60);
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const kpis = [
    {
      id: 'kpi-words',
      title: 'Tổng số từ & Thời lượng ước tính',
      value: wordCount,
      suffix: ' từ',
      badge: `⏱ ${formattedTime} phút`,
      subtext: 'Đồng hồ đo nhịp đọc theo tốc độ đã chọn',
      icon: FileText,
      accent: 'from-indigo-500/20 to-blue-600/10 border-indigo-500/30',
      iconColor: 'text-indigo-500 dark:text-indigo-400',
    },
    {
      id: 'kpi-issues',
      title: 'Chính tả, Viết tắt & Số liệu xử lý',
      value: resolvedIssuesCount || totalIssuesCount,
      suffix: ` / ${totalIssuesCount} mục`,
      badge: 'Lớp 1 • JSON Schema',
      subtext: 'Tiết kiệm 80% Output Token khi rà soát',
      icon: Sparkles,
      accent: 'from-amber-500/20 to-orange-600/10 border-amber-500/30',
      iconColor: 'text-amber-500 dark:text-amber-400',
    },
    {
      id: 'kpi-cache',
      title: 'Đoạn âm thanh tái sử dụng từ Cache',
      value: cachedSegmentsCount,
      suffix: ' đoạn',
      badge: 'Lớp 2 • IndexedDB Hash',
      subtext: 'Giảm 90–95% chi phí khi sửa câu lẻ',
      icon: Database,
      accent: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
    },
    {
      id: 'kpi-quota',
      title: 'Hạn mức Token Cộng đồng còn lại',
      value: remainingDailyQuota,
      suffix: ` / ${maxDailyQuota} lượt`,
      badge:
        cooldownRemaining > 0
          ? `⏳ Chờ ${cooldownRemaining}s`
          : 'Lớp 4 • Fair-Use Bảo vệ Quỹ',
      subtext: 'Quỹ API Chủ sở hữu (Tối đa 3.000 ký tự/lượt)',
      icon: ShieldCheck,
      accent: 'from-purple-500/20 to-indigo-600/10 border-purple-500/30',
      iconColor: 'text-purple-500 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {kpis.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: idx * 0.08 }}
            whileHover={{ scale: 1.015, y: -2 }}
            className={`bento-card p-4 relative overflow-hidden bg-gradient-to-br ${item.accent}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.title}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl sm:text-3xl text-slate-900 dark:text-white">
                    <CountUpNumber value={item.value} suffix={item.suffix} />
                  </div>
                </div>
              </div>
              <div className={`p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/90 shadow-sm ${item.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {item.subtext}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-900/10 dark:bg-white/10 text-slate-800 dark:text-amber-300 shrink-0">
                {item.id === 'kpi-words' && <Clock className="w-3 h-3 text-amber-500" />}
                {item.badge}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
