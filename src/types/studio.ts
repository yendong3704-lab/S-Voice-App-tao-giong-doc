export type LanguageCode =
  | 'vi-VN'
  | 'en-US'
  | 'en-GB'
  | 'fr-FR'
  | 'es-ES'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR'
  | 'th-TH';

export type GenreType =
  | 'late-night-story'
  | 'poetry-recitation'
  | 'investigative-report'
  | 'news-broadcast'
  | 'natural-dialogue'
  | 'thematic-podcast'
  | 'corporate-narration';

export type SpeakerCountMode = 'single' | 'multi';

export type VoiceGender = 'male' | 'female' | 'neutral';
export type VoicePitch = 'low' | 'medium' | 'high';

export type RegionAccent =
  | 'ha-noi'
  | 'sai-gon'
  | 'can-tho'
  | 'da-nang'
  | 'nghe-an';

export type ReadingSpeed = 0.85 | 1.0 | 1.15;

export type MoodAxis =
  | 'calm-serious'
  | 'cheerful-excited'
  | 'melancholic-deep'
  | 'fierce-determined'
  | 'sarcastic-satirical'
  | 'suspenseful-dramatic'
  | 'witty-playful';

export type DeliveryAxis =
  | 'natural'
  | 'news-anchor'
  | 'whispering'
  | 'out-of-breath'
  | 'warm-storytelling'
  | 'dramatic-climax';

export type BgmThemeId =
  | 'none'
  | 'news-pulse'
  | 'investigative-tension'
  | 'lofi-story'
  | 'poetry-zither'
  | 'podcast-chill';

export type GeminiTextModel =
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.8-flash'
  | 'gemini-4-argon';

export type GeminiTtsModel =
  | 'gemini-3.8-flash-lite-tts'
  | 'gemini-3.8-flash-tts';

export interface VoiceProfile {
  id: string;
  name: string;
  regionLabel: string;
  region: RegionAccent;
  gender: VoiceGender;
  pitch: VoicePitch;
  geminiBaseVoice: string; // e.g., Charon, Kore, Leda, Puck, Gacrux, or voice_... / voicekey_...
  description: string;
  bestFor: string[];
  avatarColor: string;
  badgeText: string;
  type: 'prebuilt' | 'prompted' | 'replicated';
  createdAt?: string;
  expiresAt?: string;
  sampleAudioBase64?: string;
  stylePrompt?: string;
}

export interface TextIssueItem {
  id: string;
  original: string;
  replacement: string;
  category: 'spelling' | 'abbreviation' | 'number';
  explanation: string;
  accepted: boolean;
}

export interface PhoneticAlias {
  id: string;
  term: string;
  phonetic: string;
  note?: string;
}

export interface DialogueTurn {
  id: string;
  speaker: 'Speaker1' | 'Speaker2';
  speakerLabel: string;
  voiceId: string;
  text: string;
  styleInstruction: string;
  estimatedDurationSec: number;
  estimatedTokens: number;
  cachedAudioBase64?: string;
  fromCache?: boolean;
  startTimeSec?: number;
  endTimeSec?: number;
}

export interface StudioParameters {
  language: LanguageCode;
  genre: GenreType;
  speakerMode: SpeakerCountMode;
  gender: VoiceGender;
  pitch: VoicePitch;
  region: RegionAccent;
  speed: ReadingSpeed;
  mood: MoodAxis;
  delivery: DeliveryAxis;
  speaker1VoiceId: string;
  speaker2VoiceId: string;
  speaker1Name: string;
  speaker2Name: string;
}

export interface SamplePreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  rawScript: string;
  params: Partial<StudioParameters>;
  bgmTheme: BgmThemeId;
  precomputedIssues: Omit<TextIssueItem, 'id' | 'accepted'>[];
  precomputedTurns: Omit<DialogueTurn, 'id'>[];
}

export interface QuotaTelemetry {
  dailyUsedCount: number;
  dailyMaxLimit: number;
  maxCharsPerTurn: number;
  cooldownSeconds: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  cacheHitCount: number;
  totalSynthesizedTurns: number;
  lastResetDate: string;
}

export interface ApiSettingsConfig {
  customApiKey: string;
  useServerlessProxy: boolean;
  defaultTextLightModel: GeminiTextModel;
  defaultTextProModel: GeminiTextModel;
  defaultPreviewTtsModel: GeminiTtsModel;
  defaultMasterTtsModel: GeminiTtsModel;
  maxCharsPerTurn: number;
  dailyLimitPerDevice: number;
  cooldownSeconds: number;
}
