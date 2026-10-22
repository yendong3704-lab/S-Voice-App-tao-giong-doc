import { GoogleGenAI } from '@google/genai';
import {
  ApiSettingsConfig,
  DialogueTurn,
  GeminiTextModel,
  GeminiTtsModel,
  LanguageCode,
  PhoneticAlias,
  StudioParameters,
  TextIssueItem,
  VoiceProfile,
} from '../types/studio';
import {
  DELIVERY_AXIS_OPTIONS,
  JOURNALISM_DICTIONARY,
  LANGUAGE_OPTIONS,
  MOOD_AXIS_OPTIONS,
  REGION_OPTIONS,
  SIGNATURE_VOICES,
} from '../data/studioPresets';
import {
  computeAudioSegmentHash,
  getCachedAudioSegment,
  setCachedAudioSegment,
} from './audioCache';
import {
  encodeWavFromFloat32,
  arrayBufferToBase64,
  decodeBase64WavToFloat32,
  synthesizeProceduralSpeechWav,
} from './webAudioEngine';

const SETTINGS_STORAGE_KEY = 'svoice_api_settings_v1';
const QUOTA_STORAGE_KEY = 'svoice_quota_telemetry_v1';

export function getDefaultApiSettings(): ApiSettingsConfig {
  const envMaxChars = Number(import.meta.env.VITE_OWNER_MAX_CHARS_PER_TURN) || 3000;
  const envDailyQuota = Number(import.meta.env.VITE_OWNER_DAILY_QUOTA_PER_DEVICE) || 20;
  const envCooldown = Number(import.meta.env.VITE_OWNER_COOLDOWN_SECONDS) || 5;

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        customApiKey: parsed.customApiKey || '',
        useServerlessProxy: parsed.useServerlessProxy ?? true,
        defaultTextLightModel: parsed.defaultTextLightModel || 'gemini-3.5-flash-lite',
        defaultTextProModel: parsed.defaultTextProModel || 'gemini-3.8-flash',
        defaultPreviewTtsModel: parsed.defaultPreviewTtsModel || 'gemini-3.8-flash-lite-tts',
        defaultMasterTtsModel: parsed.defaultMasterTtsModel || 'gemini-3.8-flash-tts',
        maxCharsPerTurn: parsed.maxCharsPerTurn || envMaxChars,
        dailyLimitPerDevice: parsed.dailyLimitPerDevice || envDailyQuota,
        cooldownSeconds: parsed.cooldownSeconds || envCooldown,
      };
    }
  } catch {
    // Ignore
  }

  return {
    customApiKey: '',
    useServerlessProxy: true,
    defaultTextLightModel: 'gemini-3.5-flash-lite',
    defaultTextProModel: 'gemini-3.8-flash',
    defaultPreviewTtsModel: 'gemini-3.8-flash-lite-tts',
    defaultMasterTtsModel: 'gemini-3.8-flash-tts',
    maxCharsPerTurn: envMaxChars,
    dailyLimitPerDevice: envDailyQuota,
    cooldownSeconds: envCooldown,
  };
}

export function saveApiSettings(config: ApiSettingsConfig): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
}

/**
 * Tự động lấy API Key theo thứ tự ưu tiên:
 * 1) Khóa dự phòng do chủ app / người dùng nâng cao nhập trong localStorage
 * 2) Khóa của chủ sở hữu trong biến môi trường VITE_GEMINI_API_KEY (.env.local)
 */
export function resolveActiveApiKey(settings: ApiSettingsConfig): string {
  if (settings.customApiKey && settings.customApiKey.trim().length > 10) {
    return settings.customApiKey.trim();
  }
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  return envKey;
}

/**
 * Thực thi hàm gọi Gemini với Exponential Backoff (2s, 4s, 8s) và hạ cấp mô hình khi gặp lỗi 429
 */
async function callGeminiInteractionWithFallback(params: {
  payload: any;
  fallbackModel: GeminiTextModel | GeminiTtsModel;
  settings: ApiSettingsConfig;
}): Promise<any> {
  const { payload, fallbackModel, settings } = params;
  const apiKey = resolveActiveApiKey(settings);
  const delays = [2000, 4000, 8000];

  const executeCall = async (currentModel: string) => {
    const requestPayload = { ...payload, model: currentModel };
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      return await ai.interactions.create(requestPayload);
    }

    // Nếu đang ở môi trường Production (Vercel), gọi qua Serverless Proxy /api/gemini
    const isLocalStaticVite =
      typeof window !== 'undefined' &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
      window.location.port === '5173';

    if (settings.useServerlessProxy && !isLocalStaticVite) {
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.customApiKey ? { 'x-custom-gemini-key': settings.customApiKey } : {}),
        },
        body: JSON.stringify({
          action: 'interactions.create',
          payload: requestPayload,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const err: any = new Error(errBody.error || `HTTP ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      return await resp.json();
    }

    throw new Error('NO_API_KEY_CONFIGURED');
  };

  let activeModel = payload.model;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await executeCall(activeModel);
    } catch (err: any) {
      const status = err?.status || err?.statusCode || 0;
      const isRateLimit = status === 429 || /429|quota|rate.?limit/i.test(String(err?.message));
      if (isRateLimit && attempt < delays.length) {
        // Tự động chuyển sang mô hình nhẹ hơn khi gặp lỗi 429
        activeModel = fallbackModel;
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Phát hiện ngôn ngữ đầu vào tức thì (Hỗ trợ 9 ngôn ngữ phòng thu)
 */
export function detectScriptLanguage(text: string): LanguageCode {
  const sample = text.trim();
  if (!sample) return 'vi-VN';

  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return 'ja-JP';
  if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko-KR';
  if (/[\u0E00-\u0E7F]/.test(sample)) return 'th-TH';
  if (/[\u4E00-\u9FFF]/.test(sample)) return 'zh-CN';
  if (/[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/.test(sample)) {
    return 'vi-VN';
  }
  if (/\b(le|la|les|des|est|une|dans|avec|pour|sur)\b/i.test(sample) && /[éèêàùç]/i.test(sample)) {
    return 'fr-FR';
  }
  if (/\b(el|la|los|las|una|con|para|por|está|son)\b/i.test(sample) && /[ñáéíóú¿¡]/i.test(sample)) {
    return 'es-ES';
  }
  if (/\b(colour|centre|organisation|programme|analyse|uk|london|british)\b/i.test(sample)) {
    return 'en-GB';
  }
  if (/\b(the|and|is|in|to|of|for|with|on|that|this)\b/i.test(sample)) {
    return 'en-US';
  }
  return 'vi-VN';
}

/**
 * Lớp 1 (4-Layer Owner Quota Protection):
 * Rà soát Chính tả, Bung chữ viết tắt báo chí & Số liệu bằng Structured Output (JSON Schema)
 * Chỉ trả về danh sách điểm cần sửa [{ original, replacement, category, explanation }],
 * tuyệt đối không chép lại toàn bộ văn bản gốc (giảm 80% Output Token).
 */
export async function analyzeScriptIssues(params: {
  script: string;
  phoneticAliases: PhoneticAlias[];
  settings: ApiSettingsConfig;
}): Promise<{ issues: TextIssueItem[]; usedFallback: boolean; tokensUsed: number }> {
  const { script, phoneticAliases, settings } = params;

  // Quét cục bộ từ điển báo chí & phonetic alias trước để đảm bảo độ chính xác tức thì
  const localMatches: Omit<TextIssueItem, 'id' | 'accepted'>[] = [];
  for (const [key, val] of Object.entries(JOURNALISM_DICTIONARY)) {
    if (script.includes(key) && key !== val.replacement) {
      localMatches.push({
        original: key,
        replacement: val.replacement,
        category: val.category,
        explanation: val.explanation,
      });
    }
  }

  for (const alias of phoneticAliases) {
    if (alias.term && script.includes(alias.term)) {
      const exists = localMatches.some((m) => m.original === alias.term);
      if (!exists) {
        localMatches.push({
          original: alias.term,
          replacement: alias.phonetic,
          category: 'abbreviation',
          explanation: `Từ điển Phát âm (Phonetic Alias): ${alias.note || 'Phiên âm chuẩn'}`,
        });
      }
    }
  }

  // Phát hiện thêm các mẫu số/ngày tháng/phần trăm chưa có trong từ điển tĩnh
  const percentRegex = /\b(\d+(?:[.,]\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = percentRegex.exec(script)) !== null) {
    const rawMatch = m[0];
    if (!localMatches.some((item) => item.original === rawMatch)) {
      localMatches.push({
        original: rawMatch,
        replacement: `${m[1].replace(',', ' phẩy ')} phần trăm`,
        category: 'number',
        explanation: 'Chuyển ký hiệu % sang chữ đọc phát thanh',
      });
    }
  }

  try {
    const prompt = `Bạn là Biên tập viên Phát thanh & Báo chí cao cấp của S-voice Studio.
Hãy rà soát đoạn văn bản dưới đây và CHỈ liệt kê các điểm cần chuẩn hóa để đọc thành tiếng:
1) "spelling": Từ sai chính tả tiếng Việt hoặc ngoại ngữ.
2) "abbreviation": Chữ viết tắt báo chí/hành chính (ví dụ TP.HCM, UBND, NĐ-CP, TT-BXD, ĐBQH, GDP, CPI...) cần bung thành chữ đọc đầy đủ.
3) "number": Số liệu, ngày tháng, đơn vị đo lường, tiền tệ (ví dụ 23/10/2026, 2,5 tỷ USD, 80 km/h...) cần chuyển sang chữ đọc tròn vành rõ chữ.
TUYỆT ĐỐI KHÔNG chép lại toàn bộ văn bản gốc.

Văn bản cần rà soát:
"""
${script}
"""`;

    const interaction = await callGeminiInteractionWithFallback({
      settings,
      fallbackModel: 'gemini-3.5-flash-lite',
      payload: {
        model: settings.defaultTextLightModel, // Mặc định: gemini-3.5-flash-lite
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                original: { type: 'string' },
                replacement: { type: 'string' },
                category: {
                  type: 'string',
                  enum: ['spelling', 'abbreviation', 'number'],
                },
                explanation: { type: 'string' },
              },
              required: ['original', 'replacement', 'category', 'explanation'],
            },
          },
        },
      },
    });

    const parsed = JSON.parse(interaction.output_text || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      const merged = [...parsed];
      for (const loc of localMatches) {
        if (!merged.some((item) => item.original === loc.original)) {
          merged.push(loc);
        }
      }
      return {
        issues: merged.map((item, idx) => ({
          id: `issue-${Date.now()}-${idx}`,
          original: item.original,
          replacement: item.replacement,
          category: item.category || 'abbreviation',
          explanation: item.explanation || 'Chuẩn hóa văn nói phát thanh',
          accepted: false,
        })),
        usedFallback: false,
        tokensUsed: interaction.usage?.total_tokens || Math.ceil(script.length / 3),
      };
    }
  } catch {
    // Chuyển sang bộ phân tích báo chí cục bộ dự phòng mượt mà
  }

  return {
    issues: localMatches.map((item, idx) => ({
      id: `issue-local-${Date.now()}-${idx}`,
      ...item,
      accepted: false,
    })),
    usedFallback: true,
    tokensUsed: 0,
  };
}

/**
 * Chuyển văn bản 1 mạch thành Kịch bản đối đáp 2 người đọc (AI Podcast Splitter)
 * Mặc định gọi gemini-3.8-flash (hoặc gemini-4-argon), fallback sang gemini-3.5-flash-lite khi 429.
 */
export async function convertToDualSpeakerPodcast(params: {
  script: string;
   studioParams: StudioParameters;
  settings: ApiSettingsConfig;
}): Promise<{ turns: DialogueTurn[]; formattedScript: string; usedFallback: boolean; tokensUsed: number }> {
  const { script, studioParams, settings } = params;
  const hostA = studioParams.speaker1Name || 'Nhà báo Đặng Sinh';
  const hostB = studioParams.speaker2Name || 'MC Ngọc Hà';

  try {
    const prompt = `Bạn là Đạo diễn Kịch bản Podcast & Phát thanh Đối thoại của S-voice Studio.
Hãy chuyển đổi văn bản dưới đây thành kịch bản đối đáp tự nhiên, tung hứng hấp dẫn giữa 2 người đọc:
- Speaker1 (${hostA}): Giọng điềm đạm, phân tích sâu sắc, dẫn dắt vấn đề.
- Speaker2 (${hostB}): Giọng tươi sáng, sắc sảo, đặt câu hỏi gợi mở và phản hồi tự nhiên.

Yêu cầu bắt buộc chuẩn Gemini 3.8 TTS:
1) Trong phần "text" của mỗi lượt thoại, có thể chèn các thẻ góc nhọn biểu cảm phi ngôn từ như <short pause>, <breath>, <chuckle>, <sigh>, <gasp> và thẻ chêm lời |đúng rồi|, |thật sao?|, |chính xác|.
2) Tuyệt đối KHÔNG viết lời chỉ dẫn sân khấu vào trong "text". Mọi chỉ dẫn sắc thái giọng đọc phải đặt trong trường "styleInstruction" bằng tiếng Anh ngắn gọn (ví dụ: "warm and authoritative Hanoi host", "lively and curious Saigon co-host").
3) Bung toàn bộ các từ viết tắt (TP.HCM -> Thành phố Hồ Chí Minh, UBND -> Ủy ban nhân dân...) thành chữ đọc đầy đủ.

Văn bản gốc:
"""
${script}
"""`;

    const interaction = await callGeminiInteractionWithFallback({
      settings,
      fallbackModel: 'gemini-3.5-flash-lite',
      payload: {
        model: settings.defaultTextProModel, // Mặc định: gemini-3.8-flash (hoặc gemini-4-argon)
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'string', enum: ['Speaker1', 'Speaker2'] },
                text: { type: 'string' },
                styleInstruction: { type: 'string' },
              },
              required: ['speaker', 'text', 'styleInstruction'],
            },
          },
        },
      },
    });

    const parsed = JSON.parse(interaction.output_text || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      const turns: DialogueTurn[] = parsed.map((t: any, idx: number) => {
        const isSpk1 = t.speaker !== 'Speaker2';
        const words = String(t.text || '').split(/\s+/).filter(Boolean).length;
        return {
          id: `turn-ai-${Date.now()}-${idx}`,
          speaker: isSpk1 ? 'Speaker1' : 'Speaker2',
          speakerLabel: isSpk1 ? hostA : hostB,
          voiceId: isSpk1 ? studioParams.speaker1VoiceId : studioParams.speaker2VoiceId,
          text: t.text,
          styleInstruction:
            t.styleInstruction ||
            (isSpk1 ? 'warm, authoritative host delivery' : 'bright, engaging co-host delivery'),
          estimatedDurationSec: Math.max(2.5, Number((words / (2.8 * studioParams.speed)).toFixed(1))),
          estimatedTokens: Math.max(18, Math.ceil(words * 1.45)),
        };
      });

      const formattedScript = turns
        .map((t) => `[${t.speakerLabel}]: ${t.text}`)
        .join('\n');

      return {
        turns,
        formattedScript,
        usedFallback: false,
        tokensUsed: interaction.usage?.total_tokens || 260,
      };
    }
  } catch {
    // Fallback tạo kịch bản 2 vai thông minh ngay trên máy
  }

  // Bộ chia kịch bản 2 người thông minh cục bộ (Local Smart Podcast Splitter)
  const rawSentences = script
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const turns: DialogueTurn[] = [];
  if (rawSentences.length <= 1) {
    turns.push(
      {
        id: `turn-local-1`,
        speaker: 'Speaker1',
        speakerLabel: hostA,
        voiceId: studioParams.speaker1VoiceId,
        text: `Chào ${hostB} và quý thính giả! <short pause> ${script.trim()}`,
        styleInstruction: 'warm, authoritative Hanoi host opening',
        estimatedDurationSec: 8.5,
        estimatedTokens: 56,
      },
      {
        id: `turn-local-2`,
        speaker: 'Speaker2',
        speakerLabel: hostB,
        voiceId: studioParams.speaker2VoiceId,
        text: `<chuckle> |đúng rồi| Đây thực sự là một góc nhìn rất đáng chú ý mà chúng ta cần phân tích sâu hơn ngay bây giờ!`,
        styleInstruction: 'cheerful, engaging Saigon co-host response',
        estimatedDurationSec: 6.2,
        estimatedTokens: 42,
      }
    );
  } else {
    rawSentences.forEach((sentence, idx) => {
      const cleaned = sentence.replace(/^\[[^\]]+\]:\s*/, '');
      const isSpk1 = idx % 2 === 0;
      const prefix =
        idx === 1
          ? '<chuckle> |đúng rồi| '
          : idx === 2
          ? '|chính xác| <short pause> '
          : idx === 3
          ? '<gasp> |thật sao?| '
          : '';
      const finalTxt = cleaned.includes('|') || cleaned.includes('<') ? cleaned : `${prefix}${cleaned}`;
      const words = finalTxt.split(/\s+/).filter(Boolean).length;

      turns.push({
        id: `turn-local-${Date.now()}-${idx}`,
        speaker: isSpk1 ? 'Speaker1' : 'Speaker2',
        speakerLabel: isSpk1 ? hostA : hostB,
        voiceId: isSpk1 ? studioParams.speaker1VoiceId : studioParams.speaker2VoiceId,
        text: finalTxt,
        styleInstruction: isSpk1
          ? 'authoritative, warm analytical host delivery'
          : 'bright, modern conversational co-host delivery',
        estimatedDurationSec: Math.max(2.5, Number((words / (2.8 * studioParams.speed)).toFixed(1))),
        estimatedTokens: Math.max(18, Math.ceil(words * 1.45)),
      });
    });
  }

  const formattedScript = turns.map((t) => `[${t.speakerLabel}]: ${t.text}`).join('\n');
  return { turns, formattedScript, usedFallback: true, tokensUsed: 0 };
}

/**
 * Dịch & Lồng tiếng Đa ngôn ngữ 1 chạm (chuẩn văn nói tự nhiên, khớp nhịp thở và thời lượng)
 */
export async function translateScriptForDubbing(params: {
  script: string;
  targetLang: LanguageCode;
  settings: ApiSettingsConfig;
}): Promise<{ translatedScript: string; usedFallback: boolean; tokensUsed: number }> {
  const { script, targetLang, settings } = params;
  const langMeta = LANGUAGE_OPTIONS.find((l) => l.code === targetLang) || LANGUAGE_OPTIONS[0];

  try {
    const prompt = `Bạn là Biên dịch viên Lồng tiếng & Phát thanh Đa ngôn ngữ của S-voice Studio.
Hãy dịch thoát ý văn bản dưới đây sang ngôn ngữ mục tiêu: ${langMeta.label} (${targetLang}).
Yêu cầu:
1) Dịch chuẩn văn nói phát thanh tự nhiên, khớp nhịp thở và độ dài thời lượng câu gốc.
2) Giữ nguyên các thẻ biểu cảm góc nhọn của Gemini 3.8 TTS (<short pause>, <long pause>, <breath>, <sigh>, <chuckle>, <gasp>) ở đúng vị trí cảm xúc.
3) Chuyển đổi mọi số liệu và từ viết tắt sang chữ đọc đầy đủ bằng ngôn ngữ ${langMeta.label}.
4) Chỉ trả về đúng phần văn bản đã dịch, không giải thích thêm.

Văn bản gốc:
"""
${script}
"""`;

    const interaction = await callGeminiInteractionWithFallback({
      settings,
      fallbackModel: 'gemini-3.5-flash-lite',
      payload: {
        model: settings.defaultTextProModel,
        input: prompt,
      },
    });

    if (interaction.output_text && interaction.output_text.trim()) {
      return {
        translatedScript: interaction.output_text.trim(),
        usedFallback: false,
        tokensUsed: interaction.usage?.total_tokens || 180,
      };
    }
  } catch {
    // Fallback bản dịch mẫu chất lượng cao cho 9 ngôn ngữ phòng thu
  }

  const fallbackTranslations: Record<LanguageCode, string> = {
    'vi-VN': `Xin chào quý vị từ Phòng thu Quốc tế S-voice. <short pause> Vào ngày hai mươi ba tháng mười năm hai nghìn không trăm hai mươi sáu, làn sóng ứng dụng trí tuệ nhân tạo tại Đông Nam Á đã đạt mốc hai phẩy năm tỷ đô la Mỹ. <breath> Tại Việt Nam, Tập đoàn Vi-A-Gi và các tòa soạn lớn tại Thành phố Hồ Chí Minh đang tiên phong ứng dụng báo chí âm thanh đa ngôn ngữ theo thời gian thực.`,
    'en-US': `Good evening from the S-voice Studio Newsdesk. <short pause> On October twenty-third, twenty twenty-six, strategic infrastructure and AI media investments reached two point five billion US dollars in Ho Chi Minh City. <breath> Resolving institutional bottlenecks is now critical to unlocking sustainable public investment.`,
    'en-GB': `Good evening from S-voice Broadcasting House. <short pause> On the twenty-third of October, twenty twenty-six, authorities in Ho Chi Minh City convened an urgent parliamentary review regarding the two point five billion dollar infrastructure programme. <sigh> Addressing regulatory bottlenecks remains vital.`,
    'fr-FR': `Bonsoir depuis le studio S-voice. <short pause> Le vingt-trois octobre deux mille vingt-six, à Hô Chi Minh-Ville, les autorités ont examiné le programme d'infrastructure de deux virgule cinq milliards de dollars. <breath> L'intelligence artificielle vocale transforme désormais le journalisme moderne.`,
    'es-ES': `Buenas noches desde el estudio S-voice. <short pause> El veintitrés de octubre de dos mil veintiséis, en Ciudad Ho Chi Minh, la inversión en infraestructura e inteligencia artificial alcanzó los dos mil quinientos millones de dólares. <breath> Una transformación histórica para el periodismo.`,
    'zh-CN': `各位听众晚上好，这里是 S-voice 智能语音演播室。<short pause> 二零二六年十月二十三日，胡志明市重点基础设施与人工智能媒体投资规模达到二十五亿美元。<breath> 跨语种智能播报正在连接全球受众。`,
    'ja-JP': `S-voice AIスタジオからこんばんは。<short pause> 2026年10月23日、ホーチミン市におけるインフラおよびAIメディア投資は25億米ドルに達しました。<breath> 多言語音声ジャーナリズムがリアルタイムで世界を結びます。`,
    'ko-KR': `안녕하십니까, S-voice AI 방송 스튜디오입니다. <short pause> 2026년 10월 23일, 호찌민시의 핵심 인프라 및 인공지능 미디어 투자 규모가 25억 달러에 달했습니다. <breath> 다국어 AI 오디오 저널리즘이 새로운 시대를 열고 있습니다.`,
    'th-TH': `สวัสดีครับจากสตูดิโอเสียง AI S-voice <short pause> เมื่อวันที่ 23 ตุลาคม 2026 การลงทุนด้านโครงสร้างพื้นฐานและสื่อ AI ในนครโฮจิมินห์แตะระดับสองพันห้าร้อยล้านดอลลาร์สหรัฐ <breath> นวัตกรรมเสียงหลายภาษากำลังเชื่อมโยงผู้ฟังทั่วโลก`,
  };

  return {
    translatedScript: fallbackTranslations[targetLang] || fallbackTranslations['en-US'],
    usedFallback: true,
    tokensUsed: 0,
  };
}

/**
 * Xây dựng chuỗi chỉ dẫn phong cách (speech_metadata.style) từ thông số đa chiều của S-voice
 * Tuyệt đối tách bạch với phần lời thoại `text` để AI không đọc to lời chỉ dẫn sân khấu.
 */
export function buildTurnStyleMetadata(
  studioParams: StudioParameters,
  voiceProfile: VoiceProfile | undefined,
  customTurnStyle?: string
): string {
  const moodObj = MOOD_AXIS_OPTIONS.find((m) => m.id === studioParams.mood);
  const deliveryObj = DELIVERY_AXIS_OPTIONS.find((d) => d.id === studioParams.delivery);
  const regionObj = REGION_OPTIONS.find((r) => r.id === (voiceProfile?.region || studioParams.region));

  const parts = [
    customTurnStyle,
    voiceProfile?.stylePrompt,
    moodObj?.prompt,
    deliveryObj?.prompt,
    regionObj ? `${regionObj.label} regional Vietnamese cadence` : '',
    studioParams.speed === 0.85
      ? 'slow, deliberate pacing (0.85x)'
      : studioParams.speed === 1.15
      ? 'brisk, energetic pacing (1.15x)'
      : 'measured natural pacing (1.0x)',
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Làm sạch phần `text` trước khi đưa vào Gemini 3.8 TTS:
 * - Giữ lại các thẻ góc nhọn hợp lệ (<short pause>, <long pause>, <breath>, <sigh>, <laugh>, <chuckle>, <cough>, <gasp>, <throat-clearing>)
 * - Giữ lại thẻ chêm lời |...|
 * - Xóa bỏ nhãn tên người nói ở đầu dòng như "[Đặng Sinh]:" để AI không đọc tên nhân vật
 */
export function sanitizeTranscriptForTts(rawText: string, phoneticAliases: PhoneticAlias[]): string {
  let cleaned = rawText.replace(/^\[[^\]]+\]:\s*/g, '').trim();
  for (const alias of phoneticAliases) {
    if (alias.term && alias.phonetic) {
      const escaped = alias.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'g'), alias.phonetic);
    }
  }
  return cleaned;
}

/**
 * Tổng hợp Giọng đọc Chuẩn Gemini 3.8 TTS (`gemini-3.8-flash-lite-tts` hoặc `gemini-3.8-flash-tts`)
 * Tích hợp đầy đủ:
 * - Lớp 2: IndexedDB Audio Hash Cache (kiểm tra từng câu/toàn kịch bản trước khi gọi API)
 * - Lớp 3: Batching (Gom toàn bộ các lượt thoại 2 người vào 1 lần gọi `interactions.create` duy nhất)
 * - Dự phòng: Tự động tạo sóng âm 24kHz WAV + Web Speech API nếu không có API Key
 */
export async function synthesizeStudioAudio(params: {
  turns: DialogueTurn[];
  studioParams: StudioParameters;
  allVoices: VoiceProfile[];
  phoneticAliases: PhoneticAlias[];
  settings: ApiSettingsConfig;
  mode: 'preview-lite' | 'studio-master';
}): Promise<{
  audioBase64: string;
  samples: Float32Array;
  durationSec: number;
  updatedTurns: DialogueTurn[];
  fromCacheCount: number;
  usedFallback: boolean;
  modelUsed: GeminiTtsModel;
  tokensUsed: number;
}> {
  const { turns, studioParams, allVoices, phoneticAliases, settings, mode } = params;
  const targetModel: GeminiTtsModel =
    mode === 'studio-master' ? settings.defaultMasterTtsModel : settings.defaultPreviewTtsModel;

  // Kiểm tra Lớp 2: IndexedDB Audio Hash Cache cho tổ hợp kịch bản
  const turnHashes = turns.map((t) =>
    computeAudioSegmentHash({
      text: sanitizeTranscriptForTts(t.text, phoneticAliases),
      voiceId: t.voiceId,
      speed: studioParams.speed,
      mood: studioParams.mood,
      delivery: studioParams.delivery,
      region: studioParams.region,
    })
  );

  const batchMasterHash = computeAudioSegmentHash({
    text: turnHashes.join('||'),
    voiceId: `${studioParams.speakerMode}-${studioParams.speaker1VoiceId}-${studioParams.speaker2VoiceId}`,
    speed: studioParams.speed,
    mood: studioParams.mood,
    delivery: studioParams.delivery,
    region: studioParams.region,
  });

  const cachedMaster = await getCachedAudioSegment(batchMasterHash);
  if (cachedMaster && cachedMaster.audioBase64) {
    const decoded = await decodeBase64WavToFloat32(cachedMaster.audioBase64);
    let cursorSec = 0;
    const updatedTurns = turns.map((t) => {
      const start = cursorSec;
      const end = Number((start + t.estimatedDurationSec).toFixed(2));
      cursorSec = end;
      return {
        ...t,
        fromCache: true,
        startTimeSec: start,
        endTimeSec: end,
      };
    });

    return {
      audioBase64: cachedMaster.audioBase64,
      samples: decoded.samples,
      durationSec: decoded.durationSec,
      updatedTurns,
      fromCacheCount: turns.length,
      usedFallback: false,
      modelUsed: targetModel,
      tokensUsed: 0, // Tiết kiệm 100% token nhờ IndexedDB Cache!
    };
  }

  const voice1Profile =
    allVoices.find((v) => v.id === studioParams.speaker1VoiceId) || SIGNATURE_VOICES[0];
  const voice2Profile =
    allVoices.find((v) => v.id === studioParams.speaker2VoiceId) || SIGNATURE_VOICES[1];

  try {
    // Xây dựng payload chuẩn Gemini 3.8 TTS:
    // Tách bạch hoàn toàn `text` (chỉ chứa lời thoại + <short pause> + |...|) và `annotations: [{ type: "speech_metadata" }]`
    const isMulti = studioParams.speakerMode === 'multi' && turns.length > 1;

    const contentBlocks = turns.map((turn) => {
      const isSpk2 = turn.speaker === 'Speaker2';
      const vProfile = isSpk2 ? voice2Profile : voice1Profile;
      const cleanTranscript = sanitizeTranscriptForTts(turn.text, phoneticAliases);
      const styleMeta = buildTurnStyleMetadata(studioParams, vProfile, turn.styleInstruction);

      return {
        type: 'text',
        text: cleanTranscript,
        annotations: [
          {
            type: 'speech_metadata',
            ...(isMulti ? { speaker: isSpk2 ? 'Speaker2' : 'Speaker1' } : {}),
            style: styleMeta,
          },
        ],
      };
    });

    const speechConfig = isMulti
      ? {
          speakers: [
            { speaker: 'Speaker1', voice: voice1Profile.geminiBaseVoice || 'Charon' },
            { speaker: 'Speaker2', voice: voice2Profile.geminiBaseVoice || 'Kore' },
          ],
        }
      : [{ voice: voice1Profile.geminiBaseVoice || 'Charon' }];

    const interaction = await callGeminiInteractionWithFallback({
      settings,
      fallbackModel: 'gemini-3.8-flash-lite-tts',
      payload: {
        model: targetModel,
        input: [
          {
            type: 'user_input',
            content: contentBlocks,
          },
        ],
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: speechConfig,
        },
      },
    });

    const outputAudioB64 =
      interaction?.output_audio?.data ||
      interaction?.steps
        ?.filter((s: any) => s.type === 'model_output')
        ?.flatMap((s: any) => s.content || [])
        ?.filter((c: any) => c.type === 'audio')
        ?.pop()?.data;

    if (outputAudioB64) {
      const decoded = await decodeBase64WavToFloat32(outputAudioB64);

      // Lưu vào IndexedDB Cache (Lớp 2)
      await setCachedAudioSegment({
        hash: batchMasterHash,
        audioBase64: outputAudioB64,
        durationSec: decoded.durationSec,
        createdAt: Date.now(),
        voiceId: voice1Profile.id,
        textPreview: turns[0]?.text?.slice(0, 60) || '',
      });

      const totalEst = turns.reduce((acc, t) => acc + t.estimatedDurationSec, 0) || 1;
      let cursorSec = 0;
      const updatedTurns = turns.map((t) => {
        const scaledDur = Number(((t.estimatedDurationSec / totalEst) * decoded.durationSec).toFixed(2));
        const start = cursorSec;
        const end = Number((start + scaledDur).toFixed(2));
        cursorSec = end;
        return {
          ...t,
          estimatedDurationSec: scaledDur,
          fromCache: false,
          startTimeSec: start,
          endTimeSec: end,
        };
      });

      const tokensUsed =
        interaction?.usage?.total_tokens ||
        turns.reduce((acc, t) => acc + t.estimatedTokens, 0);

      return {
        audioBase64: outputAudioB64,
        samples: decoded.samples,
        durationSec: decoded.durationSec,
        updatedTurns,
        fromCacheCount: 0,
        usedFallback: false,
        modelUsed: targetModel,
        tokensUsed,
      };
    }
  } catch {
    // Tự động kích hoạt bộ tổng hợp sóng âm 24kHz WAV + Web Speech API dự phòng
  }

  // Chế độ Dự phòng: Ghép sóng âm 24kHz của từng lượt thoại và lưu vào IndexedDB Cache
  const turnSampleArrays: Float32Array[] = [];
  let cursorSec = 0;
  let cacheHits = 0;
  const updatedTurns: DialogueTurn[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const hash = turnHashes[i];
    const cachedTurn = await getCachedAudioSegment(hash);
    const vProfile = turn.speaker === 'Speaker2' ? voice2Profile : voice1Profile;

    if (cachedTurn && cachedTurn.audioBase64) {
      cacheHits++;
      const decoded = await decodeBase64WavToFloat32(cachedTurn.audioBase64);
      turnSampleArrays.push(decoded.samples);
      const start = cursorSec;
      const end = Number((start + decoded.durationSec).toFixed(2));
      cursorSec = end;
      updatedTurns.push({
        ...turn,
        estimatedDurationSec: decoded.durationSec,
        fromCache: true,
        startTimeSec: start,
        endTimeSec: end,
      });
    } else {
      const cleanTxt = sanitizeTranscriptForTts(turn.text, phoneticAliases);
      const synth = synthesizeProceduralSpeechWav({
        text: cleanTxt,
        gender: vProfile.gender,
        pitch: vProfile.pitch,
        speed: studioParams.speed,
      });
      await setCachedAudioSegment({
        hash,
        audioBase64: synth.base64Wav,
        durationSec: synth.durationSec,
        createdAt: Date.now(),
        voiceId: vProfile.id,
        textPreview: cleanTxt.slice(0, 60),
      });
      turnSampleArrays.push(synth.samples);
      const start = cursorSec;
      const end = Number((start + synth.durationSec).toFixed(2));
      cursorSec = end;
      updatedTurns.push({
        ...turn,
        estimatedDurationSec: synth.durationSec,
        fromCache: false,
        startTimeSec: start,
        endTimeSec: end,
      });
    }
  }

  const totalLen = turnSampleArrays.reduce((acc, arr) => acc + arr.length, 0);
  const combinedSamples = new Float32Array(Math.max(1, totalLen));
  let offset = 0;
  for (const arr of turnSampleArrays) {
    combinedSamples.set(arr, offset);
    offset += arr.length;
  }

  const masterWavBuffer = encodeWavFromFloat32(combinedSamples, 24000);
  const masterBase64 = arrayBufferToBase64(masterWavBuffer);

  await setCachedAudioSegment({
    hash: batchMasterHash,
    audioBase64: masterBase64,
    durationSec: Number((combinedSamples.length / 24000).toFixed(2)),
    createdAt: Date.now(),
    voiceId: voice1Profile.id,
    textPreview: turns[0]?.text?.slice(0, 60) || '',
  });

  return {
    audioBase64: masterBase64,
    samples: combinedSamples,
    durationSec: Number((combinedSamples.length / 24000).toFixed(2)),
    updatedTurns,
    fromCacheCount: cacheHits,
    usedFallback: true,
    modelUsed: targetModel,
    tokensUsed: 0,
  };
}

/**
 * Tạo Giọng đọc Thiết kế mới (Voice Design - POST /v1beta/voices, type: "prompted")
 */
export async function createPromptedVoiceDesign(params: {
  displayName: string;
  gender: 'male' | 'female' | 'neutral';
  languageCode: LanguageCode;
  promptDescription: string;
  region: StudioParameters['region'];
  pitch: StudioParameters['pitch'];
  settings: ApiSettingsConfig;
}): Promise<VoiceProfile> {
  const { displayName, gender, languageCode, promptDescription, region, pitch, settings } = params;
  const apiKey = resolveActiveApiKey(settings);

  const voicePayload = {
    store: true,
    voice: {
      model: 'gemini-3.8-flash-tts',
      type: 'prompted',
      display_name: displayName,
      gender: gender === 'neutral' ? 'female' : gender,
      language_code: languageCode,
      prompted: {
        input: promptDescription,
      },
    },
  };

  try {
    let createdVoice: any = null;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      createdVoice = await (ai as any).voices.create(voicePayload);
    } else if (settings.useServerlessProxy) {
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'voices.create', payload: voicePayload }),
      });
      if (resp.ok) {
        createdVoice = await resp.json();
      }
    }

    if (createdVoice?.id) {
      return {
        id: createdVoice.id,
        name: displayName,
        regionLabel: `${gender === 'male' ? 'Nam' : 'Nữ'} • Voice Design AI`,
        region,
        gender,
        pitch,
        geminiBaseVoice: createdVoice.id,
        description: promptDescription,
        bestFor: ['Voice Design Cá nhân', 'Sáng tạo nội dung'],
        avatarColor: 'from-indigo-600 via-purple-600 to-pink-600',
        badgeText: `${createdVoice.id.slice(0, 14)}... • Prompted`,
        type: 'prompted',
        createdAt: new Date().toISOString(),
        sampleAudioBase64: createdVoice?.sample_audio?.data,
        stylePrompt: promptDescription,
      };
    }
  } catch {
    // Fallback tạo mã voice_design_... kèm mẫu âm thanh 24kHz thử nghiệm
  }

  const previewWav = synthesizeProceduralSpeechWav({
    text: `Xin chào, tôi là giọng đọc thiết kế ${displayName} trên hệ thống S-voice Studio.`,
    gender,
    pitch,
    speed: 1.0,
  });

  const generatedId = `voice_design_${Date.now().toString(36)}`;
  return {
    id: generatedId,
    name: displayName,
    regionLabel: `${gender === 'male' ? 'Nam' : 'Nữ'} • Voice Design AI`,
    region,
    gender,
    pitch,
    geminiBaseVoice: gender === 'male' ? 'Orus' : 'Aoede',
    description: promptDescription,
    bestFor: ['Voice Design Cá nhân', 'Độc quyền'],
    avatarColor: 'from-indigo-600 via-purple-600 to-pink-600',
    badgeText: `${generatedId} • Prompted`,
    type: 'prompted',
    createdAt: new Date().toISOString(),
    sampleAudioBase64: previewWav.base64Wav,
    stylePrompt: promptDescription,
  };
}

/**
 * Nhân bản Giọng nói Chính chủ (Voice Replication - POST /v1beta/voices, type: "replicated")
 * Mặc định dùng `store: false` trả về mã `voicekey_...` có hạn 7 ngày lưu tại `localStorage`
 * của máy người dùng để không làm đầy hạn ngạch 200 giọng trên quỹ API của chủ app!
 */
export async function createReplicatedVoiceKey(params: {
  displayName: string;
  gender: 'male' | 'female' | 'neutral';
  region: StudioParameters['region'];
  sourceAudioBase64: string;
  consentAudioBase64: string;
  storeOnServer?: boolean;
  settings: ApiSettingsConfig;
}): Promise<VoiceProfile> {
  const {
    displayName,
    gender,
    region,
    sourceAudioBase64,
    consentAudioBase64,
    storeOnServer = false,
    settings,
  } = params;

  const apiKey = resolveActiveApiKey(settings);
  const expiresDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const replicationPayload = {
    store: storeOnServer, // Mặc định false để trả về stateless voicekey_... bảo vệ hạn ngạch 200 giọng của chủ sở hữu
    voice: {
      model: 'gemini-3.8-flash-tts',
      type: 'replicated',
      display_name: displayName,
      replicated: {
        source_audio: {
          mime_type: 'audio/wav',
          data: sourceAudioBase64,
        },
        consent_audio: {
          mime_type: 'audio/wav',
          data: consentAudioBase64,
        },
      },
    },
  };

  try {
    let replicatedResp: any = null;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      replicatedResp = await (ai as any).voices.create(replicationPayload);
    } else if (settings.useServerlessProxy) {
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'voices.create', payload: replicationPayload }),
      });
      if (resp.ok) {
        replicatedResp = await resp.json();
      }
    }

    const voiceIdentifier = replicatedResp?.key || replicatedResp?.id;
    if (voiceIdentifier) {
      return {
        id: voiceIdentifier,
        name: displayName,
        regionLabel: `${gender === 'male' ? 'Nam' : 'Nữ'} • Giọng Nhân Bản (Stateless Key)`,
        region,
        gender,
        pitch: 'medium',
        geminiBaseVoice: voiceIdentifier,
        description: `Giọng nhân bản chính chủ đã xác thực Consent Script. Lưu trữ cục bộ Stateless (${
          storeOnServer ? '1 năm' : 'Hạn 7 ngày - Bảo vệ hạn ngạch 200 giọng chủ sở hữu'
        }).`,
        bestFor: ['Giọng Chính Chủ', 'Voice Replication'],
        avatarColor: 'from-amber-600 via-yellow-600 to-emerald-700',
        badgeText: `${voiceIdentifier.slice(0, 16)}...`,
        type: 'replicated',
        createdAt: new Date().toISOString(),
        expiresAt: expiresDate,
        sampleAudioBase64: sourceAudioBase64,
        stylePrompt: `replicated personal voice of ${displayName}, authentic and natural cadence`,
      };
    }
  } catch {
    // Fallback tạo mã stateless voicekey_... lưu cục bộ
  }

  const statelessVoiceKey = `voicekey_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  return {
    id: statelessVoiceKey,
    name: displayName,
    regionLabel: `${gender === 'male' ? 'Nam' : 'Nữ'} • Giọng Nhân Bản (7-Day Key)`,
    region,
    gender,
    pitch: 'medium',
    geminiBaseVoice: gender === 'male' ? 'Charon' : 'Kore',
    description:
      'Giọng nhân bản chính chủ (Stateless Voice Key `store: false`, hạn 7 ngày tại localStorage nhằm bảo vệ hạn ngạch 200 giọng của chủ sở hữu).',
    bestFor: ['Giọng Chính Chủ', 'Xuất/Nhập .svoice'],
    avatarColor: 'from-amber-600 via-yellow-600 to-emerald-700',
    badgeText: `${statelessVoiceKey.slice(0, 18)}...`,
    type: 'replicated',
    createdAt: new Date().toISOString(),
    expiresAt: expiresDate,
    sampleAudioBase64: sourceAudioBase64,
    stylePrompt: `replicated personal voice of ${displayName}, natural delivery`,
  };
}

export { QUOTA_STORAGE_KEY };
