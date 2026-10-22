import { GoogleGenAI } from '@google/genai';

/**
 * Vercel Serverless Proxy (/api/gemini)
 * Bảo vệ Quỹ API Chủ sở hữu (Nhà báo Đặng Sinh):
 * - Ẩn hoàn toàn khóa GEMINI_API_KEY trên máy chủ Vercel khỏi trình duyệt của khách.
 * - Hỗ trợ cả 2 endpoint chuẩn của Gemini 3.8:
 *   1) interactions.create (Text, Structured JSON, Single/Multi-speaker TTS)
 *   2) voices.create (Voice Design "prompted" & Voice Replication "replicated")
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const ownerApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const clientHeaderKey = req.headers['x-custom-gemini-key'];
  const activeApiKey = (typeof clientHeaderKey === 'string' && clientHeaderKey.trim()) ? clientHeaderKey.trim() : ownerApiKey;

  if (!activeApiKey) {
    return res.status(503).json({
      error: 'OWNER_API_KEY_NOT_CONFIGURED',
      message: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Hệ thống sẽ tự động kích hoạt chế độ Phòng thu Web Audio / Web Speech dự phòng.',
    });
  }

  try {
    const { action, payload } = req.body || {};
    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    if (action === 'voices.create') {
      const createdVoice = await ai.voices.create(payload);
      return res.status(200).json(createdVoice);
    }

    if (action === 'voices.list') {
      const voicesList = await ai.voices.list(payload || {});
      return res.status(200).json(voicesList);
    }

    // Mặc định: gọi client.interactions.create chuẩn SDK @google/genai >= 2.29.1
    const interaction = await ai.interactions.create(payload);
    return res.status(200).json({
      id: interaction.id,
      status: interaction.status,
      output_text: interaction.output_text ?? null,
      output_audio: interaction.output_audio ?? null,
      steps: interaction.steps ?? [],
      usage: (interaction as any).usage ?? null,
    });
  } catch (err: any) {
    const status = err?.status || err?.statusCode || 500;
    return res.status(status).json({
      error: err?.message || 'Gemini API Proxy Error',
      status,
    });
  }
}
