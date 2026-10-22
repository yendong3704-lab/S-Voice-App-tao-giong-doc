import React, { useEffect, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Music,
  Sliders,
  Download,
  FileText,
  FileSpreadsheet,
  Copy,
  Calendar,
  Mail,
  Check,
  Sparkles,
  Radio,
  Subtitles,
} from 'lucide-react';
import { BgmThemeId, DialogueTurn, StudioParameters } from '../types/studio';
import { BGM_THEMES } from '../data/studioPresets';
import {
  encodeWavFromFloat32,
  mixVoiceAndBgmWithAutoDucking,
  speakWithWebSpeechFallback,
} from '../services/webAudioEngine';
import {
  buildGmailComposeUrl,
  buildGoogleCalendarUrl,
  exportScriptWordDoc,
  exportStoryboardCsv,
  generateSrtContent,
  generateVttContent,
  triggerBrowserDownload,
} from '../utils/exportUtils';

interface MasterAudioDeckProps {
  voiceSamples: Float32Array;
  durationSec: number;
  turns: DialogueTurn[];
  studioParams: StudioParameters;
  rawScript: string;
  bgmTheme: BgmThemeId;
  onChangeBgmTheme: (theme: BgmThemeId) => void;
  usedFallbackSpeech: boolean;
  isSynthesizing: boolean;
}

export const MasterAudioDeck: React.FC<MasterAudioDeckProps> = ({
  voiceSamples,
  durationSec,
  turns,
  studioParams,
  rawScript,
  bgmTheme,
  onChangeBgmTheme,
  usedFallbackSpeech,
  isSynthesizing,
}) => {
  const [voiceGain, setVoiceGain] = useState<number>(1.0);
  const [bgmGain, setBgmGain] = useState<number>(0.45);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [activeTurnIdx, setActiveTurnIdx] = useState<number>(0);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelFallbackSpeechRef = useRef<(() => void) | null>(null);

  // Tính toán bản trộn Master (Voice + BGM Auto-Ducking -14dB) & Dữ liệu sóng âm Recharts
  const { mixedSamples, waveformBars } = React.useMemo(() => {
    const safeSamples =
      voiceSamples && voiceSamples.length > 0
        ? voiceSamples
        : new Float32Array(24000 * 6);
    return mixVoiceAndBgmWithAutoDucking({
      voiceSamples: safeSamples,
      bgmTheme,
      voiceGain,
      bgmGain,
      autoDucking,
    });
  }, [voiceSamples, bgmTheme, voiceGain, bgmGain, autoDucking]);

  // Dữ liệu Biểu đồ Phân bổ Thời lượng & Chi phí Token theo từng lượt thoại
  const turnTelemetryData = React.useMemo(() => {
    return turns.map((t, i) => ({
      name: `Lượt ${i + 1}`,
      speaker: t.speakerLabel,
      durationSec: Number(t.estimatedDurationSec.toFixed(1)),
      tokens: t.estimatedTokens,
      cached: t.fromCache ? 'Từ Cache (0đ)' : 'Mới tạo',
    }));
  }, [turns]);

  // Đồng bộ Audio Element với dữ liệu WAV đã trộn
  useEffect(() => {
    const wavBuf = encodeWavFromFloat32(mixedSamples, 24000);
    const blob = new Blob([wavBuf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = url;
    } else {
      audioElRef.current = new Audio(url);
    }

    const el = audioElRef.current;
    const onTimeUpdate = () => {
      const cur = el.currentTime;
      setCurrentTimeSec(cur);
      // Xác định câu thoại đang đọc để tô sáng Karaoke/Teleprompter
      let acc = 0;
      for (let i = 0; i < turns.length; i++) {
        const start = turns[i].startTimeSec ?? acc;
        const end = turns[i].endTimeSec ?? start + turns[i].estimatedDurationSec;
        acc = end;
        if (cur >= start && cur <= end) {
          setActiveTurnIdx(i);
          break;
        }
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTimeSec(0);
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);

    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      URL.revokeObjectURL(url);
    };
  }, [mixedSamples, turns]);

  // Vẽ Sóng âm Động (HTML5 Canvas Live Audio Waveform Equalizer)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderFrame = () => {
      phase += 0.09;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 48;
      const barWidth = Math.max(2, (w - barCount * 3) / barCount);
      const progressRatio = durationSec > 0 ? currentTimeSec / durationSec : 0;

      for (let i = 0; i < barCount; i++) {
        const barInfo = waveformBars[Math.min(waveformBars.length - 1, Math.floor((i / barCount) * waveformBars.length))];
        const baseAmp = barInfo ? (barInfo.voiceAmp + barInfo.bgmAmp * 0.6) / 130 : 0.25;
        const liveJitter =
          isPlaying || isSynthesizing
            ? 0.35 + 0.65 * Math.abs(Math.sin(phase + i * 0.32))
            : 1.0;

        const barH = Math.max(5, Math.min(h - 4, baseAmp * liveJitter * (h - 6)));
        const x = i * (barWidth + 3);
        const y = (h - barH) / 2;

        const isPlayed = i / barCount <= progressRatio;
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        if (isSynthesizing) {
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#6366f1');
        } else if (isPlayed) {
          grad.addColorStop(0, '#d97706');
          grad.addColorStop(1, '#6366f1');
        } else {
          grad.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
          grad.addColorStop(1, 'rgba(30, 58, 138, 0.35)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 3);
        ctx.fill();
      }

      if (isPlaying || isSynthesizing) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => cancelAnimationFrame(animId);
  }, [waveformBars, isPlaying, isSynthesizing, currentTimeSec, durationSec]);

  const handleTogglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      cancelFallbackSpeechRef.current?.();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      el.play().catch(() => {});
      if (usedFallbackSpeech) {
        cancelFallbackSpeechRef.current = speakWithWebSpeechFallback({
          turns,
          lang: studioParams.language,
          speed: studioParams.speed,
          pitch: studioParams.pitch,
          onTurnStart: (idx) => setActiveTurnIdx(idx),
        });
      }
    }
  };

  const handleResetPlayback = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    cancelFallbackSpeechRef.current?.();
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setActiveTurnIdx(0);
  };

  const handleDownloadPureWav = () => {
    const wavBuf = encodeWavFromFloat32(voiceSamples, 24000);
    const blob = new Blob([wavBuf], { type: 'audio/wav' });
    triggerBrowserDownload(blob, `S-voice-Pure-Studio-24kHz-${Date.now()}.wav`);
  };

  const handleDownloadMixedMaster = () => {
    const wavBuf = encodeWavFromFloat32(mixedSamples, 24000);
    const blob = new Blob([wavBuf], { type: 'audio/wav' });
    triggerBrowserDownload(blob, `S-voice-Master-Mixed-AutoDucking-${Date.now()}.wav`);
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtContent(turns);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    triggerBrowserDownload(blob, `S-voice-Subtitle-${Date.now()}.srt`);
  };

  const handleDownloadVtt = () => {
    const vtt = generateVttContent(turns);
    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
    triggerBrowserDownload(blob, `S-voice-Subtitle-${Date.now()}.vtt`);
  };

  const handleCopyScript = () => {
    const fullText = turns.map((t) => `[${t.speakerLabel}]: ${t.text}`).join('\n\n');
    navigator.clipboard.writeText(fullText).catch(() => {});
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const fmtClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 mt-6">
      {/* BÀN ĐIỀU KHIỂN ÂM THANH PHÒNG THU (MASTER AUDIO DECK) */}
      <div className="bento-card p-5 border-indigo-500/30 dark:border-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-amber-600 text-white shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Bàn điều khiển Âm thanh Phòng thu (Master Audio Deck • 24kHz PCM)
                </h3>
                {autoDucking && bgmTheme !== 'none' && (
                  <span className="studio-badge bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-mono">
                    Auto-Ducking -14dB ON
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trộn giọng đọc AI đa vùng miền với bộ tổng hợp nhạc nền Web Audio & phụ đề Teleprompter theo thời gian thực
              </p>
            </div>
          </div>

          {/* Đồng hồ thời gian Master */}
          <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl border border-slate-700 font-mono text-sm">
            <Radio className={`w-4 h-4 ${isPlaying ? 'text-amber-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className="text-amber-400 font-bold">{fmtClock(currentTimeSec)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{fmtClock(durationSec)}</span>
          </div>
        </div>

        {/* Sóng âm Canvas trực tiếp + Nút Play/Pause */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Tạm dừng' : 'Phát Bản Master'}
            </button>
            <button
              type="button"
              onClick={handleResetPlayback}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              title="Đưa về đầu"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {turns[activeTurnIdx]?.speakerLabel || 'Sẵn sàng'}
              </div>
              <div className="font-mono text-[11px]">Lượt {activeTurnIdx + 1}/{turns.length}</div>
            </div>
          </div>

          <div className="lg:col-span-8 bg-slate-950/90 rounded-xl p-3 border border-slate-800">
            <canvas
              ref={canvasRef}
              width={640}
              height={54}
              className="w-full h-14 block"
            />
          </div>
        </div>

        {/* Bộ trộn Âm lượng Voice Gain, BGM Gain, Auto-Ducking & Chọn 5 Nhạc nền */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-500" /> Âm lượng Giọng (Voice Gain)
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {Math.round(voiceGain * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.05}
              value={voiceGain}
              onChange={(e) => setVoiceGain( parseFloat(e.target.value) )}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="flex items-center gap-1.5">
                <Music className="w-4 h-4 text-amber-500" /> Âm lượng Nhạc nền (BGM Gain)
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {Math.round(bgmGain * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgmGain}
              onChange={(e) => setBgmGain(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between">
            <label className="text-xs font-semibold flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-500" /> Chọn Nhạc nền Phòng thu (5 chủ đề)
            </label>
            <select
              value={bgmTheme}
              onChange={(e) => onChangeBgmTheme(e.target.value as BgmThemeId)}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
            >
              {BGM_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold">Auto-Ducking (-14dB)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Tự hạ nhạc khi có tiếng đọc & nâng nhạc ở khoảng nghỉ
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoDucking}
              onClick={() => setAutoDucking(!autoDucking)}
              className={`w-12 h-6 rounded-full transition-colors p-0.5 ${
                autoDucking ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                  autoDucking ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Phụ đề chạy đồng bộ theo thời gian thực (Karaoke / Teleprompter Highlight) */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Subtitles className="w-3.5 h-3.5" /> Bảng Phụ đề Đồng bộ Thời gian thực (Teleprompter Highlight)
            </span>
            <span className="font-mono">Chuẩn Timecode .SRT / .VTT</span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
            {turns.map((turn, idx) => {
              const isCurrent = idx === activeTurnIdx;
              return (
                <button
                  key={turn.id}
                  type="button"
                  onClick={() => {
                    setActiveTurnIdx(idx);
                    if (audioElRef.current && turn.startTimeSec !== undefined) {
                      audioElRef.current.currentTime = turn.startTimeSec;
                    }
                  }}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs transition-all border ${
                    isCurrent
                      ? 'bg-indigo-600/30 border-amber-400 text-white font-semibold shadow-sm'
                      : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-mono text-amber-400 mr-1.5">
                    [{turn.speakerLabel}]:
                  </span>
                  <span>{turn.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dải nút bấm Kết nối & Xuất bản (Yếu tố 5) */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPureWav}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-all"
          >
            <Download className="w-3.5 h-3.5" /> ⬇️ Tải Âm thanh .WAV (Chuẩn Phòng thu 24kHz)
          </button>

          <button
            type="button"
            onClick={handleDownloadMixedMaster}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-all"
          >
            <Music className="w-3.5 h-3.5" /> 🎵 Tải File Âm thanh Đã Trộn Nhạc Nền
          </button>

          <button
            type="button"
            onClick={handleDownloadSrt}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Subtitles className="w-3.5 h-3.5 text-indigo-500" /> 📝 Xuất Phụ đề .SRT
          </button>

          <button
            type="button"
            onClick={handleDownloadVtt}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Subtitles className="w-3.5 h-3.5 text-teal-500" /> Xuất .VTT
          </button>

          <button
            type="button"
            onClick={() => exportScriptWordDoc(turns, studioParams, rawScript)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" /> 📄 Xuất Kịch bản Word (.doc)
          </button>

          <button
            type="button"
            onClick={() => exportStoryboardCsv(turns, studioParams)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Bảng phân cảnh Excel (.csv)
          </button>

          <button
            type="button"
            onClick={handleCopyScript}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            {copiedScript ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" /> Đã sao chép!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> 📋 Sao chép Kịch bản
              </>
            )}
          </button>

          <a
            href={buildGoogleCalendarUrl(turns, studioParams)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" /> 📅 Tạo lịch xuất bản Google Calendar
          </a>

          <a
            href={buildGmailComposeUrl(turns, studioParams)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> ✉️ Mở Gmail gửi Kịch bản & Thông số
          </a>
        </div>
      </div>

      {/* 2 BIỂU ĐỒ TRỰC QUAN RECHARTS (YẾU TỐ 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ 1: Phổ Sóng âm Tương tác (Voice vs Auto-Ducked BGM) */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Biểu đồ Phổ Sóng âm & Đường bao Auto-Ducking (Interactive Waveform)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đối chiếu biên độ Giọng đọc (Tím Sóng âm) và Nhạc nền tự động hạ -14dB (Vàng đồng)
              </p>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500">
              24kHz PCM
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={waveformBars}>
                <defs>
                  <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorBgm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="timeSec"
                  tickFormatter={(v) => `${v}s`}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value}%`,
                    name === 'voiceAmp' ? 'Biên độ Giọng đọc AI' : 'Biên độ Nhạc nền (Auto-Ducked)',
                  ]}
                  labelFormatter={(label) => `Mốc thời gian: ${label} giây`}
                />
                <Legend
                  formatter={(val) =>
                    val === 'voiceAmp' ? 'Biên độ Giọng đọc' : 'Biên độ Nhạc nền (Auto-Ducking)'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="voiceAmp"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVoice)"
                />
                <Area
                  type="monotone"
                  dataKey="bgmAmp"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBgm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ 2: Phân bổ Thời lượng & Chi phí Token theo từng lượt thoại */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Biểu đồ Phân bổ Thời lượng (Giây) & Chi phí Token theo Lượt thoại
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rà chuột vào từng cột để xem chi tiết Vai đọc, Thời lượng và trạng thái Cache
              </p>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
              Token Analytics
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnTelemetryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    if (name === 'durationSec') {
                      return [`${value} giây (${props.payload.speaker})`, 'Thời lượng đọc'];
                    }
                    return [`${value} tokens (${props.payload.cached})`, 'Ước tính Token'];
                  }}
                />
                <Legend
                  formatter={(val) =>
                    val === 'durationSec' ? 'Thời lượng (Giây)' : 'Chi phí Token ước tính'
                  }
                />
                <Bar dataKey="durationSec" fill="#d97706" radius={[6, 6, 0, 0]} />
                <Bar dataKey="tokens" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
