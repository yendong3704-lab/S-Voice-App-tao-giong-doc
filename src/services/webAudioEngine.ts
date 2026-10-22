import { BgmThemeId, DialogueTurn, VoiceGender, VoicePitch } from '../types/studio';

const STUDIO_SAMPLE_RATE = 24000; // Chuẩn Gemini 3.8 TTS 24kHz mono PCM

/**
 * Chuyển đổi mảng Float32Array PCM [-1..1] sang định dạng chuẩn RIFF WAVE 24kHz 16-bit PCM
 */
export function encodeWavFromFloat32(samples: Float32Array, sampleRate = STUDIO_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:audio\/\w+;base64,/, '').trim();
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Tạo dữ liệu WAV mô phỏng âm học giọng nói (Syllable Formant Harmonics) 24kHz
 * dùng khi ở chế độ Dự phòng Web Speech API để đảm bảo người dùng luôn có
 * sóng âm thực tế, bộ trộn Auto-Ducking hoạt động chính xác và tải được file .WAV 24kHz.
 */
export function synthesizeProceduralSpeechWav(params: {
  text: string;
  gender: VoiceGender;
  pitch: VoicePitch;
  speed: number;
}): { base64Wav: string; durationSec: number; samples: Float32Array } {
  const cleanWords = params.text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\|[^|]+\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const shortPauses = (params.text.match(/<short pause>/gi) || []).length;
  const longPauses = (params.text.match(/<long pause>/gi) || []).length;
  const breaths = (params.text.match(/<(breath|sigh|laugh|chuckle|gasp|cough|throat-clearing)>/gi) || []).length;

  const wordsPerSec = 2.9 * params.speed;
  const speechSec = Math.max(1.8, cleanWords.length / wordsPerSec);
  const totalDurationSec = Math.min(
    45,
    Number((speechSec + shortPauses * 0.45 + longPauses * 1.1 + breaths * 0.35).toFixed(2))
  );

  const totalSamples = Math.floor(totalDurationSec * STUDIO_SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  // Tần số cơ bản F0 theo giới tính & cao độ
  let f0 = params.gender === 'female' ? 210 : params.gender === 'neutral' ? 165 : 122;
  if (params.pitch === 'low') f0 *= 0.86;
  if (params.pitch === 'high') f0 *= 1.15;

  // Xây dựng chuỗi âm tiết có ngắt nghỉ tự nhiên
  const tokens = params.text.split(/(<[^>]+>|\|[^|]+\||\s+)/).filter((t) => t.trim().length > 0);
  let cursorSample = Math.floor(0.08 * STUDIO_SAMPLE_RATE);

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (tok.toLowerCase() === '<short pause>') {
      cursorSample += Math.floor(0.42 * STUDIO_SAMPLE_RATE);
      continue;
    }
    if (tok.toLowerCase() === '<long pause>') {
      cursorSample += Math.floor(1.05 * STUDIO_SAMPLE_RATE);
      continue;
    }
    if (/^<.+>$/.test(tok)) {
      // Tiếng lấy hơi / thở dài nhẹ
      const breathLen = Math.floor(0.28 * STUDIO_SAMPLE_RATE);
      for (let i = 0; i < breathLen && cursorSample + i < totalSamples; i++) {
        const env = Math.sin((Math.PI * i) / breathLen);
        samples[cursorSample + i] = (Math.random() * 2 - 1) * 0.08 * env;
      }
      cursorSample += breathLen + Math.floor(0.08 * STUDIO_SAMPLE_RATE);
      continue;
    }

    const sylLen = Math.floor((0.19 / params.speed) * STUDIO_SAMPLE_RATE);
    const gapLen = Math.floor((0.045 / params.speed) * STUDIO_SAMPLE_RATE);
    const wordHash = tok.charCodeAt(0) + (tok.charCodeAt(tok.length - 1) || 0);
    const toneMod = 1 + ((wordHash % 7) - 3) * 0.04;
    const isEmphasized = tok === tok.toUpperCase() && tok.length > 1;
    const amp = isEmphasized ? 0.55 : 0.36;

    for (let i = 0; i < sylLen && cursorSample + i < totalSamples; i++) {
      const t = i / STUDIO_SAMPLE_RATE;
      const env = Math.sin((Math.PI * i) / sylLen);
      const pitchGlide = f0 * toneMod * (1 - 0.06 * (i / sylLen));
      // Tổng hợp sóng hài giọng nói (F0 + Formant 1 + Formant 2)
      const sig =
        0.55 * Math.sin(2 * Math.PI * pitchGlide * t) +
        0.28 * Math.sin(2 * Math.PI * pitchGlide * 2 * t + 0.3) +
        0.12 * Math.sin(2 * Math.PI * pitchGlide * 3 * t + 0.7) +
        0.05 * Math.sin(2 * Math.PI * pitchGlide * 4 * t);
      samples[cursorSample + i] = sig * env * amp;
    }

    cursorSample += sylLen + gapLen;
    if (/[.,!?;:]$/.test(tok)) {
      cursorSample += Math.floor(0.25 * STUDIO_SAMPLE_RATE);
    }
  }

  const wavBuffer = encodeWavFromFloat32(samples, STUDIO_SAMPLE_RATE);
  return {
    base64Wav: arrayBufferToBase64(wavBuffer),
    durationSec: totalDurationSec,
    samples,
  };
}

/**
 * Bộ tạo Nhạc nền Tổng hợp Phòng thu (Web Audio Ambient/BGM Synthesizer - 5 chủ đề)
 */
export function synthesizeBgmTrack(theme: BgmThemeId, durationSec: number): Float32Array {
  const numSamples = Math.max(1, Math.floor(durationSec * STUDIO_SAMPLE_RATE));
  const bgm = new Float32Array(numSamples);
  if (theme === 'none') return bgm;

  for (let i = 0; i < numSamples; i++) {
    const t = i / STUDIO_SAMPLE_RATE;
    // Fade in 0.8s và fade out 1.2s
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (durationSec - t) / 1.2);
    const masterEnv = Math.max(0, fadeIn * fadeOut);

    if (theme === 'news-pulse') {
      // Nhịp synth thời sự 118 BPM (1.966 Hz beat)
      const beatPhase = (t * (118 / 60)) % 1;
      const pulseEnv = Math.exp(-beatPhase * 6.5);
      const arpFreq = [220, 277.18, 329.63, 440][Math.floor(t * (118 / 30)) % 4];
      const pad = 0.14 * Math.sin(2 * Math.PI * 110 * t) + 0.08 * Math.sin(2 * Math.PI * 164.81 * t);
      const pulse = 0.22 * pulseEnv * Math.sin(2 * Math.PI * arpFreq * t);
      bgm[i] = (pad + pulse) * masterEnv;
    } else if (theme === 'investigative-tension') {
      // Âm trầm điện ảnh phóng sự điều tra
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
      const subDrone = 0.24 * Math.sin(2 * Math.PI * 55 * t) + 0.15 * Math.sin(2 * Math.PI * 82.41 * t);
      const tensionHeartbeat = Math.exp(-((t * 1.4) % 1) * 9) * 0.2 * Math.sin(2 * Math.PI * 110 * t);
      const shimmer = 0.06 * lfo * Math.sin(2 * Math.PI * 329.63 * t);
      bgm[i] = (subDrone + tensionHeartbeat + shimmer) * masterEnv;
    } else if (theme === 'lofi-story') {
      // Hợp âm Lofi Rhodes ấm áp cho đọc truyện đêm khuya
      const chordIdx = Math.floor(t / 3.2) % 2;
      const freqs = chordIdx === 0 ? [196.0, 246.94, 293.66, 369.99] : [174.61, 220.0, 261.63, 329.63];
      let chordSig = 0;
      for (const f of freqs) {
        chordSig += 0.08 * Math.sin(2 * Math.PI * f * t + Math.sin(2 * Math.PI * 2.5 * t) * 0.15);
      }
      bgm[i] = chordSig * masterEnv;
    } else if (theme === 'poetry-zither') {
      // Âm hưởng ngũ cung Đàn tranh truyền thống (C D E G A)
      const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      const noteStep = Math.floor(t * 1.35);
      const notePhase = (t * 1.35) % 1;
      const freq = pentatonic[noteStep % pentatonic.length];
      const pluckEnv = Math.exp(-notePhase * 4.2);
      const vibrato = Math.sin(2 * Math.PI * 5.2 * t) * 1.8;
      const zither =
        (0.22 * Math.sin(2 * Math.PI * (freq + vibrato) * t) +
          0.11 * Math.sin(2 * Math.PI * (freq * 2 + vibrato) * t)) *
        pluckEnv;
      const warmDrone = 0.08 * Math.sin(2 * Math.PI * 130.81 * t);
      bgm[i] = (zither + warmDrone) * masterEnv;
    } else if (theme === 'podcast-chill') {
      // Podcast trẻ trung groove
      const beat = (t * (102 / 60)) % 1;
      const bassEnv = Math.exp(-beat * 5);
      const bassFreq = [123.47, 146.83, 164.81, 130.81][Math.floor(t / 1.8) % 4];
      const chime = 0.1 * Math.sin(2 * Math.PI * (bassFreq * 2) * t) * Math.exp(-((t * 3.4) % 1) * 7);
      bgm[i] = (0.2 * bassEnv * Math.sin(2 * Math.PI * bassFreq * t) + chime) * masterEnv;
    }
  }

  return bgm;
}

/**
 * Trộn Giọng đọc (Voice) và Nhạc nền (BGM) kèm thuật toán Auto-Ducking (-14dB khi có tiếng đọc)
 */
export function mixVoiceAndBgmWithAutoDucking(params: {
  voiceSamples: Float32Array;
  bgmTheme: BgmThemeId;
  voiceGain: number; // 0..1.5
  bgmGain: number;   // 0..1.0
  autoDucking: boolean;
}): {
  mixedSamples: Float32Array;
  waveformBars: { index: number; timeSec: number; voiceAmp: number; bgmAmp: number }[];
} {
  const { voiceSamples, bgmTheme, voiceGain, bgmGain, autoDucking } = params;
  const totalSamples = voiceSamples.length;
  const durationSec = totalSamples / STUDIO_SAMPLE_RATE;
  const bgmSamples = synthesizeBgmTrack(bgmTheme, durationSec);
  const mixedSamples = new Float32Array(totalSamples);

  // Tính đường bao năng lượng giọng nói (Speech Envelope Follower) theo cửa sổ 40ms
  const windowSize = Math.floor(0.04 * STUDIO_SAMPLE_RATE);
  // -14dB tương đương tỷ lệ biên độ 10^(-14/20) ≈ 0.1995 (~0.20)
  const duckRatio = 0.2;
  let currentDuckGain = 1.0;
  const attackCoeff = 0.0015;  // Hạ nhạc nhanh khi bắt đầu nói
  const releaseCoeff = 0.00018; // Nâng nhạc mượt mà ở khoảng nghỉ <short pause> / <long pause>

  for (let i = 0; i < totalSamples; i++) {
    const v = voiceSamples[i] * voiceGain;
    const absV = Math.abs(v);

    if (autoDucking && bgmTheme !== 'none') {
      const isSpeaking = absV > 0.025;
      const targetDuck = isSpeaking ? duckRatio : 1.0;
      if (targetDuck < currentDuckGain) {
        currentDuckGain += (targetDuck - currentDuckGain) * attackCoeff;
      } else {
        currentDuckGain += (targetDuck - currentDuckGain) * releaseCoeff;
      }
    } else {
      currentDuckGain = 1.0;
    }

    const b = bgmSamples[i] * bgmGain * currentDuckGain;
    // Soft-clipping limiter chống vỡ tiếng (anti-clipping)
    const sum = v + b;
    mixedSamples[i] = Math.tanh(sum);
  }

  // Trích xuất 96 cột sóng âm (Interactive Waveform Visualizer data) cho Recharts & Canvas
  const numBars = 96;
  const samplesPerBar = Math.max(1, Math.floor(totalSamples / numBars));
  const waveformBars: { index: number; timeSec: number; voiceAmp: number; bgmAmp: number }[] = [];

  for (let b = 0; b < numBars; b++) {
    const start = b * samplesPerBar;
    const end = Math.min(totalSamples, start + samplesPerBar);
    let sumV = 0;
    let sumB = 0;
    for (let j = start; j < end; j++) {
      sumV += Math.abs(voiceSamples[j] * voiceGain);
      sumB += Math.abs(mixedSamples[j] - voiceSamples[j] * voiceGain);
    }
    const avgV = sumV / Math.max(1, end - start);
    const avgB = sumB / Math.max(1, end - start);
    waveformBars.push({
      index: b,
      timeSec: Number(((start / STUDIO_SAMPLE_RATE)).toFixed(1)),
      voiceAmp: Math.min(100, Math.round(avgV * 280)),
      bgmAmp: Math.min(100, Math.round(avgB * 320)),
    });
  }

  // Suppress unused variable lint
  void windowSize;

  return { mixedSamples, waveformBars };
}

/**
 * Giải mã base64 WAV sang Float32Array ở tần số 24kHz bằng Web Audio API
 */
export async function decodeBase64WavToFloat32(base64Data: string): Promise<{
  samples: Float32Array;
  durationSec: number;
}> {
  const arrayBuffer = base64ToArrayBuffer(base64Data);
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: STUDIO_SAMPLE_RATE });
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const copy = new Float32Array(channelData.length);
    copy.set(channelData);
    return {
      samples: copy,
      durationSec: Number(audioBuffer.duration.toFixed(2)),
    };
  } catch {
    // Nếu dữ liệu là PCM 16-bit raw (audio/l16) hoặc header đặc biệt, đọc trực tiếp Int16
    const int16 = new Int16Array(arrayBuffer.byteLength >= 44 ? arrayBuffer.slice(44) : arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    return {
      samples: float32,
      durationSec: Number((float32.length / STUDIO_SAMPLE_RATE).toFixed(2)),
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Phát thử giọng đọc qua Web Speech API (window.speechSynthesis) khi ở chế độ dự phòng không cần API Key
 */
export function speakWithWebSpeechFallback(params: {
  turns: DialogueTurn[];
  lang: string;
  speed: number;
  pitch: VoicePitch;
  onTurnStart?: (turnIndex: number) => void;
  onComplete?: () => void;
}): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    params.onComplete?.();
    return () => {};
  }

  window.speechSynthesis.cancel();
  let cancelled = false;

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = params.lang.split('-')[0].toLowerCase();

  const playNext = (idx: number) => {
    if (cancelled || idx >= params.turns.length) {
      if (!cancelled) params.onComplete?.();
      return;
    }
    const turn = params.turns[idx];
    params.onTurnStart?.(idx);

    const cleanSpokenText = turn.text
      .replace(/<short pause>/gi, ', ')
      .replace(/<long pause>/gi, '... ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\|([^|]+)\|/g, ' $1 ')
      .trim();

    const utter = new SpeechSynthesisUtterance(cleanSpokenText);
    utter.lang = params.lang;
    utter.rate = params.speed;
    utter.pitch =
      turn.speaker === 'Speaker2'
        ? 1.15
        : params.pitch === 'low'
        ? 0.85
        : params.pitch === 'high'
        ? 1.15
        : 1.0;

    const matchingVoice =
      voices.find((v) => v.lang.toLowerCase().includes(params.lang.toLowerCase())) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchingVoice) {
      utter.voice = matchingVoice;
    }

    utter.onend = () => playNext(idx + 1);
    utter.onerror = () => playNext(idx + 1);
    window.speechSynthesis.speak(utter);
  };

  playNext(0);

  return () => {
    cancelled = true;
    window.speechSynthesis.cancel();
  };
}
