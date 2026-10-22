import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2,
  Sparkles,
  SearchCheck,
  BookOpen,
  Users,
  Languages,
  Wand2,
  Mic,
  KeyRound,
  Sun,
  Moon,
  Upload,
  Check,
  CheckCheck,
  Headphones,
  Clapperboard,
  Zap,
  Clock,
  Volume2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpAZ,
  Shield,
  Database,
} from 'lucide-react';
import {
  ApiSettingsConfig,
  BgmThemeId,
  DeliveryAxis,
  DialogueTurn,
  GenreType,
  LanguageCode,
  MoodAxis,
  PhoneticAlias,
  QuotaTelemetry,
  ReadingSpeed,
  RegionAccent,
  StudioParameters,
  TextIssueItem,
  VoiceGender,
  VoicePitch,
  VoiceProfile,
} from './types/studio';
import {
  BACKCHANNEL_TAGS,
  DEFAULT_PHONETIC_ALIASES,
  DELIVERY_AXIS_OPTIONS,
  EXPRESSION_TAGS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  MOOD_AXIS_OPTIONS,
  REGION_OPTIONS,
  SAMPLE_PRESETS,
  SIGNATURE_VOICES,
} from './data/studioPresets';
import {
  analyzeScriptIssues,
  convertToDualSpeakerPodcast,
  detectScriptLanguage,
  getDefaultApiSettings,
  QUOTA_STORAGE_KEY,
  saveApiSettings,
  synthesizeStudioAudio,
  translateScriptForDubbing,
} from './services/geminiService';
import { clearAudioCache, getCachedAudioCount } from './services/audioCache';
import {
  speakWithWebSpeechFallback,
  synthesizeProceduralSpeechWav,
} from './services/webAudioEngine';
import { CountUpKpiBar } from './components/CountUpKpiBar';
import {
  ApiQuotaAdminModal,
  PhoneticAliasModal,
  VoiceDesignModal,
  VoiceReplicationModal,
} from './components/VoiceWorkshopModals';
import { MasterAudioDeck } from './components/MasterAudioDeck';

const CUSTOM_VOICES_STORAGE_KEY = 'svoice_custom_voices_v1';
const PHONETIC_STORAGE_KEY = 'svoice_phonetic_aliases_v1';

export function App() {
  // Chế độ Sáng / Tối chuẩn Modern Web Guidance (`dark-mode-toggle`)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('color-scheme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('color-scheme', theme);
    } catch {}
  }, [theme]);

  // Đồng bộ chế độ sáng/tối giữa các tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Cấu hình API & Hạn mức Bảo vệ Quỹ Chủ sở hữu (4-Layer Protection)
  const [apiSettings, setApiSettings] = useState<ApiSettingsConfig>(() =>
    getDefaultApiSettings()
  );

  const [telemetry, setTelemetry] = useState<QuotaTelemetry>(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lastResetDate === todayStr) {
          return parsed;
        }
      }
    } catch {}
    return {
      dailyUsedCount: 1,
      dailyMaxLimit: 20,
      maxCharsPerTurn: 3000,
      cooldownSeconds: 5,
      totalTokensUsed: 224,
      estimatedCostUsd: 0.0004,
      cacheHitCount: 3,
      totalSynthesizedTurns: 3,
      lastResetDate: todayStr,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(telemetry));
    } catch {}
  }, [telemetry]);

  // Danh sách Giọng đọc (5 Giọng Tiêu biểu + Giọng Cá nhân lưu trong localStorage)
  const [customVoices, setCustomVoices] = useState<VoiceProfile[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_VOICES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const allVoices = React.useMemo(
    () => [...SIGNATURE_VOICES, ...customVoices],
    [customVoices]
  );

  const handleAddCustomVoice = (voice: VoiceProfile) => {
    const next = [voice, ...customVoices];
    setCustomVoices(next);
    try {
      localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setStudioParams((prev) => ({
      ...prev,
      speaker1VoiceId: voice.id,
      speaker1Name: voice.name,
      gender: voice.gender,
      region: voice.region,
      pitch: voice.pitch,
    }));
  };

  // Từ điển Phát âm (Phonetic Alias)
  const [phoneticAliases, setPhoneticAliases] = useState<PhoneticAlias[]>(() => {
    try {
      const saved = localStorage.getItem(PHONETIC_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PHONETIC_ALIASES;
  });

  const handleUpdatePhonetics = (next: PhoneticAlias[]) => {
    setPhoneticAliases(next);
    try {
      localStorage.setItem(PHONETIC_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Dữ liệu Mẫu đang chọn (Mặc định nạp sẵn Mẫu 1 để mở trang là có đủ biểu đồ & sóng âm)
  const initialSample = SAMPLE_PRESETS[0];
  const [activeSampleId, setActiveSampleId] = useState<string>(initialSample.id);
  const [rawScript, setRawScript] = useState<string>(initialSample.rawScript);
  const [detectedLang, setDetectedLang] = useState<LanguageCode>('vi-VN');
  const [bgmTheme, setBgmTheme] = useState<BgmThemeId>(initialSample.bgmTheme);

  const [studioParams, setStudioParams] = useState<StudioParameters>({
    language: 'vi-VN',
    genre: 'investigative-report',
    speakerMode: 'single',
    gender: 'male',
    pitch: 'low',
    region: 'ha-noi',
    speed: 1.0,
    mood: 'calm-serious',
    delivery: 'news-anchor',
    speaker1VoiceId: 'voice-dang-sinh-hn',
    speaker2VoiceId: 'voice-ngoc-ha-sg',
    speaker1Name: 'Nhà báo Đặng Sinh',
    speaker2Name: 'MC Ngọc Hà',
  });

  const [issues, setIssues] = useState<TextIssueItem[]>(() =>
    initialSample.precomputedIssues.map((item, idx) => ({
      ...item,
      id: `init-issue-${idx}`,
      accepted: false,
    }))
  );

  const [turns, setTurns] = useState<DialogueTurn[]>(() =>
    initialSample.precomputedTurns.map((t, idx) => ({
      ...t,
      id: `init-turn-${idx}`,
    }))
  );

  // Dữ liệu âm thanh Master 24kHz
  const [masterVoiceSamples, setMasterVoiceSamples] = useState<Float32Array>(() => {
    const initialJoined = initialSample.precomputedTurns.map((t) => t.text).join(' ');
    return synthesizeProceduralSpeechWav({
      text: initialJoined,
      gender: 'male',
      pitch: 'low',
      speed: 1.0,
    }).samples;
  });
  const [masterDurationSec, setMasterDurationSec] = useState<number>(37.0);
  const [usedFallbackSpeech, setUsedFallbackSpeech] = useState<boolean>(true);
  const [cachedCountInDb, setCachedCountInDb] = useState<number>(3);

  // Trạng thái tiến trình & Skeleton Shimmer
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'warning';
    text: string;
  } | null>({
    type: 'info',
    text: 'Đã nạp sẵn Mẫu 1 (Phóng sự điều tra - Giọng Nhà báo Đặng Sinh Hà Nội). Bấm vào bất kỳ mẫu nào hoặc nút Xuất Bản Phòng Thu để trải nghiệm!',
  });

  // Cooldown 5 giây chống bấm lặp (Lớp 4)
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  // Trạng thái đóng/mở 4 Modal
  const [isPhoneticModalOpen, setIsPhoneticModalOpen] = useState(false);
  const [isVoiceDesignModalOpen, setIsVoiceDesignModalOpen] = useState(false);
  const [isVoiceReplicationModalOpen, setIsVoiceReplicationModalOpen] = useState(false);
  const [isApiAdminModalOpen, setIsApiAdminModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Tự động phát hiện ngôn ngữ khi gõ kịch bản
  useEffect(() => {
    const lang = detectScriptLanguage(rawScript);
    setDetectedLang(lang);
  }, [rawScript]);

  useEffect(() => {
    getCachedAudioCount().then((c) => {
      if (c > 0) setCachedCountInDb(c);
    });
  }, []);

  // Tính tổng số từ & thời lượng đọc ước tính theo tốc độ đã chọn
  const wordCount = React.useMemo(() => {
    return rawScript
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [rawScript]);

  const estimatedReadSec = React.useMemo(() => {
    const wordsPerSec = 2.65 * studioParams.speed;
    const shortPauses = (rawScript.match(/<short pause>/gi) || []).length * 0.45;
    const longPauses = (rawScript.match(/<long pause>/gi) || []).length * 1.15;
    return Math.max(1, Math.round(wordCount / wordsPerSec + shortPauses + longPauses));
  }, [wordCount, studioParams.speed, rawScript]);

  // Nạp 1 trong 5 Mẫu dữ liệu thử nghiệm (Phân khu 3.5)
  const handleLoadSamplePreset = (presetId: string) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActiveSampleId(preset.id);
    setRawScript(preset.rawScript);
    setBgmTheme(preset.bgmTheme);
    setStudioParams((prev) => ({
      ...prev,
      ...preset.params,
    }));
    setIssues(
      preset.precomputedIssues.map((item, i) => ({
        ...item,
        id: `sample-issue-${Date.now()}-${i}`,
        accepted: false,
      }))
    );

    let cursor = 0;
    const nextTurns = preset.precomputedTurns.map((t, i) => {
      const start = cursor;
      const end = Number((start + t.estimatedDurationSec).toFixed(2));
      cursor = end;
      return {
        ...t,
        id: `sample-turn-${Date.now()}-${i}`,
        startTimeSec: start,
        endTimeSec: end,
      };
    });
    setTurns(nextTurns);

    const joinedText = nextTurns.map((t) => t.text).join(' ');
    const synth = synthesizeProceduralSpeechWav({
      text: joinedText,
      gender: (preset.params.gender as VoiceGender) || 'male',
      pitch: (preset.params.pitch as VoicePitch) || 'medium',
      speed: preset.params.speed || 1.0,
    });
    setMasterVoiceSamples(synth.samples);
    setMasterDurationSec(synth.durationSec);
    setStatusBanner({
      type: 'success',
      text: `Đã nạp "${preset.title}" — Sẵn sàng rà soát chính tả, phân vai và phát sóng âm 24kHz!`,
    });
  };

  // Kéo thả hoặc tải file kịch bản (.txt, .srt, .md)
  const handleFileUploadScript = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      // Nếu là file .srt, lọc bỏ số thứ tự & timecode để lấy lời thoại sạch
      const cleaned = file.name.endsWith('.srt')
        ? content
            .replace(/^\d+\s*$/gm, '')
            .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g, '')
            .replace(/\n{2,}/g, '\n')
            .trim()
        : content;
      setRawScript(cleaned.slice(0, apiSettings.maxCharsPerTurn));
      setStatusBanner({
        type: 'success',
        text: `Đã nạp tệp kịch bản "${file.name}" thành công.`,
      });
    };
    reader.readAsText(file);
  };

  // Chèn thẻ biểu cảm Gemini 3.8 TTS (<short pause>, <sigh>...) hoặc phản ứng |...| vào vị trí con trỏ
  const handleInsertTagAtCursor = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      setRawScript((prev) => `${prev} ${tag} `);
      return;
    }
    const start = el.selectionStart ?? rawScript.length;
    const end = el.selectionEnd ?? rawScript.length;
    const before = rawScript.slice(0, start);
    const after = rawScript.slice(end);
    const nextText = `${before} ${tag} ${after}`.replace(/\s{2,}/g, ' ');
    setRawScript(nextText);
    setTimeout(() => {
      el.focus();
      const newPos = start + tag.length + 2;
      el.setSelectionRange(newPos, newPos);
    }, 20);
  };

  // Chuyển từ đang bôi đen thành chữ IN HOA để AI nhấn trọng âm (🔠 NHẤN TRỌNG ÂM)
  const handleUppercaseEmphasis = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) {
      setStatusBanner({
        type: 'warning',
        text: 'Hãy bôi đen cụm từ cần NHẤN TRỌNG ÂM trong ô kịch bản trước khi bấm nút!',
      });
      return;
    }
    const selected = rawScript.slice(start, end).toUpperCase();
    const nextText = rawScript.slice(0, start) + selected + rawScript.slice(end);
    setRawScript(nextText);
    setStatusBanner({
      type: 'success',
      text: `Đã chuyển "${selected}" thành chữ IN HOA để Gemini 3.8 TTS nhấn mạnh trọng âm!`,
    });
  };

  // Nút 1: 🔍 Rà soát Chính tả & Bung chữ viết tắt (Lớp 1 Structured Output JSON Schema)
  const handleRunSpellAndAbbrevCheck = async () => {
    if (!rawScript.trim()) return;
    setBusyStep('Đang quét lỗi chính tả, chữ viết tắt báo chí & số liệu bằng gemini-3.5-flash-lite (Structured JSON)...');
    try {
      const res = await analyzeScriptIssues({
        script: rawScript,
        phoneticAliases,
        settings: apiSettings,
      });
      setIssues(res.issues);
      if (res.tokensUsed > 0) {
        setTelemetry((prev) => ({
          ...prev,
          totalTokensUsed: prev.totalTokensUsed + res.tokensUsed,
          estimatedCostUsd: prev.estimatedCostUsd + res.tokensUsed * 0.0000005,
        }));
      }
      setStatusBanner({
        type: 'success',
        text: `Phát hiện ${res.issues.length} điểm cần chuẩn hóa (Chính tả, Chữ viết tắt báo chí, Số liệu). Bấm duyệt từng từ hoặc "Áp dụng tất cả"!`,
      });
    } finally {
      setBusyStep(null);
    }
  };

  // Duyệt 1 từ hoặc Áp dụng tất cả các đề xuất bung chữ
  const handleAcceptSingleIssue = (issueId: string) => {
    const target = issues.find((i) => i.id === issueId);
    if (!target || target.accepted) return;
    setRawScript((prev) => prev.split(target.original).join(target.replacement));
    setTurns((prev) =>
      prev.map((t) => ({
        ...t,
        text: t.text.split(target.original).join(target.replacement),
      }))
    );
    setIssues((prev) =>
      prev.map((item) => (item.id === issueId ? { ...item, accepted: true } : item))
    );
  };

  const handleAcceptAllIssues = () => {
    let updatedScript = rawScript;
    for (const item of issues) {
      if (!item.accepted) {
        updatedScript = updatedScript.split(item.original).join(item.replacement);
      }
    }
    setRawScript(updatedScript);
    setTurns((prev) =>
      prev.map((t) => {
        let updatedTurnText = t.text;
        for (const item of issues) {
          if (!item.accepted) {
            updatedTurnText = updatedTurnText.split(item.original).join(item.replacement);
          }
        }
        return { ...t, text: updatedTurnText };
      })
    );
    setIssues((prev) => prev.map((item) => ({ ...item, accepted: true })));
    setStatusBanner({
      type: 'success',
      text: `Đã bung toàn bộ ${issues.length} từ viết tắt, số liệu và sửa lỗi chính tả sang chữ đọc chuẩn phát thanh!`,
    });
  };

  // Nút 3: 🎭 Chuyển thành Kịch bản 2 người đọc (AI Podcast Splitter)
  const handleConvertPodcast2Speakers = async () => {
    if (!rawScript.trim()) return;
    setBusyStep(`Đang biên tập kịch bản đối đáp 2 vai bằng ${apiSettings.defaultTextProModel}...`);
    try {
      const nextParams: StudioParameters = {
        ...studioParams,
        speakerMode: 'multi',
      };
      setStudioParams(nextParams);

      const res = await convertToDualSpeakerPodcast({
        script: rawScript,
        studioParams: nextParams,
        settings: apiSettings,
      });
      setTurns(res.turns);
      setRawScript(res.formattedScript);
      if (res.tokensUsed > 0) {
        setTelemetry((prev) => ({
          ...prev,
          totalTokensUsed: prev.totalTokensUsed + res.tokensUsed,
          estimatedCostUsd: prev.estimatedCostUsd + res.tokensUsed * 0.0000015,
        }));
      }
      setStatusBanner({
        type: 'success',
        text: `Đã chuyển thành kịch bản Podcast đối đáp 2 vai (${nextParams.speaker1Name} & ${nextParams.speaker2Name}) gồm ${res.turns.length} lượt thoại!`,
      });
    } finally {
      setBusyStep(null);
    }
  };

  // Nút 4: 🌐 Dịch & Lồng tiếng Đa ngôn ngữ 1 chạm
  const handleTranslateAndDubOneClick = async () => {
    if (!rawScript.trim()) return;
    const targetLang =
      studioParams.language === detectedLang
        ? detectedLang === 'vi-VN'
          ? 'en-US'
          : 'vi-VN'
        : studioParams.language;

    setBusyStep(`Đang dịch thoát ý chuẩn văn nói sang ${targetLang} và đồng bộ nhịp thở...`);
    try {
      const res = await translateScriptForDubbing({
        script: rawScript,
        targetLang,
        settings: apiSettings,
      });
      setRawScript(res.translatedScript);
      setStudioParams((prev) => ({ ...prev, language: targetLang }));

      const v1 = allVoices.find((v) => v.id === studioParams.speaker1VoiceId) || SIGNATURE_VOICES[0];
      const newTurn: DialogueTurn = {
        id: `turn-trans-${Date.now()}`,
        speaker: 'Speaker1',
        speakerLabel: `${v1.name} (${targetLang})`,
        voiceId: v1.id,
        text: res.translatedScript,
        styleInstruction: 'natural multilingual broadcast dubbing cadence',
        estimatedDurationSec: Math.max(4, Math.round(res.translatedScript.split(/\s+/).length / 2.7)),
        estimatedTokens: 85,
      };
      setTurns([newTurn]);
      setStatusBanner({
        type: 'success',
        text: `Đã dịch thoát ý & chuẩn hóa lồng tiếng sang ${targetLang} thành công!`,
      });
    } finally {
      setBusyStep(null);
    }
  };

  // Nghe thử nhanh 1 câu bất kỳ ở cột phải bằng gemini-3.8-flash-lite-tts (Smart Preview)
  const handlePreviewSingleTurn = async (turn: DialogueTurn) => {
    setBusyStep(`Đang tổng hợp nghe thử 1 câu bằng ${apiSettings.defaultPreviewTtsModel} (Tiết kiệm 70% Token)...`);
    try {
      const res = await synthesizeStudioAudio({
        turns: [turn],
        studioParams,
        allVoices,
        phoneticAliases,
        settings: apiSettings,
        mode: 'preview-lite',
      });
      setMasterVoiceSamples(res.samples);
      setMasterDurationSec(res.durationSec);
      setUsedFallbackSpeech(res.usedFallback);
      if (res.usedFallback) {
        speakWithWebSpeechFallback({
          turns: [turn],
          lang: studioParams.language,
          speed: studioParams.speed,
          pitch: studioParams.pitch,
        });
      } else {
        const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`);
        audio.play().catch(() => {});
      }
      const dbCount = await getCachedAudioCount();
      if (dbCount > 0) setCachedCountInDb(dbCount);
      setStatusBanner({
        type: 'info',
        text:
          res.fromCacheCount > 0
            ? `⚡ Phát tức thì câu thoại của "${turn.speakerLabel}" từ bộ nhớ đệm IndexedDB (0 Token)!`
            : `🎧 Đang phát thử câu thoại của "${turn.speakerLabel}" bằng mô hình tiết kiệm ${res.modelUsed}.`,
      });
    } finally {
      setBusyStep(null);
    }
  };

  // Tổng hợp Toàn bộ Kịch bản (Chế độ Smart Preview hoặc Studio Master)
  const handleSynthesizeFullMaster = async (mode: 'preview-lite' | 'studio-master') => {
    // Kiểm tra Lớp 4: Fair-Use Rate Limiter
    if (rawScript.length > apiSettings.maxCharsPerTurn) {
      setStatusBanner({
        type: 'warning',
        text: `Văn bản vượt quá giới hạn công bằng ${apiSettings.maxCharsPerTurn.toLocaleString('vi-VN')} ký tự/lượt để bảo vệ Quỹ API Chủ sở hữu.`,
      });
      return;
    }
    if (cooldownSec > 0) {
      setStatusBanner({
        type: 'warning',
        text: `Vui lòng đợi ${cooldownSec} giây (Chống bấm lặp bảo vệ Quỹ API).`,
      });
      return;
    }
    if (telemetry.dailyUsedCount >= apiSettings.dailyLimitPerDevice) {
      setStatusBanner({
        type: 'warning',
        text: `Thiết bị đã dùng hết ${apiSettings.dailyLimitPerDevice} lượt tạo miễn phí hôm nay trên Quỹ chung. Bạn có thể nhập API Key cá nhân ở góc phải!`,
      });
      return;
    }

    setCooldownSec(apiSettings.cooldownSeconds);
    const activeModelName =
      mode === 'studio-master'
        ? apiSettings.defaultMasterTtsModel
        : apiSettings.defaultPreviewTtsModel;

    setBusyStep(
      `Đang tổng hợp âm thanh 24kHz PCM bằng ${activeModelName} (Tách bạch speech_metadata & lời thoại)...`
    );

    try {
      // Đồng bộ danh sách lượt thoại từ kịch bản hiện tại nếu người dùng vừa sửa trực tiếp ô văn bản
      let activeTurns = turns;
      if (studioParams.speakerMode === 'single') {
        const v1 =
          allVoices.find((v) => v.id === studioParams.speaker1VoiceId) || SIGNATURE_VOICES[0];
        const sentences = rawScript
          .split(/(?<=[.!?])\s+|\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
        activeTurns = (sentences.length > 0 ? sentences : [rawScript]).map((s, idx) => {
          const w = s.split(/\s+/).filter(Boolean).length;
          return {
            id: `turn-sync-${idx}`,
            speaker: 'Speaker1',
            speakerLabel: `${v1.name} (${v1.regionLabel.split('•')[1]?.trim() || 'Chuẩn'})`,
            voiceId: v1.id,
            text: s,
            styleInstruction: `${studioParams.mood}, ${studioParams.delivery}`,
            estimatedDurationSec: Math.max(2.2, Number((w / (2.7 * studioParams.speed)).toFixed(1))),
            estimatedTokens: Math.max(15, Math.ceil(w * 1.4)),
          };
        });
      }

      const res = await synthesizeStudioAudio({
        turns: activeTurns,
        studioParams,
        allVoices,
        phoneticAliases,
        settings: apiSettings,
        mode,
      });

      setTurns(res.updatedTurns);
      setMasterVoiceSamples(res.samples);
      setMasterDurationSec(res.durationSec);
      setUsedFallbackSpeech(res.usedFallback);

      const dbCount = await getCachedAudioCount();
      if (dbCount > 0) setCachedCountInDb(dbCount);

      setTelemetry((prev) => ({
        ...prev,
        dailyUsedCount: res.fromCacheCount === activeTurns.length ? prev.dailyUsedCount : prev.dailyUsedCount + 1,
        totalTokensUsed: prev.totalTokensUsed + res.tokensUsed,
        estimatedCostUsd: prev.estimatedCostUsd + res.tokensUsed * 0.000002,
        cacheHitCount: prev.cacheHitCount + res.fromCacheCount,
        totalSynthesizedTurns: prev.totalSynthesizedTurns + activeTurns.length,
      }));

      setStatusBanner({
        type: 'success',
        text:
          res.fromCacheCount > 0
            ? `🎬 Hoàn tất! Tái sử dụng ${res.fromCacheCount}/${activeTurns.length} đoạn âm thanh từ IndexedDB Cache — Tiết kiệm tối đa Quỹ Token!`
            : `🎬 Đã xuất bản Master 24kHz (${res.durationSec}s) với mô hình ${res.modelUsed} kèm trộn nhạc nền Auto-Ducking (-14dB)!`,
      });
    } finally {
      setBusyStep(null);
    }
  };

  // Hiển thị văn bản Cột Trái có tô màu trực quan:
  // - Đỏ: Lỗi chính tả (spelling)
  // - Vàng đồng: Chữ viết tắt / số liệu (abbreviation / number)
  // - Xanh tím: Thẻ biểu cảm góc nhọn <...> và thẻ chêm lời |...|
  const renderHighlightedLeftScript = () => {
    const tokenRegex = /(<[^>]+>|\|[^|]+\|)/g;
    const segments = rawScript.split(tokenRegex);

    return segments.map((seg, idx) => {
      if (/^<[^>]+>$/.test(seg) || /^\|[^|]+\|$/.test(seg)) {
        return (
          <span
            key={idx}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-mono text-xs font-semibold border border-indigo-500/40"
          >
            {seg}
          </span>
        );
      }

      // Tô màu các từ nằm trong danh sách issues
      let parts: React.ReactNode[] = [seg];
      issues.forEach((issue) => {
        const targetStr = issue.accepted ? issue.replacement : issue.original;
        if (!targetStr) return;
        const nextParts: React.ReactNode[] = [];
        parts.forEach((p, pIdx) => {
          if (typeof p !== 'string') {
            nextParts.push(p);
            return;
          }
          const subSplits = p.split(targetStr);
          subSplits.forEach((sub, sIdx) => {
            if (sub) nextParts.push(sub);
            if (sIdx < subSplits.length - 1) {
              const isSpelling = issue.category === 'spelling';
              nextParts.push(
                <span
                  key={`${issue.id}-${pIdx}-${sIdx}`}
                  onClick={() => !issue.accepted && handleAcceptSingleIssue(issue.id)}
                  title={`${issue.explanation} (Đề xuất: "${issue.replacement}")`}
                  className={`inline-block px-1.5 py-0.2 mx-0.5 rounded font-semibold cursor-pointer transition-all ${
                    issue.accepted
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      : isSpelling
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 underline decoration-wavy'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {targetStr}
                </span>
              );
            }
          });
        });
        parts = nextParts;
      });

      return <React.Fragment key={idx}>{parts}</React.Fragment>;
    });
  };

  const detectedLangMeta =
    LANGUAGE_OPTIONS.find((l) => l.code === detectedLang) || LANGUAGE_OPTIONS[0];
  const resolvedIssuesCount = issues.filter((i) => i.accepted).length;
  const remainingDailyQuota = Math.max(
    0,
    apiSettings.dailyLimitPerDevice - telemetry.dailyUsedCount
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] pb-16">
      {/* THANH TIÊU ĐỀ PHÒNG THU (STUDIO HEADER) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0f172a]/85 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Tên ứng dụng chính thức */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1e3a8a] via-[#6366f1] to-[#d97706] flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Mic2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#1e3a8a] via-[#6366f1] to-[#d97706] dark:from-white dark:via-indigo-200 dark:to-amber-400 bg-clip-text text-transparent">
                  S-voice – Phòng thu Giọng đọc AI &amp; Biên tập Kịch bản Đa ngôn ngữ
                </h1>
                <span className="studio-badge bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-mono">
                  Gemini 3.8 TTS Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khởi tạo bởi <strong>Nhà báo Đặng Sinh</strong> • Chuẩn hóa văn bản báo chí, Đạo diễn biểu cảm &amp; Trộn nhạc Auto-Ducking
              </p>
            </div>
          </div>

          {/* Cụm nút điều khiển góc phải: Nạp dữ liệu mẫu, Quản trị Quỹ API & Light/Dark Mode */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const currentIdx = SAMPLE_PRESETS.findIndex((p) => p.id === activeSampleId);
                const nextPreset = SAMPLE_PRESETS[(currentIdx + 1) % SAMPLE_PRESETS.length];
                handleLoadSamplePreset(nextPreset.id);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20 hover:scale-[1.02] transition-all"
            >
              <Zap className="w-4 h-4" /> ⚡ Nạp dữ liệu thử nghiệm
            </button>

            <button
              type="button"
              onClick={() => setIsApiAdminModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300/70 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">🔑 Quản trị Quỹ API &amp; Mô hình</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Chuyển đổi giao diện Sáng / Tối"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300/70 dark:border-slate-700 text-slate-700 dark:text-amber-300 transition-all"
              title="Chuyển đổi chế độ Sáng / Tối (Light / Dark Mode)"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* KHÔNG GIAN CHÍNH (BENTO GRID STUDIO DASHBOARD) */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        {/* 4 THẺ KPI THỐNG KÊ NHẢY SỐ TỰ ĐỘNG (COUNT-UP ANIMATION - YẾU TỐ 2) */}
        <CountUpKpiBar
          wordCount={wordCount}
          estimatedDurationSec={estimatedReadSec}
          resolvedIssuesCount={resolvedIssuesCount}
          totalIssuesCount={issues.length}
          cachedSegmentsCount={cachedCountInDb}
          remainingDailyQuota={remainingDailyQuota}
          maxDailyQuota={apiSettings.dailyLimitPerDevice}
          cooldownRemaining={cooldownSec}
        />

        {/* DẢI 5 MẪU KỊCH BẢN THỬ NGHIỆM 1 CHẠM (PHÂN KHU 3.5) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bento-card p-3.5 mb-6 flex flex-wrap items-center justify-between gap-2 border-amber-500/30"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Zap className="w-4 h-4 shrink-0" />
            <span>PHÂN KHU 3.5 • CHỌN NHANH 5 KỊCH BẢN MẪU THỰC TẾ:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PRESETS.map((sample) => {
              const isSelected = sample.id === activeSampleId;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSamplePreset(sample.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#1e3a8a] to-[#6366f1] text-white shadow-md scale-[1.02]'
                      : 'bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{sample.title.split('(')[0].trim()}</span>
                  <span className="text-[10px] opacity-80 font-mono hidden md:inline">
                    ({sample.badge})
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* THANH TRẠNG THÁI & SKELETON SHIMMER KHI ĐANG XỬ LÝ AI */}
        <AnimatePresence>
          {busyStep && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 rounded-2xl p-4 bg-gradient-to-r from-indigo-900/90 via-blue-900/90 to-slate-900/90 text-white border border-indigo-400/40 shadow-xl"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Live Audio Waveform Equalizer Bars */}
                  <div className="flex items-end gap-1 h-5">
                    <span className="w-1 bg-amber-400 h-full animate-equalizer" />
                    <span
                      className="w-1 bg-indigo-400 h-full animate-equalizer"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <span
                      className="w-1 bg-emerald-400 h-full animate-equalizer"
                      style={{ animationDelay: '0.4s' }}
                    />
                    <span
                      className="w-1 bg-amber-400 h-full animate-equalizer"
                      style={{ animationDelay: '0.1s' }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold">{busyStep}</span>
                </div>
                <span className="text-xs font-mono text-amber-300">Gemini 3.8 Processing...</span>
              </div>
              <div className="mt-2.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-amber-400 to-indigo-500 bg-[length:200%_100%] animate-shimmer" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {statusBanner && !busyStep && (
          <div className="mb-5 px-4 py-2.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* LƯỚI BENTO KHU VỰC ĐẦU VÀO: CỘT TRÁI (3.1 + 3.2) & CỘT PHẢI (3.3 + 3.4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI (7/12): PHÂN KHU 3.1 (NHẬP KỊCH BẢN & TIỀN XỬ LÝ) + PHÂN KHU 3.2 (ĐẠO DIỄN BIỂU CẢM) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* PHÂN KHU 3.1: KHUNG NHẬP KỊCH BẢN & TIỀN XỬ LÝ VĂN BẢN BÁO CHÍ (NHÓM A) */}
            <div className="bento-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Phân khu 3.1 • Nhóm A
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Khung nhập Kịch bản &amp; Tiền xử lý Văn bản Báo chí
                  </h2>
                </div>

                {/* Huy hiệu ngôn ngữ tự động phát hiện & Đồng hồ đo thời lượng đọc (Script Timer) */}
                <div className="flex items-center gap-2">
                  <span className="studio-badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    <span>{detectedLangMeta.flag}</span>
                    <span>Phát hiện: {detectedLangMeta.shortBadge}</span>
                  </span>
                  <span className="studio-badge bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {String(Math.floor(estimatedReadSec / 60)).padStart(2, '0')}:
                    {String(estimatedReadSec % 60).padStart(2, '0')} ({studioParams.speed}x)
                  </span>
                  <label className="studio-badge bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border border-slate-300 dark:border-slate-700">
                    <Upload className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tải .txt/.srt/.md</span>
                    <input
                      type="file"
                      accept=".txt,.srt,.md"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUploadScript(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Ô nhập văn bản thông minh hỗ trợ kéo thả file */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUploadScript(f);
                }}
                className="mt-3 relative"
              >
                <textarea
                  ref={textareaRef}
                  rows={6}
                  value={rawScript}
                  onChange={(e) =>
                    setRawScript(e.target.value.slice(0, apiSettings.maxCharsPerTurn))
                  }
                  placeholder="Nhập trực tiếp kịch bản báo chí, phóng sự, truyện đêm khuya hoặc kéo thả file (.txt, .srt, .md) vào đây..."
                  className="w-full p-3.5 rounded-xl text-sm leading-relaxed bg-slate-50/90 dark:bg-slate-950/70 border border-slate-300/80 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-sans"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    Mẹo: Bôi đen một từ rồi bấm &ldquo;🔠 NHẤN TRỌNG ÂM&rdquo; hoặc đặt con trỏ để chèn thẻ &lt;short pause&gt;
                  </span>
                  <span>
                    {rawScript.length.toLocaleString('vi-VN')} /{' '}
                    {apiSettings.maxCharsPerTurn.toLocaleString('vi-VN')} ký tự
                  </span>
                </div>
              </div>

              {/* 4 Nút công cụ Tiền xử lý Văn bản Báo chí */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleRunSpellAndAbbrevCheck}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <SearchCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  🔍 Rà soát Chính tả &amp; Bung chữ viết tắt ({issues.length})
                </button>

                <button
                  type="button"
                  onClick={() => setIsPhoneticModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  📖 Từ điển Phát âm (Phonetic Alias • {phoneticAliases.length})
                </button>

                <button
                  type="button"
                  onClick={handleConvertPodcast2Speakers}
                  className="px-3.5 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <Users className="w-4 h-4 text-purple-500 shrink-0" />
                  🎭 Chuyển thành Kịch bản 2 người đọc (AI Podcast Splitter)
                </button>

                <button
                  type="button"
                  onClick={handleTranslateAndDubOneClick}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <Languages className="w-4 h-4 text-emerald-500 shrink-0" />
                  🌐 Dịch &amp; Lồng tiếng Đa ngôn ngữ 1 chạm
                </button>
              </div>
            </div>

            {/* PHÂN KHU 3.2: THANH CÔNG CỤ ĐẠO DIỄN BIỂU CẢM & NHỊP ĐIỆU (NHÓM B) */}
            <div className="bento-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Phân khu 3.2 • Nhóm B
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Thanh công cụ Đạo diễn Biểu cảm &amp; Nhịp điệu (Chuẩn Gemini 3.8 TTS)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleUppercaseEmphasis}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  title="Chuyển từ đang bôi đen thành chữ IN HOA để AI nhấn mạnh giọng"
                >
                  <ArrowUpAZ className="w-4 h-4" /> 🔠 NHẤN TRỌNG ÂM
                </button>
              </div>

              {/* Dải 9 thẻ biểu cảm phi ngôn từ góc nhọn */}
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Chèn nhanh Thẻ Biểu cảm Phi ngôn từ (Angle-Bracket Vocal Tags) vào vị trí con trỏ:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXPRESSION_TAGS.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTagAtCursor(item.tag)}
                      title={item.desc}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-transform hover:scale-105 ${item.color}`}
                    >
                      {item.tag}{' '}
                      <span className="font-sans font-normal opacity-85">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dải nút chèn phản ứng chêm lời của người nghe trong hội thoại 2 người */}
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Phản ứng chêm lời Hội thoại 2 người (Backchannel Interjections):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BACKCHANNEL_TAGS.map((bc) => (
                    <button
                      key={bc.tag}
                      type="button"
                      onClick={() => handleInsertTagAtCursor(bc.tag)}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-mono font-semibold transition-transform hover:scale-105"
                    >
                      {bc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* CỘT PHẢI (5/12): PHÂN KHU 3.3 (THÔNG SỐ ĐA CHIỀU) + PHÂN KHU 3.4 (THƯ VIỆN 5 GIỌNG TIÊU BIỂU & XƯỞNG GIỌNG) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* PHÂN KHU 3.3: BẢNG ĐIỀU KHIỂN THÔNG SỐ GIỌNG ĐỌC ĐA CHIỀU */}
            <div className="bento-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Phân khu 3.3 • Bảng Đạo diễn Âm học
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Thông số Giọng đọc Đa chiều (`speech_metadata`)
                  </h2>
                </div>
                <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
              </div>

              {/* Chọn Số lượng người đọc: 1 người vs 2 người */}
              <div className="mt-3 grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90">
                <button
                  type="button"
                  onClick={() => setStudioParams({ ...studioParams, speakerMode: 'single' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    studioParams.speakerMode === 'single'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  👤 1 Người đọc (Single-speaker)
                </button>
                <button
                  type="button"
                  onClick={() => setStudioParams({ ...studioParams, speakerMode: 'multi' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    studioParams.speakerMode === 'multi'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  👥 2 Người đọc (Multi-speaker)
                </button>
              </div>

              {/* Nếu chọn 2 người đọc, hiển thị cấu hình giọng riêng cho Người đọc 1 & Người đọc 2 */}
              {studioParams.speakerMode === 'multi' && (
                <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-300 mb-1">
                      Giọng Người đọc 1 (Host A)
                    </label>
                    <select
                      value={studioParams.speaker1VoiceId}
                      onChange={(e) => {
                        const v = allVoices.find((item) => item.id === e.target.value);
                        setStudioParams({
                          ...studioParams,
                          speaker1VoiceId: e.target.value,
                          speaker1Name: v?.name || 'Host A',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      {allVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.regionLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-300 mb-1">
                      Giọng Người đọc 2 (Host B)
                    </label>
                    <select
                      value={studioParams.speaker2VoiceId}
                      onChange={(e) => {
                        const v = allVoices.find((item) => item.id === e.target.value);
                        setStudioParams({
                          ...studioParams,
                          speaker2VoiceId: e.target.value,
                          speaker2Name: v?.name || 'Host B',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    >
                      {allVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.regionLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Lưới chọn Ngôn ngữ, Thể loại, Vùng miền, Giới tính/Cao độ, Tốc độ, Trục 1 & Trục 2 */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Ngôn ngữ người đọc</label>
                  <select
                    value={studioParams.language}
                    onChange={(e) =>
                      setStudioParams({ ...studioParams, language: e.target.value as LanguageCode })
                    }
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Thể loại kịch bản</label>
                  <select
                    value={studioParams.genre}
                    onChange={(e) =>
                      setStudioParams({ ...studioParams, genre: e.target.value as GenreType })
                    }
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                  >
                    {GENRE_OPTIONS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Vùng miền (5 Phương ngữ)</label>
                  <select
                    value={studioParams.region}
                    onChange={(e) =>
                      setStudioParams({ ...studioParams, region: e.target.value as RegionAccent })
                    }
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                  >
                    {REGION_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} — {r.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Giới tính &amp; Cao độ (Pitch)</label>
                  <div className="flex gap-1.5">
                    <select
                      value={studioParams.gender}
                      onChange={(e) =>
                        setStudioParams({ ...studioParams, gender: e.target.value as VoiceGender })
                      }
                      className="w-1/2 px-2 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="neutral">Trung tính</option>
                    </select>
                    <select
                      value={studioParams.pitch}
                      onChange={(e) =>
                        setStudioParams({ ...studioParams, pitch: e.target.value as VoicePitch })
                      }
                      className="w-1/2 px-2 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="low">Trầm (Low)</option>
                      <option value="medium">Vừa (Med)</option>
                      <option value="high">Cao (High)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Trục 1 - Cảm xúc nội tại (Mood)
                  </label>
                  <select
                    value={studioParams.mood}
                    onChange={(e) =>
                      setStudioParams({ ...studioParams, mood: e.target.value as MoodAxis })
                    }
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                  >
                    {MOOD_AXIS_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Trục 2 - Kỹ thuật phát âm (Delivery)
                  </label>
                  <select
                    value={studioParams.delivery}
                    onChange={(e) =>
                      setStudioParams({
                        ...studioParams,
                        delivery: e.target.value as DeliveryAxis,
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700"
                  >
                    {DELIVERY_AXIS_OPTIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chọn Tốc độ đọc: 0.85x, 1.0x, 1.15x */}
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Tốc độ đọc:</span>
                <div className="flex gap-1.5">
                  {([0.85, 1.0, 1.15] as ReadingSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setStudioParams({ ...studioParams, speed: spd })}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        studioParams.speed === spd
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {spd === 0.85 ? 'Chậm (0.85x)' : spd === 1.0 ? 'Vừa (1.0x)' : 'Nhanh (1.15x)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PHÂN KHU 3.4: THƯ VIỆN 5 GIỌNG ĐỌC TIÊU BIỂU & XƯỞNG GIỌNG NÓI CÁ NHÂN (NHÓM C) */}
            <div className="bento-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Phân khu 3.4 • Nhóm C
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Thư viện Giọng đọc Tiêu biểu &amp; Xưởng Giọng Cá nhân
                  </h2>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsVoiceDesignModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-transform hover:scale-105"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> 🎨 Voice Design
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVoiceReplicationModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-transform hover:scale-105"
                  >
                    <Mic className="w-3.5 h-3.5" /> 🎙️ Nhân bản giọng
                  </button>
                </div>
              </div>

              {/* Danh sách thẻ giọng đọc có hiệu ứng 3D Hover Scale & Subtle Glow */}
              <div className="mt-3 space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {allVoices.map((voice) => {
                  const isPrimary = studioParams.speaker1VoiceId === voice.id;
                  const isSecondary =
                    studioParams.speakerMode === 'multi' &&
                    studioParams.speaker2VoiceId === voice.id;

                  return (
                    <motion.div
                      key={voice.id}
                      whileHover={{ scale: 1.015, y: -2 }}
                      onClick={() =>
                        setStudioParams({
                          ...studioParams,
                          speaker1VoiceId: voice.id,
                          speaker1Name: voice.name,
                          gender: voice.gender,
                          pitch: voice.pitch,
                          region: voice.region,
                        })
                      }
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isPrimary
                          ? 'border-amber-500 bg-gradient-to-r from-indigo-500/10 via-amber-500/10 to-transparent shadow-md shadow-amber-500/10'
                          : isSecondary
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${voice.avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            {voice.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {voice.name}
                              </span>
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                ({voice.regionLabel})
                              </span>
                            </div>
                            <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 mt-0.5">
                              {voice.badgeText}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {isPrimary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                              Vai 1
                            </span>
                          )}
                          {isSecondary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                              Vai 2
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        {voice.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* YẾU TỐ 5: KHUNG ĐỐI CHIẾU KỊCH BẢN SONG SONG 2 CỘT & NÚT XUẤT BẢN PHÒNG THU */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 bento-card p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Yếu tố 4 &amp; 5 • Studio Output Workspace
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Khung Đối chiếu Kịch bản Song song 2 Cột &amp; Phân tầng Tổng hợp Giọng đọc
              </h2>
            </div>

            {/* 2 Nút Tổng hợp Giọng đọc Phân tầng (Flash-Lite Preview vs Flash Studio Master) */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSynthesizeFullMaster('preview-lite')}
                disabled={!!busyStep}
                className="px-4 py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Headphones className="w-4 h-4 text-indigo-500" />
                🎧 Nghe thử Tiết kiệm (`gemini-3.8-flash-lite-tts` • -70% Token)
              </button>

              <button
                type="button"
                onClick={() => handleSynthesizeFullMaster('studio-master')}
                disabled={!!busyStep}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1e3a8a] via-[#6366f1] to-[#d97706] hover:opacity-95 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]"
              >
                <Clapperboard className="w-4 h-4" />
                🎬 Xuất Bản Phòng Thu (`gemini-3.8-flash-tts` Studio Master)
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CỘT TRÁI: TÔ MÀU TRỰC QUAN LỖI CHÍNH TẢ (ĐỎ), VIẾT TẮT/SỐ LIỆU (VÀNG) & THẺ BIỂU CẢM (XANH) */}
            <div className="flex flex-col justify-between rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cột Trái: Rà soát Trực quan &amp; Bung Chữ Báo chí
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 font-semibold">
                      Đỏ: Chính tả
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-semibold">
                      Vàng: Viết tắt / Số
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-semibold">
                      Xanh: Thẻ Biểu cảm
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm leading-7 min-h-[150px]">
                  {renderHighlightedLeftScript()}
                </div>

                {/* Danh sách đề xuất sửa lỗi / bung chữ viết tắt để bấm duyệt từng từ hoặc Áp dụng tất cả */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Đề xuất chuẩn hóa ({issues.filter((i) => !i.accepted).length} mục chờ duyệt):
                    </span>
                    {issues.some((i) => !i.accepted) && (
                      <button
                        type="button"
                        onClick={handleAcceptAllIssues}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Áp dụng tất cả
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {issues.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-2">
                        Văn bản đã sạch lỗi hoặc bấm &ldquo;🔍 Rà soát Chính tả &amp; Bung chữ viết tắt&rdquo; để quét.
                      </div>
                    ) : (
                      issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                issue.category === 'spelling'
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                              }`}
                            >
                              {issue.original}
                            </span>
                            <span>→</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              “{issue.replacement}”
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ({issue.explanation})
                            </span>
                          </div>
                          {issue.accepted ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1 shrink-0">
                              <Check className="w-3.5 h-3.5" /> Đã bung
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAcceptSingleIssue(issue.id)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shrink-0"
                            >
                              Duyệt
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: KỊCH BẢN PHÂN VAI HOÀN CHỈNH (BẤM VÀO TỪNG CÂU ĐỂ NGHE THỬ RIÊNG BẰNG FLASH-LITE) */}
            <div className="rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cột Phải: Kịch bản Phân vai &amp; Nghe thử Từng câu (`Flash-Lite`)
                  </span>
                  <span className="studio-badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-mono">
                    <Database className="w-3 h-3" /> IndexedDB Hash Cache Active
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {turns.map((turn, idx) => (
                    <div
                      key={turn.id}
                      onClick={() => handlePreviewSingleTurn(turn)}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-amber-500 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              turn.speaker === 'Speaker1'
                                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            Lượt {idx + 1} • {turn.speakerLabel}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            ~{turn.estimatedDurationSec}s • {turn.estimatedTokens} tok
                          </span>
                          {turn.fromCache && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500">
                              Cached
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewSingleTurn(turn);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> 🎧 Nghe thử câu này
                        </button>
                      </div>

                      <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                        {turn.text}
                      </p>

                      <div className="mt-1.5 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">
                          annotations.speech_metadata.style = &ldquo;{turn.styleInstruction}&rdquo;
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Quy tắc Gemini 3.8 TTS: Lời chỉ dẫn phong cách được tách riêng vào `speech_metadata`, không bao giờ bị đọc lẫn vào lời thoại.
                </span>
                <span className="font-mono font-semibold text-indigo-500">
                  Batching: {turns.length} turns / 1 call
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* BÀN ĐIỀU KHIỂN ÂM THANH PHÒNG THU (MASTER AUDIO DECK) & 2 BIỂU ĐỒ RECHARTS */}
        <MasterAudioDeck
          voiceSamples={masterVoiceSamples}
          durationSec={masterDurationSec}
          turns={turns}
          studioParams={studioParams}
          rawScript={rawScript}
          bgmTheme={bgmTheme}
          onChangeBgmTheme={setBgmTheme}
          usedFallbackSpeech={usedFallbackSpeech}
          isSynthesizing={!!busyStep}
        />
      </main>

      {/* CÁC MODAL CHỨC NĂNG PHÒNG THU (`<dialog closedby="any">`) */}
      <PhoneticAliasModal
        isOpen={isPhoneticModalOpen}
        onClose={() => setIsPhoneticModalOpen(false)}
        aliases={phoneticAliases}
        onUpdateAliases={handleUpdatePhonetics}
      />

      <VoiceDesignModal
        isOpen={isVoiceDesignModalOpen}
        onClose={() => setIsVoiceDesignModalOpen(false)}
        settings={apiSettings}
        onVoiceCreated={handleAddCustomVoice}
      />

      <VoiceReplicationModal
        isOpen={isVoiceReplicationModalOpen}
        onClose={() => setIsVoiceReplicationModalOpen(false)}
        settings={apiSettings}
        onVoiceReplicated={handleAddCustomVoice}
      />

      <ApiQuotaAdminModal
        isOpen={isApiAdminModalOpen}
        onClose={() => setIsApiAdminModalOpen(false)}
        settings={apiSettings}
        telemetry={telemetry}
        customVoices={customVoices}
        onSaveSettings={(next) => {
          setApiSettings(next);
          saveApiSettings(next);
        }}
        onClearCache={async () => {
          await clearAudioCache();
          setCachedCountInDb(0);
          setStatusBanner({
            type: 'info',
            text: 'Đã làm mới bộ nhớ đệm âm thanh IndexedDB.',
          });
        }}
      />
    </div>
  );
}
export default App;
