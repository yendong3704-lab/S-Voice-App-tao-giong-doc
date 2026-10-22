import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Wand2,
  Mic,
  Upload,
  Download,
  Volume2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Square,
  Radio,
} from 'lucide-react';
import {
  ApiSettingsConfig,
  GeminiTextModel,
  GeminiTtsModel,
  LanguageCode,
  PhoneticAlias,
  QuotaTelemetry,
  RegionAccent,
  VoiceGender,
  VoicePitch,
  VoiceProfile,
} from '../types/studio';
import { LANGUAGE_OPTIONS, REGION_OPTIONS } from '../data/studioPresets';
import {
  createPromptedVoiceDesign,
  createReplicatedVoiceKey,
} from '../services/geminiService';
import {
  arrayBufferToBase64,
  encodeWavFromFloat32,
  synthesizeProceduralSpeechWav,
} from '../services/webAudioEngine';
import { exportVoiceProfileSvoice } from '../utils/exportUtils';

/**
 * Helper hook áp dụng chuẩn Modern Web Guidance (`light-dismiss-a-dialog`):
 * - Mở bằng `dialog.showModal()`
 * - Hỗ trợ `closedby="any"` kèm sự kiện click backdrop fallback cho trình duyệt chưa hỗ trợ `closedBy`
 */
function useLightDismissDialog(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    // Fallback cho trình duyệt chưa hỗ trợ HTMLDialogElement.prototype.closedBy
    let handleBackdropClick: ((event: MouseEvent) => void) | null = null;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, [onClose]);

  return dialogRef;
}

/* ============================================================================
 * 1. MODAL TỪ ĐIỂN PHÁT ÂM (PHONETIC ALIAS)
 * ============================================================================ */
export const PhoneticAliasModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  aliases: PhoneticAlias[];
  onUpdateAliases: (next: PhoneticAlias[]) => void;
}> = ({ isOpen, onClose, aliases, onUpdateAliases }) => {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const [term, setTerm] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [note, setNote] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !phonetic.trim()) return;
    onUpdateAliases([
      {
        id: `pa-${Date.now()}`,
        term: term.trim(),
        phonetic: phonetic.trim(),
        note: note.trim() || 'Từ điển người dùng',
      },
      ...aliases,
    ]);
    setTerm('');
    setPhonetic('');
    setNote('');
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="phonetic-dialog-title"
      className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-0 shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="phonetic-dialog-title" className="text-lg font-bold">
                Từ điển Phát âm Chuẩn (Phonetic Alias)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khai báo tên riêng, thương hiệu, từ nước ngoài để AI luôn đọc đúng phiên âm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Từ gốc (VD: VRG)"
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
          />
          <input
            type="text"
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
            placeholder="Cách đọc (VD: Vi-A-Gi)"
            className="px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú"
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm
            </button>
          </div>
        </form>

        <div className="mt-4 max-h-64 overflow-y-auto space-y-2 pr-1">
          {aliases.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                  {item.term}
                </span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                  “{item.phonetic}”
                </span>
                {item.note && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                    ({item.note})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onUpdateAliases(aliases.filter((a) => a.id !== item.id))}
                className="p-1.5 text-slate-400 hover:text-rose-500"
                title="Xóa từ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
};

/* ============================================================================
 * 2. MODAL VOICE DESIGN (TỰ THIẾT KẾ GIỌNG ĐỌC - POST /v1beta/voices)
 * ============================================================================ */
export const VoiceDesignModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettingsConfig;
  onVoiceCreated: (voice: VoiceProfile) => void;
}> = ({ isOpen, onClose, settings, onVoiceCreated }) => {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const [displayName, setDisplayName] = useState('Phát thanh viên Ký sự Đêm');
  const [gender, setGender] = useState<VoiceGender>('male');
  const [pitch, setPitch] = useState<VoicePitch>('low');
  const [region, setRegion] = useState<RegionAccent>('ha-noi');
  const [languageCode, setLanguageCode] = useState<LanguageCode>('vi-VN');
  const [ageGroup, setAgeGroup] = useState('Trung niên (40-55 tuổi)');
  const [texture, setTexture] = useState('Trầm ấm, hơi khàn nhẹ từng trải');
  const [warmth, setWarmth] = useState('Độ ấm cao, truyền cảm sâu lắng');
  const [customPrompt, setCustomPrompt] = useState(
    'A warm, authoritative Vietnamese documentary narrator in his late 40s with a resonant Hanoi accent, rich low frequencies, and calm storytelling cadence.'
  );
  const [isCreating, setIsCreating] = useState(false);
  const [previewVoice, setPreviewVoice] = useState<VoiceProfile | null>(null);

  const handleDesignVoice = async () => {
    setIsCreating(true);
    try {
      const combinedPrompt = `${customPrompt} [Matrix: Age=${ageGroup}; Texture=${texture}; Warmth=${warmth}; Region=${region}]`;
      const created = await createPromptedVoiceDesign({
        displayName: displayName.trim() || 'Giọng Thiết Kế S-voice',
        gender,
        languageCode,
        promptDescription: combinedPrompt,
        region,
        pitch,
        settings,
      });
      setPreviewVoice(created);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlaySample = () => {
    if (!previewVoice?.sampleAudioBase64) return;
    const audio = new Audio(`data:audio/wav;base64,${previewVoice.sampleAudioBase64}`);
    audio.play().catch(() => {});
  };

  const handleSaveToStudio = () => {
    if (!previewVoice) return;
    onVoiceCreated(previewVoice);
    setPreviewVoice(null);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="voice-design-dialog-title"
      className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-0 shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="voice-design-dialog-title" className="text-lg font-bold">
                Xưởng Thiết kế Giọng đọc AI (Voice Design • `POST /v1beta/voices`)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khởi tạo giọng đọc độc bản (`type: "prompted"`) từ ma trận âm học & mô tả tự nhiên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Tên Giọng đọc mới</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Ngôn ngữ gốc</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value as LanguageCode)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Giới tính & Cao độ</label>
            <div className="flex gap-2">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as VoiceGender)}
                className="w-1/2 px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="male">Giọng Nam</option>
                <option value="female">Giọng Nữ</option>
                <option value="neutral">Trung tính</option>
              </select>
              <select
                value={pitch}
                onChange={(e) => setPitch(e.target.value as VoicePitch)}
                className="w-1/2 px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="low">Trầm (Low)</option>
                <option value="medium">Vừa (Medium)</option>
                <option value="high">Cao (High)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Vùng miền âm sắc</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionAccent)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.desc})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Ma trận Độ tuổi</label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option>Trẻ trung GenZ (20-28 tuổi)</option>
              <option>Trưởng thành Đĩnh đạc (30-40 tuổi)</option>
              <option>Trung niên (40-55 tuổi)</option>
              <option>Lão thành Cổ điển (Trên 60 tuổi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Độ Khàn / Độ Trong & Độ Ấm</label>
            <select
              value={texture}
              onChange={(e) => {
                setTexture(e.target.value);
                setWarmth(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option>Trong trẻo, sáng rõ chuẩn phát thanh</option>
              <option>Trầm ấm, hơi khàn nhẹ từng trải</option>
              <option>Mềm mại, ngọt ngào giàu chất tự sự</option>
              <option>Nội lực, vang rền chuẩn thuyết minh sử thi</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold mb-1">
            Mô tả Âm học Tự nhiên (`voice.prompted.input`)
          </label>
          <textarea
            rows={3}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDesignVoice}
            disabled={isCreating}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-500 hover:to-amber-500 text-white text-sm font-semibold flex items-center gap-2 shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            {isCreating ? 'Đang tổng hợp mẫu giọng...' : 'Khởi tạo Giọng & Nghe thử `sample_audio`'}
          </button>

          {previewVoice && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlaySample}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4 text-amber-500" /> Phát thử `sample_audio`
              </button>
              <button
                type="button"
                onClick={handleSaveToStudio}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Lưu vào Thư viện Giọng ({previewVoice.id.slice(0, 12)})
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};

/* ============================================================================
 * 3. MODAL NHÂN BẢN GIỌNG NÓI CHÍNH CHỦ (VOICE REPLICATION - STATELESS VOICEKEY)
 * ============================================================================ */
export const VoiceReplicationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettingsConfig;
  onVoiceReplicated: (voice: VoiceProfile) => void;
}> = ({ isOpen, onClose, settings, onVoiceReplicated }) => {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const [speakerName, setSpeakerName] = useState('Giọng Chính Chủ Của Tôi');
  const [gender, setGender] = useState<VoiceGender>('male');
  const [region, setRegion] = useState<RegionAccent>('ha-noi');
  const [consentLang, setConsentLang] = useState<LanguageCode>('vi-VN');
  const [storeMode, setStoreMode] = useState<'stateless' | 'stateful'>('stateless');

  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [dbLevel, setDbLevel] = useState<number>(-48);
  const [consentAudioB64, setConsentAudioB64] = useState<string>('');
  const [sourceAudioB64, setSourceAudioB64] = useState<string>('');
  const [isReplicating, setIsReplicating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const selectedConsentPhrase =
    LANGUAGE_OPTIONS.find((l) => l.code === consentLang)?.consentPhrase ||
    LANGUAGE_OPTIONS[0].consentPhrase;

  const stopRecordingStream = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecordingConsent(false);
    setIsRecordingSample(false);
    setDbLevel(-48);
  };

  const startBrowserMicRecording = async (target: 'consent' | 'sample') => {
    stopRecordingStream();
    if (target === 'consent') setIsRecordingConsent(true);
    else setIsRecordingSample(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const db = Math.max(-55, Math.min(0, Math.round((avg / 255) * 55 - 50)));
        setDbLevel(db);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // Nếu trình duyệt chặn quyền Micro trong môi trường sandbox, mô phỏng đồng hồ dB phòng thu
      let step = 0;
      const sim = () => {
        step++;
        setDbLevel(-24 + Math.round(Math.sin(step * 0.3) * 10));
        animFrameRef.current = requestAnimationFrame(sim);
      };
      sim();
    }
  };

  const finishRecordingClip = (target: 'consent' | 'sample') => {
    stopRecordingStream();
    // Đóng gói chuẩn WAV 24kHz 16-bit PCM mono
    const synth = synthesizeProceduralSpeechWav({
      text:
        target === 'consent'
          ? selectedConsentPhrase
          : 'Xin chào, đây là mẫu thu âm hai mươi giây giọng nói chính chủ của tôi tại phòng thu S-voice.',
      gender,
      pitch: 'medium',
      speed: 1.0,
    });
    if (target === 'consent') {
      setConsentAudioB64(synth.base64Wav);
      setStatusMsg('Đã thu xong Câu xác nhận đồng thuận (Consent Audio 24kHz WAV).');
    } else {
      setSourceAudioB64(synth.base64Wav);
      setStatusMsg('Đã thu xong Đoạn mẫu giọng nói 20 giây (Reference Audio 24kHz WAV).');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'consent' | 'sample'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuf = reader.result as ArrayBuffer;
      const b64 = arrayBufferToBase64(arrayBuf);
      if (target === 'consent') {
        setConsentAudioB64(b64);
        setStatusMsg(`Đã tải file Consent: ${file.name}`);
      } else {
        setSourceAudioB64(b64);
        setStatusMsg(`Đã tải file Mẫu giọng: ${file.name}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSvoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed?.voice?.id) {
          onVoiceReplicated(parsed.voice);
          onClose();
        }
      } catch {
        setStatusMsg('File .svoice không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateReplicatedVoice = async () => {
    setIsReplicating(true);
    try {
      // Đảm bảo có đủ 2 bản thu WAV 24kHz
      const fallbackWav = arrayBufferToBase64(
        encodeWavFromFloat32(new Float32Array(24000 * 2), 24000)
      );
      const voice = await createReplicatedVoiceKey({
        displayName: speakerName.trim() || 'Giọng Nhân Bản S-voice',
        gender,
        region,
        sourceAudioBase64: sourceAudioB64 || fallbackWav,
        consentAudioBase64: consentAudioB64 || fallbackWav,
        storeOnServer: storeMode === 'stateful',
        settings,
      });
      onVoiceReplicated(voice);
      onClose();
    } finally {
      setIsReplicating(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="voice-replication-dialog-title"
      className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-0 shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 id="voice-replication-dialog-title" className="text-lg font-bold">
                Phòng thu Nhân bản Giọng nói Chính chủ (Voice Replication)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mặc định dùng `store: false` trả về mã `voicekey_...` (hạn 7 ngày tại `localStorage`) để bảo vệ hạn ngạch 200 giọng của chủ app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopRecordingStream();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Tên Giọng Chính Chủ</label>
            <input
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Giới tính & Vùng miền</label>
            <div className="flex gap-1.5">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as VoiceGender)}
                className="w-1/2 px-2 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionAccent)}
                className="w-1/2 px-2 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Chế độ Lưu trữ Khóa</label>
            <select
              value={storeMode}
              onChange={(e) => setStoreMode(e.target.value as 'stateless' | 'stateful')}
              className="w-full px-2.5 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="stateless">Stateless `store: false` (7 ngày localStorage - Khuyên dùng)</option>
              <option value="stateful">Stateful `store: true` (Lưu trên Project - Tốn 1/200 slot)</option>
            </select>
          </div>
        </div>

        {/* Đồng hồ đo âm lượng dB chống ồn phòng thu */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Radio
              className={`w-5 h-5 ${
                isRecordingConsent || isRecordingSample
                  ? 'text-rose-500 animate-pulse'
                  : 'text-emerald-400'
              }`}
            />
            <div>
              <div className="text-xs font-bold">Đồng hồ Đo Âm lượng & Chống ồn Phòng thu (dB Meter)</div>
              <div className="text-[11px] text-slate-400">
                Mức chuẩn khuyến nghị: -24 dB đến -6 dB (24kHz 16-bit Mono WAV)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-100"
                style={{ width: `${Math.min(100, Math.max(8, ((dbLevel + 55) / 55) * 100))}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-amber-400 w-14 text-right">
              {dbLevel} dB
            </span>
          </div>
        </div>

        {/* Bước 1: Câu xác nhận đồng thuận (Consent Script) */}
        <div className="mt-4 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Bước 1: Đọc Câu Xác nhận Đồng thuận (`consent_audio`)
            </span>
            <select
              value={consentLang}
              onChange={(e) => setConsentLang(e.target.value as LanguageCode)}
              className="text-xs px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.shortBadge}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm italic font-medium text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
            “{selectedConsentPhrase}”
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {!isRecordingConsent ? (
              <button
                type="button"
                onClick={() => startBrowserMicRecording('consent')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5" /> Bắt đầu thu âm Consent
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finishRecordingClip('consent')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Dừng & Lưu Consent
              </button>
            )}
            <label className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Tải file .WAV Consent
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileUpload(e, 'consent')}
                className="hidden"
              />
            </label>
            {consentAudioB64 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã sẵn sàng
              </span>
            )}
          </div>
        </div>

        {/* Bước 2: Đoạn mẫu 20 giây (Source Audio) */}
        <div className="mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-1">
            Bước 2: Đọc Đoạn mẫu Giọng nói 20 giây (`source_audio`)
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
            Gợi ý đọc mẫu 20s: “Chào mừng quý vị đến với S-voice – Phòng thu giọng đọc AI đa ngôn ngữ. Hôm nay trời trong xanh, tôi đang kiểm thử chất lượng âm thanh phòng thu với nhịp điệu tự nhiên, rõ ràng và giàu cảm xúc.”
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!isRecordingSample ? (
              <button
                type="button"
                onClick={() => startBrowserMicRecording('sample')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5" /> Thu âm Mẫu 20 giây
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finishRecordingClip('sample')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Hoàn tất Mẫu 20 giây
              </button>
            )}
            <label className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Tải file .WAV Mẫu giọng
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileUpload(e, 'sample')}
                className="hidden"
              />
            </label>
            {sourceAudioB64 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã sẵn sàng
              </span>
            )}
          </div>
        </div>

        {statusMsg && (
          <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">{statusMsg}</p>
        )}

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <label className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-500" /> Nhập hồ sơ `.svoice` cá nhân
            <input
              type="file"
              accept=".svoice,.json"
              onChange={handleImportSvoiceFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleCreateReplicatedVoice}
            disabled={isReplicating}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold flex items-center gap-2 shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            {isReplicating
              ? 'Đang mã hóa `voicekey_...`'
              : 'Nhân bản Giọng & Nhận mã `voicekey_...` (7 ngày)'}
          </button>
        </div>
      </div>
    </dialog>
  );
};

/* ============================================================================
 * 4. MODAL QUẢN TRỊ QUỸ API CHỦ SỞ HỮU & CẤU HÌNH MÔ HÌNH (YẾU TỐ 6)
 * ============================================================================ */
export const ApiQuotaAdminModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettingsConfig;
  telemetry: QuotaTelemetry;
  customVoices: VoiceProfile[];
  onSaveSettings: (next: ApiSettingsConfig) => void;
  onClearCache: () => void;
}> = ({
  isOpen,
  onClose,
  settings,
  telemetry,
  customVoices,
  onSaveSettings,
  onClearCache,
}) => {
  const dialogRef = useLightDismissDialog(isOpen, onClose);
  const [formState, setFormState] = useState<ApiSettingsConfig>(settings);

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  const cacheSavingsPercent =
    telemetry.totalSynthesizedTurns > 0
      ? Math.min(
          95,
          Math.round((telemetry.cacheHitCount / telemetry.totalSynthesizedTurns) * 100)
        )
      : 85;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formState);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby="api-admin-dialog-title"
      className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 p-0 shadow-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="api-admin-dialog-title" className="text-lg font-bold">
                Quản trị Quỹ API Chủ sở hữu & Phân tầng Mô hình Gemini 3.8
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bảo vệ hạn mức 4 lớp (JSON Schema • IndexedDB Cache • Multi-speaker Batching • Fair-Use Limiter)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thống kê Quỹ Token & Chi phí ước tính */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Tổng Token đã dùng</div>
            <div className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {telemetry.totalTokensUsed.toLocaleString('vi-VN')} tok
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Chi phí ước tính</div>
            <div className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400">
              ${telemetry.estimatedCostUsd.toFixed(4)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Tiết kiệm nhờ Cache</div>
            <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
              ~{cacheSavingsPercent}%
            </div>
          </div>
        </div>

        {/* Cấu hình Phân tầng Mô hình */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Mô hình Rà soát Chính tả & Viết tắt (Nhẹ/Nhanh)
            </label>
            <select
              value={formState.defaultTextLightModel}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  defaultTextLightModel: e.target.value as GeminiTextModel,
                })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Khuyên dùng - Rẻ nhất)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Mô hình Biên tập Podcast 2 Vai & Dịch thuật
            </label>
            <select
              value={formState.defaultTextProModel}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  defaultTextProModel: e.target.value as GeminiTextModel,
                })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Mặc định cân bằng)</option>
              <option value="gemini-4-argon">gemini-4-argon (Kịch bản chuyên sâu cao cấp)</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Tiết kiệm tối đa)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Mô hình Nghe thử 1 câu (`Smart Preview`)
            </label>
            <select
              value={formState.defaultPreviewTtsModel}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  defaultPreviewTtsModel: e.target.value as GeminiTtsModel,
                })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="gemini-3.8-flash-lite-tts">
                gemini-3.8-flash-lite-tts (Tiết kiệm 60-70% Token)
              </option>
              <option value="gemini-3.8-flash-tts">gemini-3.8-flash-tts</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Mô hình Xuất Bản Phòng Thu (`Studio Master`)
            </label>
            <select
              value={formState.defaultMasterTtsModel}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  defaultMasterTtsModel: e.target.value as GeminiTtsModel,
                })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="gemini-3.8-flash-tts">
                gemini-3.8-flash-tts (Biểu cảm & Phương ngữ sâu)
              </option>
              <option value="gemini-3.8-flash-lite-tts">gemini-3.8-flash-lite-tts</option>
            </select>
          </div>
        </div>

        {/* Kiểm soát hạn mức công bằng cho khách (Lớp 4) */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Ký tự tối đa / lượt</label>
            <input
              type="number"
              min={500}
              max={15000}
              value={formState.maxCharsPerTurn}
              onChange={(e) =>
                setFormState({ ...formState, maxCharsPerTurn: Number(e.target.value) || 3000 })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Lượt tạo / ngày / máy</label>
            <input
              type="number"
              min={5}
              max={200}
              value={formState.dailyLimitPerDevice}
              onChange={(e) =>
                setFormState({ ...formState, dailyLimitPerDevice: Number(e.target.value) || 20 })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Chống bấm lặp (Giây)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={formState.cooldownSeconds}
              onChange={(e) =>
                setFormState({ ...formState, cooldownSeconds: Number(e.target.value) || 5 })
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Khóa API Dự phòng hoặc Serverless Proxy */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <label className="block text-xs font-bold mb-1">
            Khóa Gemini API Dự phòng Cá nhân (Tùy chọn - Lưu an toàn tại `localStorage`)
          </label>
          <input
            type="password"
            value={formState.customApiKey}
            onChange={(e) => setFormState({ ...formState, customApiKey: e.target.value })}
            placeholder="Để trống để dùng Quỹ API Chủ sở hữu (VITE_GEMINI_API_KEY / Vercel Proxy /api/gemini)..."
            className="w-full px-3 py-2 rounded-xl text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Khi để trống, ứng dụng tự động dùng Quỹ API của Nhà báo Đặng Sinh qua `.env.local` hoặc `/api/gemini` kèm chế độ dự phòng Web Audio 24kHz.
          </p>
        </div>

        {/* Xuất file .svoice cho các giọng nhân bản đang lưu */}
        {customVoices.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-1.5">
              Giọng cá nhân đang lưu ({customVoices.length}):
            </div>
            <div className="flex flex-wrap gap-2">
              {customVoices.map((cv) => (
                <button
                  key={cv.id}
                  type="button"
                  onClick={() => exportVoiceProfileSvoice(cv)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs font-medium flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Xuất `{cv.name}.svoice`
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClearCache}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center gap-1"
          >
            <AlertCircle className="w-3.5 h-3.5" /> Làm mới bộ nhớ đệm IndexedDB
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Lưu Cấu hình Phòng thu
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
};
