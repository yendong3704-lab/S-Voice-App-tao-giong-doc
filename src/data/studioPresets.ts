import {
  VoiceProfile,
  SamplePreset,
  PhoneticAlias,
  LanguageCode,
  GenreType,
  RegionAccent,
  MoodAxis,
  DeliveryAxis,
  BgmThemeId,
} from '../types/studio';

export const SIGNATURE_VOICES: VoiceProfile[] = [
  {
    id: 'voice-dang-sinh-hn',
    name: 'Đặng Sinh',
    regionLabel: 'Nam • Giọng Hà Nội',
    region: 'ha-noi',
    gender: 'male',
    pitch: 'low',
    geminiBaseVoice: 'Charon',
    description:
      'Giọng nhà báo kỳ cựu, trầm ấm, đĩnh đạc, sắc sảo. Tối ưu cho phóng sự điều tra, bình luận thời sự và bài giảng chuyên sâu.',
    bestFor: ['Phóng sự điều tra', 'Bình luận thời sự', 'Bài giảng'],
    avatarColor: 'from-blue-900 via-indigo-800 to-slate-900',
    badgeText: 'Charon / Orus • Hà Nội',
    type: 'prebuilt',
    stylePrompt:
      'authoritative, warm resonant Hanoi northern Vietnamese male journalist voice, measured cadence, gravitas and clarity',
  },
  {
    id: 'voice-ngoc-ha-sg',
    name: 'Ngọc Hà',
    regionLabel: 'Nữ • Giọng Sài Gòn',
    region: 'sai-gon',
    gender: 'female',
    pitch: 'medium',
    geminiBaseVoice: 'Kore',
    description:
      'Giọng nữ TP.HCM thanh lịch, sáng rõ, hiện đại, nhịp điệu tươi tắn. Tối ưu cho podcast, tin tức tổng hợp và dẫn chương trình.',
    bestFor: ['Podcast đối thoại', 'Bản tin hiện đại', 'MC Sự kiện'],
    avatarColor: 'from-amber-600 via-orange-500 to-rose-600',
    badgeText: 'Kore / Aoede • Sài Gòn',
    type: 'prebuilt',
    stylePrompt:
      'bright, articulate, modern Ho Chi Minh City southern Vietnamese female host voice, engaging and clear',
  },
  {
    id: 'voice-be-tu-can-tho',
    name: 'Bé Tư Cầm Thi',
    regionLabel: 'Nữ • Giọng Cần Thơ',
    region: 'can-tho',
    gender: 'female',
    pitch: 'medium',
    geminiBaseVoice: 'Leda',
    description:
      'Giọng nữ miền Tây ngọt ngào, truyền cảm, giàu chất tự sự. Tối ưu cho đọc truyện đêm khuya, tản văn và ký sự miền sông nước.',
    bestFor: ['Truyện đêm khuya', 'Tản văn miền Tây', 'Ký sự văn hóa'],
    avatarColor: 'from-emerald-600 via-teal-600 to-cyan-700',
    badgeText: 'Leda / Sulafat • Cần Thơ',
    type: 'prebuilt',
    stylePrompt:
      'sweet, gentle, soulful Mekong Delta Can Tho female voice, warm storytelling tone, soft and melodic',
  },
  {
    id: 'voice-minh-nhat-dn',
    name: 'Minh Nhật',
    regionLabel: 'Nam • Giọng Đà Nẵng',
    region: 'da-nang',
    gender: 'male',
    pitch: 'medium',
    geminiBaseVoice: 'Puck',
    description:
      'Giọng nam miền Trung khỏe khoắn, nhịp điệu rõ ràng, năng động. Tối ưu cho điểm tin nhanh, thuyết minh công nghệ và phim doanh nghiệp.',
    bestFor: ['Điểm tin nhanh', 'Review Công nghệ', 'Phim doanh nghiệp'],
    avatarColor: 'from-indigo-600 via-violet-600 to-purple-700',
    badgeText: 'Puck / Iapetus • Đà Nẵng',
    type: 'prebuilt',
    stylePrompt:
      'energetic, crisp Central Vietnamese Da Nang male voice, confident and rhythmic delivery',
  },
  {
    id: 'voice-thay-do-nghe',
    name: 'Thầy Đồ Nghệ',
    regionLabel: 'Nam • Giọng Nghệ An',
    region: 'nghe-an',
    gender: 'male',
    pitch: 'low',
    geminiBaseVoice: 'Gacrux',
    description:
      'Giọng nam xứ Nghệ trầm dày, sâu lắng, hào sảng và giàu nội lực. Tối ưu cho ngâm thơ, đọc sử, bình văn và ký sự lịch sử.',
    bestFor: ['Ngâm thơ', 'Ký sự lịch sử', 'Bình văn cổ điển'],
    avatarColor: 'from-amber-800 via-yellow-700 to-stone-800',
    badgeText: 'Gacrux / Algenib • Nghệ An',
    type: 'prebuilt',
    stylePrompt:
      'deep, resonant, soulful Nghe An North-Central Vietnamese male voice, poetic cadence with rich low frequencies',
  },
];

export const LANGUAGE_OPTIONS: {
  code: LanguageCode;
  label: string;
  flag: string;
  shortBadge: string;
  consentPhrase: string;
}[] = [
  {
    code: 'vi-VN',
    label: 'Tiếng Việt (vi-VN)',
    flag: '🇻🇳',
    shortBadge: 'VI-VN',
    consentPhrase:
      'Tôi là chủ sở hữu hợp pháp của giọng nói này và tôi đồng ý cho phép Google cùng hệ thống S-voice sử dụng bản thu âm này để tạo mô hình giọng nói nhân tạo.',
  },
  {
    code: 'en-US',
    label: 'Tiếng Anh - Mỹ (en-US)',
    flag: '🇺🇸',
    shortBadge: 'EN-US',
    consentPhrase:
      'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.',
  },
  {
    code: 'en-GB',
    label: 'Tiếng Anh - Anh (en-GB)',
    flag: '🇬🇧',
    shortBadge: 'EN-GB',
    consentPhrase:
      'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.',
  },
  {
    code: 'fr-FR',
    label: 'Tiếng Pháp (fr-FR)',
    flag: '🇫🇷',
    shortBadge: 'FR-FR',
    consentPhrase:
      "Je suis le propriétaire de cette voix et j'autorise Google à utiliser cette voix pour créer un modèle de voix synthétique.",
  },
  {
    code: 'es-ES',
    label: 'Tiếng Tây Ban Nha (es-ES)',
    flag: '🇪🇸',
    shortBadge: 'ES-ES',
    consentPhrase:
      'Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.',
  },
  {
    code: 'zh-CN',
    label: 'Tiếng Trung (zh-CN)',
    flag: '🇨🇳',
    shortBadge: 'ZH-CN',
    consentPhrase:
      '我是该声音的所有者，我同意 Google 使用该声音创建合成语音模型。',
  },
  {
    code: 'ja-JP',
    label: 'Tiếng Nhật (ja-JP)',
    flag: '🇯🇵',
    shortBadge: 'JA-JP',
    consentPhrase:
      '私はこの声の所有者であり、Googleがこの声を使用して合成音声モデルを作成することに同意します。',
  },
  {
    code: 'ko-KR',
    label: 'Tiếng Hàn (ko-KR)',
    flag: '🇰🇷',
    shortBadge: 'KO-KR',
    consentPhrase:
      '본인은 이 목소리의 소유자이며 Google이 이 목소리를 사용하여 합성 음성 모델을 만드는 데 동의합니다.',
  },
  {
    code: 'th-TH',
    label: 'Tiếng Thái (th-TH)',
    flag: '🇹🇭',
    shortBadge: 'TH-TH',
    consentPhrase:
      'ฉันเป็นเจ้าของเสียงนี้และยินยอมให้ Google ใช้เสียงนี้เพื่อสร้างโมเดลเสียงสังเคราะห์',
  },
];

export const GENRE_OPTIONS: { id: GenreType; label: string; icon: string }[] = [
  { id: 'investigative-report', label: 'Đọc phóng sự điều tra', icon: 'ShieldAlert' },
  { id: 'news-broadcast', label: 'Đọc tin tức báo chí', icon: 'Newspaper' },
  { id: 'thematic-podcast', label: 'Podcast chuyên đề', icon: 'Mic' },
  { id: 'natural-dialogue', label: 'Hội thoại tự nhiên', icon: 'MessagesSquare' },
  { id: 'late-night-story', label: 'Đọc truyện đêm khuya', icon: 'Moon' },
  { id: 'poetry-recitation', label: 'Ngâm thơ & Bình văn', icon: 'Feather' },
  { id: 'corporate-narration', label: 'Thuyết minh phim doanh nghiệp', icon: 'Building2' },
];

export const REGION_OPTIONS: { id: RegionAccent; label: string; desc: string }[] = [
  { id: 'ha-noi', label: 'Hà Nội', desc: 'Chuẩn mực, trầm ấm' },
  { id: 'sai-gon', label: 'TP.HCM - Sài Gòn', desc: 'Hiện đại, trẻ trung' },
  { id: 'can-tho', label: 'Cần Thơ - Miền Tây', desc: 'Ngọt ngào, sâu lắng' },
  { id: 'da-nang', label: 'Đà Nẵng - Miền Trung', desc: 'Chắc khỏe, gần gũi' },
  { id: 'nghe-an', label: 'Nghệ An - Xứ Nghệ', desc: 'Trầm hùng, truyền cảm' },
];

export const MOOD_AXIS_OPTIONS: { id: MoodAxis; label: string; prompt: string }[] = [
  { id: 'calm-serious', label: 'Điềm tĩnh / Nghiêm túc', prompt: 'calm, composed, and serious' },
  { id: 'cheerful-excited', label: 'Vui tươi / Hào hứng', prompt: 'cheerful, upbeat, and enthusiastic' },
  { id: 'melancholic-deep', label: 'Buồn lắng đọng', prompt: 'melancholic, reflective, and emotionally deep' },
  { id: 'fierce-determined', label: 'Giận dữ / Quyết liệt', prompt: 'intense, urgent, and resolute' },
  { id: 'sarcastic-satirical', label: 'Mỉa mai / Châm biếm', prompt: 'wry, ironic, and subtly satirical' },
  { id: 'suspenseful-dramatic', label: 'Hồi hộp / Kịch tính', prompt: 'suspenseful, tense, and dramatic' },
  { id: 'witty-playful', label: 'Đùa cợt / Hóm hỉnh', prompt: 'witty, lighthearted, and playful' },
];

export const DELIVERY_AXIS_OPTIONS: { id: DeliveryAxis; label: string; prompt: string }[] = [
  { id: 'natural', label: 'Tự nhiên (Conversational)', prompt: 'natural conversational cadence' },
  { id: 'news-anchor', label: 'Dứt khoát (Phát thanh viên)', prompt: 'crisp, authoritative broadcast news anchor delivery' },
  { id: 'whispering', label: 'Thì thầm (whispering)', prompt: 'whispered softly and intimately' },
  { id: 'out-of-breath', label: 'Hụt hơi (out of breath)', prompt: 'slightly out of breath, urgent field reporter delivery' },
  { id: 'warm-storytelling', label: 'Tâm tình sâu lắng (warm storytelling)', prompt: 'warm, unhurried late-night storytelling delivery' },
  { id: 'dramatic-climax', label: 'Cao trào (dramatic)', prompt: 'high-impact dramatic stage delivery' },
];

export const EXPRESSION_TAGS: {
  tag: string;
  label: string;
  desc: string;
  color: string;
}[] = [
  { tag: '<short pause>', label: 'Nghỉ ngắn', desc: 'Ngắt nhịp 0.4s tự nhiên', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30' },
  { tag: '<long pause>', label: 'Nghỉ dài', desc: 'Ngắt đoạn 1.2s lắng đọng', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30' },
  { tag: '<breath>', label: 'Lấy hơi', desc: 'Tiếng hít thở tự nhiên trước câu dài', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30' },
  { tag: '<sigh>', label: 'Thở dài', desc: 'Tiếng thở dài trăn trở / cảm xúc', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  { tag: '<laugh>', label: 'Bật cười', desc: 'Tiếng cười sảng khoái', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
  { tag: '<chuckle>', label: 'Cười nhẹ', desc: 'Cười mỉm thân thiện trong hội thoại', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-500/30' },
  { tag: '<cough>', label: 'Hắng giọng', desc: 'Hắng giọng nhẹ tự nhiên', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30' },
  { tag: '<gasp>', label: 'Ngạc nhiên', desc: 'Lấy hơi gấp vì bất ngờ', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30' },
  { tag: '<throat-clearing>', label: 'Đằng hắng', desc: 'Đằng hắng trước khi chuyển ý', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30' },
];

export const BACKCHANNEL_TAGS: { tag: string; label: string }[] = [
  { tag: '|ừm hứm|', label: '|ừm hứm|' },
  { tag: '|thật sao?|', label: '|thật sao?|' },
  { tag: '|đúng rồi|', label: '|đúng rồi|' },
  { tag: '|chính xác|', label: '|chính xác|' },
];

export const BGM_THEMES: {
  id: BgmThemeId;
  name: string;
  desc: string;
  tempoBpm: number;
  baseFreq: number;
}[] = [
  { id: 'none', name: 'Không dùng nhạc nền (Pure Voice)', desc: 'Chỉ xuất giọng đọc nguyên bản phòng thu', tempoBpm: 0, baseFreq: 0 },
  { id: 'news-pulse', name: 'Tin tức Thời sự (News Pulse)', desc: 'Nhịp synth hiện đại, dồn dập chuẩn bản tin 24h', tempoBpm: 118, baseFreq: 220 },
  { id: 'investigative-tension', name: 'Phóng sự Kịch tính (Investigative Drone)', desc: 'Âm trầm điện ảnh sâu lắng, tạo chiều sâu điều tra', tempoBpm: 84, baseFreq: 110 },
  { id: 'lofi-story', name: 'Lofi Đọc truyện (Warm Ambient Pad)', desc: 'Hợp âm ấm áp, thư giãn cho tản văn & truyện đêm khuya', tempoBpm: 72, baseFreq: 196 },
  { id: 'poetry-zither', name: 'Giai điệu Ngâm thơ (Pentatonic Zither)', desc: 'Âm hưởng ngũ cung đàn tranh thanh tao, truyền thống', tempoBpm: 64, baseFreq: 261.63 },
  { id: 'podcast-chill', name: 'Podcast Trẻ trung (Studio Groove)', desc: 'Nhịp điệu trẻ trung, năng động cho đối thoại 2 người', tempoBpm: 102, baseFreq: 246.94 },
];

export const DEFAULT_PHONETIC_ALIASES: PhoneticAlias[] = [
  { id: 'pa-1', term: 'VRG', phonetic: 'Vi-A-Gi', note: 'Tập đoàn Công nghiệp Cao su Việt Nam' },
  { id: 'pa-2', term: 'S-voice', phonetic: 'Ét-Voi', note: 'Tên ứng dụng Phòng thu Giọng đọc AI' },
  { id: 'pa-3', term: 'AI', phonetic: 'ây-ai', note: 'Trí tuệ nhân tạo' },
  { id: 'pa-4', term: 'CEO', phonetic: 'xi-i-âu', note: 'Giám đốc điều hành' },
  { id: 'pa-5', term: 'FDI', phonetic: 'ép-đi-ai', note: 'Đầu tư trực tiếp nước ngoài' },
];

export const JOURNALISM_DICTIONARY: Record<
  string,
  { replacement: string; category: 'spelling' | 'abbreviation' | 'number'; explanation: string }
> = {
  'TP.HCM': {
    replacement: 'Thành phố Hồ Chí Minh',
    category: 'abbreviation',
    explanation: 'Bung chữ viết tắt địa danh hành chính chuẩn phát thanh',
  },
  UBND: {
    replacement: 'Ủy ban nhân dân',
    category: 'abbreviation',
    explanation: 'Bung chữ viết tắt cơ quan hành chính nhà nước',
  },
  'NĐ-CP': {
    replacement: 'Nghị định Chính phủ',
    category: 'abbreviation',
    explanation: 'Bung ký hiệu văn bản quy phạm pháp luật',
  },
  'TT-BXD': {
    replacement: 'Thông tư Bộ Xây dựng',
    category: 'abbreviation',
    explanation: 'Bung ký hiệu thông tư bộ ngành',
  },
  ĐBQH: {
    replacement: 'Đại biểu Quốc hội',
    category: 'abbreviation',
    explanation: 'Bung chức danh cơ quan lập pháp',
  },
  '23/10/2026': {
    replacement: 'ngày hai mươi ba tháng mười năm hai nghìn không trăm hai mươi sáu',
    category: 'number',
    explanation: 'Chuyển ngày tháng sang chữ đọc chuẩn phát thanh viên',
  },
  '2,5 tỷ USD': {
    replacement: 'hai phẩy năm tỷ đô la Mỹ',
    category: 'number',
    explanation: 'Bung số thập phân và đơn vị tiền tệ quốc tế',
  },
  '80 km/h': {
    replacement: 'tám mươi ki lô mét trên giờ',
    category: 'number',
    explanation: 'Bung đơn vị vận tốc sang chữ đọc tiếng Việt',
  },
  'xử lí': {
    replacement: 'xử lý',
    category: 'spelling',
    explanation: 'Chuẩn hóa chính tả y/i theo quy tắc báo chí hiện hành',
  },
  'sát nhập': {
    replacement: 'sáp nhập',
    category: 'spelling',
    explanation: 'Sửa lỗi chính tả phổ biến ("sáp nhập" mới đúng từ nguyên)',
  },
  'chẩn đoán': {
    replacement: 'chẩn đoán',
    category: 'spelling',
    explanation: 'Từ đúng chuẩn',
  },
  'chuẩn đoán': {
    replacement: 'chẩn đoán',
    category: 'spelling',
    explanation: 'Sửa lỗi phương ngữ/nhầm lẫn phổ biến ("chẩn đoán" mới đúng)',
  },
  'giành giật': {
    replacement: 'giành giật',
    category: 'spelling',
    explanation: 'Từ đúng chuẩn',
  },
  'dành giật': {
    replacement: 'giành giật',
    category: 'spelling',
    explanation: 'Sửa lỗi chính tả d/gi ("giành giật" mới đúng)',
  },
};

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'sample-1-investigative',
    title: 'Mẫu 1: Phóng sự điều tra (Giọng Đặng Sinh - Hà Nội)',
    subtitle: 'Kiểm thử bung chữ viết tắt (TP.HCM, UBND, NĐ-CP), số liệu (23/10/2026, 2,5 tỷ USD) & sửa 3 lỗi chính tả',
    badge: 'Phóng sự • 1 Giọng Nam Hà Nội',
    bgmTheme: 'investigative-tension',
    params: {
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
      speaker1Name: 'Nhà báo Đặng Sinh',
    },
    rawScript: `Tại TP.HCM vào ngày 23/10/2026, UBND thành phố đã họp khẩn cùng các ĐBQH để rà soát tiến độ thực hiện NĐ-CP và TT-BXD liên quan đến gói hạ tầng trị giá 2,5 tỷ USD. <short pause> Tuy nhiên, qua khảo sát thực tế trên tuyến cao tốc thiết kế 80 km/h, phóng viên ghi nhận nhiều hạng mục vẫn chưa được xử lí dứt điểm sau khi sát nhập các ban quản lý dự án. <sigh> Việc chuẩn đoán đúng điểm nghẽn thể chế lúc này là yếu tố SỐNG CÒN để khơi thông nguồn vốn đầu tư công.`,
    precomputedIssues: [
      {
        original: 'TP.HCM',
        replacement: 'Thành phố Hồ Chí Minh',
        category: 'abbreviation',
        explanation: 'Bung chữ viết tắt địa danh hành chính chuẩn phát thanh',
      },
      {
        original: '23/10/2026',
        replacement: 'ngày hai mươi ba tháng mười năm hai nghìn không trăm hai mươi sáu',
        category: 'number',
        explanation: 'Chuyển ngày tháng sang chữ đọc chuẩn phát thanh viên',
      },
      {
        original: 'UBND',
        replacement: 'Ủy ban nhân dân',
        category: 'abbreviation',
        explanation: 'Bung chữ viết tắt cơ quan hành chính nhà nước',
      },
      {
        original: 'ĐBQH',
        replacement: 'Đại biểu Quốc hội',
        category: 'abbreviation',
        explanation: 'Bung chữ viết tắt cơ quan lập pháp',
      },
      {
        original: 'NĐ-CP',
        replacement: 'Nghị định Chính phủ',
        category: 'abbreviation',
        explanation: 'Bung ký hiệu văn bản quy phạm pháp luật',
      },
      {
        original: 'TT-BXD',
        replacement: 'Thông tư Bộ Xây dựng',
        category: 'abbreviation',
        explanation: 'Bung ký hiệu thông tư bộ ngành',
      },
      {
        original: '2,5 tỷ USD',
        replacement: 'hai phẩy năm tỷ đô la Mỹ',
        category: 'number',
        explanation: 'Bung số thập phân và đơn vị tiền tệ quốc tế',
      },
      {
        original: '80 km/h',
        replacement: 'tám mươi ki lô mét trên giờ',
        category: 'number',
        explanation: 'Bung đơn vị vận tốc sang chữ đọc tiếng Việt',
      },
      {
        original: 'xử lí',
        replacement: 'xử lý',
        category: 'spelling',
        explanation: 'Chuẩn hóa chính tả i/y theo quy tắc báo chí',
      },
      {
        original: 'sát nhập',
        replacement: 'sáp nhập',
        category: 'spelling',
        explanation: 'Sửa lỗi chính tả ("sáp nhập" mới đúng từ nguyên)',
      },
      {
        original: 'chuẩn đoán',
        replacement: 'chẩn đoán',
        category: 'spelling',
        explanation: 'Sửa lỗi chính tả phổ biến ("chẩn đoán" mới đúng)',
      },
    ],
    precomputedTurns: [
      {
        speaker: 'Speaker1',
        speakerLabel: 'Nhà báo Đặng Sinh (Hà Nội)',
        voiceId: 'voice-dang-sinh-hn',
        text: 'Tại Thành phố Hồ Chí Minh vào ngày hai mươi ba tháng mười năm hai nghìn không trăm hai mươi sáu, Ủy ban nhân dân thành phố đã họp khẩn cùng các Đại biểu Quốc hội để rà soát tiến độ thực hiện Nghị định Chính phủ và Thông tư Bộ Xây dựng liên quan đến gói hạ tầng trị giá hai phẩy năm tỷ đô la Mỹ.',
        styleInstruction: 'calm, serious, authoritative Hanoi male investigative journalist delivery',
        estimatedDurationSec: 16.5,
        estimatedTokens: 98,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Nhà báo Đặng Sinh (Hà Nội)',
        voiceId: 'voice-dang-sinh-hn',
        text: '<short pause> Tuy nhiên, qua khảo sát thực tế trên tuyến cao tốc thiết kế tám mươi ki lô mét trên giờ, phóng viên ghi nhận nhiều hạng mục vẫn chưa được xử lý dứt điểm sau khi sáp nhập các ban quản lý dự án.',
        styleInstruction: 'measured, analytical, slightly grave investigative tone',
        estimatedDurationSec: 12.0,
        estimatedTokens: 74,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Nhà báo Đặng Sinh (Hà Nội)',
        voiceId: 'voice-dang-sinh-hn',
        text: '<sigh> Việc chẩn đoán đúng điểm nghẽn thể chế lúc này là yếu tố SỐNG CÒN để khơi thông nguồn vốn đầu tư công.',
        styleInstruction: 'resolute, emphatic broadcast conclusion',
        estimatedDurationSec: 8.5,
        estimatedTokens: 52,
      },
    ],
  },
  {
    id: 'sample-2-podcast-dialogue',
    title: 'Mẫu 2: Podcast Đối thoại 2 người (Đặng Sinh & Ngọc Hà)',
    subtitle: 'Hội thoại Bắc – Nam về AI trong báo chí hiện đại, có thẻ chêm lời |đúng rồi|, |thật sao?| và <chuckle>',
    badge: 'Podcast 2 Vai • Bắc - Nam',
    bgmTheme: 'podcast-chill',
    params: {
      language: 'vi-VN',
      genre: 'thematic-podcast',
      speakerMode: 'multi',
      gender: 'male',
      pitch: 'medium',
      region: 'ha-noi',
      speed: 1.0,
      mood: 'cheerful-excited',
      delivery: 'natural',
      speaker1VoiceId: 'voice-dang-sinh-hn',
      speaker2VoiceId: 'voice-ngoc-ha-sg',
      speaker1Name: 'Nhà báo Đặng Sinh',
      speaker2Name: 'MC Ngọc Hà',
    },
    rawScript: `[Đặng Sinh]: Chào Ngọc Hà và quý thính giả của S-voice Studio! <short pause> Hôm nay chúng ta bàn về một chủ đề đang làm nóng mọi tòa soạn: Phòng thu giọng đọc AI đa vùng miền.
[Ngọc Hà]: Chào anh Đặng Sinh! <chuckle> |đúng rồi| Thực sự trước đây mỗi lần biên tập bản tin đêm hay làm podcast 2 người, tụi em ở TP.HCM phải mất hàng giờ thu âm và cắt ghép thủ công.
[Đặng Sinh]: |chính xác| Không chỉ tốn thời gian thu âm đâu Ngọc Hà ạ, khâu rà soát các từ viết tắt như UBND, NĐ-CP hay đọc các con số 2,5 tỷ USD sao cho tròn vành rõ chữ cũng là áp lực lớn.
[Ngọc Hà]: <gasp> |thật sao?| Và tuyệt vời nhất là giờ đây chỉ cần một cú nhấp chuột, giọng Bắc trầm ấm của anh Sinh có thể tung hứng tự nhiên cùng giọng Sài Gòn của Hà ngay trên một kịch bản!`,
    precomputedIssues: [
      {
        original: 'TP.HCM',
        replacement: 'Thành phố Hồ Chí Minh',
        category: 'abbreviation',
        explanation: 'Bung chữ viết tắt địa danh trong lời thoại Podcast',
      },
      {
        original: 'UBND',
        replacement: 'Ủy ban nhân dân',
        category: 'abbreviation',
        explanation: 'Bung chữ viết tắt cơ quan hành chính',
      },
      {
        original: 'NĐ-CP',
        replacement: 'Nghị định Chính phủ',
        category: 'abbreviation',
        explanation: 'Bung ký hiệu văn bản pháp luật',
      },
      {
        original: '2,5 tỷ USD',
        replacement: 'hai phẩy năm tỷ đô la Mỹ',
        category: 'number',
        explanation: 'Bung số liệu tiền tệ sang chữ đọc tự nhiên',
      },
    ],
    precomputedTurns: [
      {
        speaker: 'Speaker1',
        speakerLabel: 'Nhà báo Đặng Sinh (Hà Nội)',
        voiceId: 'voice-dang-sinh-hn',
        text: 'Chào Ngọc Hà và quý thính giả của Ét-Voi Studio! <short pause> Hôm nay chúng ta bàn về một chủ đề đang làm nóng mọi tòa soạn: Phòng thu giọng đọc ây-ai đa vùng miền.',
        styleInstruction: 'warm, welcoming Hanoi male podcast host',
        estimatedDurationSec: 9.5,
        estimatedTokens: 64,
      },
      {
        speaker: 'Speaker2',
        speakerLabel: 'MC Ngọc Hà (Sài Gòn)',
        voiceId: 'voice-ngoc-ha-sg',
        text: 'Chào anh Đặng Sinh! <chuckle> |đúng rồi| Thực sự trước đây mỗi lần biên tập bản tin đêm hay làm podcast hai người, tụi em ở Thành phố Hồ Chí Minh phải mất hàng giờ thu âm và cắt ghép thủ công.',
        styleInstruction: 'cheerful, modern Saigon female co-host, lively and expressive',
        estimatedDurationSec: 11.2,
        estimatedTokens: 72,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Nhà báo Đặng Sinh (Hà Nội)',
        voiceId: 'voice-dang-sinh-hn',
        text: '|chính xác| Không chỉ tốn thời gian thu âm đâu Ngọc Hà ạ, khâu rà soát các từ viết tắt như Ủy ban nhân dân, Nghị định Chính phủ hay đọc các con số hai phẩy năm tỷ đô la Mỹ sao cho tròn vành rõ chữ cũng là áp lực lớn.',
        styleInstruction: 'insightful, conversational northern journalist tone',
        estimatedDurationSec: 12.8,
        estimatedTokens: 82,
      },
      {
        speaker: 'Speaker2',
        speakerLabel: 'MC Ngọc Hà (Sài Gòn)',
        voiceId: 'voice-ngoc-ha-sg',
        text: '<gasp> |thật sao?| Và tuyệt vời nhất là giờ đây chỉ cần một cú nhấp chuột, giọng Bắc trầm ấm của anh Sinh có thể tung hứng tự nhiên cùng giọng Sài Gòn của Hà ngay trên một kịch bản!',
        styleInstruction: 'enthusiastic, bright and inspiring conclusion',
        estimatedDurationSec: 10.5,
        estimatedTokens: 68,
      },
    ],
  },
  {
    id: 'sample-3-mekong-story',
    title: 'Mẫu 3: Tản văn Miền Tây (Giọng Bé Tư Cầm Thi - Cần Thơ)',
    subtitle: 'Tản văn giàu cảm xúc về mùa nước nổi miền Tây kết hợp nhạc nền Lofi / Đàn tranh tự động giảm âm (Auto-Ducking)',
    badge: 'Tản văn • Giọng Nữ Cần Thơ',
    bgmTheme: 'lofi-story',
    params: {
      language: 'vi-VN',
      genre: 'late-night-story',
      speakerMode: 'single',
      gender: 'female',
      pitch: 'medium',
      region: 'can-tho',
      speed: 0.85,
      mood: 'melancholic-deep',
      delivery: 'warm-storytelling',
      speaker1VoiceId: 'voice-be-tu-can-tho',
      speaker1Name: 'Bé Tư Cầm Thi',
    },
    rawScript: `<breath> Chiều buông trên bến Ninh Kiều, con nước lớn từ thượng nguồn sông Mê Kông lại dịu dàng đổ về mang theo sắc vàng bông điên điển. <short pause> Người miền Tây quê mình thương con nước nổi như thương người bạn cũ đi xa lâu ngày mới về. <long pause> Giữa mênh mông sóng nước, nghe tiếng mái dầm khua nhẹ dưới ánh trăng rằm, lòng người bỗng dịu lại, bao mỏi mệt nơi phố thị cũng tan theo làn gió chướng ngọt lành.`,
    precomputedIssues: [],
    precomputedTurns: [
      {
        speaker: 'Speaker1',
        speakerLabel: 'Bé Tư Cầm Thi (Cần Thơ)',
        voiceId: 'voice-be-tu-can-tho',
        text: '<breath> Chiều buông trên bến Ninh Kiều, con nước lớn từ thượng nguồn sông Mê Kông lại dịu dàng đổ về mang theo sắc vàng bông điên điển.',
        styleInstruction: 'sweet, gentle Mekong Delta female storytelling voice, slow and soulful',
        estimatedDurationSec: 9.8,
        estimatedTokens: 54,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Bé Tư Cầm Thi (Cần Thơ)',
        voiceId: 'voice-be-tu-can-tho',
        text: '<short pause> Người miền Tây quê mình thương con nước nổi như thương người bạn cũ đi xa lâu ngày mới về.',
        styleInstruction: 'warm, nostalgic, affectionate southern cadence',
        estimatedDurationSec: 7.4,
        estimatedTokens: 42,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Bé Tư Cầm Thi (Cần Thơ)',
        voiceId: 'voice-be-tu-can-tho',
        text: '<long pause> Giữa mênh mông sóng nước, nghe tiếng mái dầm khua nhẹ dưới ánh trăng rằm, lòng người bỗng dịu lại, bao mỏi mệt nơi phố thị cũng tan theo làn gió chướng ngọt lành.',
        styleInstruction: 'soft, lingering, poetic late-night radio conclusion',
        estimatedDurationSec: 12.2,
        estimatedTokens: 66,
      },
    ],
  },
  {
    id: 'sample-4-nghe-an-poetry',
    title: 'Mẫu 4: Ngâm thơ & Bình văn (Giọng Thầy Đồ Nghệ)',
    subtitle: 'Trích đoạn thơ & lời bình truyền thống có thẻ <long pause>, <breath> ở tốc độ chậm 0.85x kèm nhạc nền Ngũ cung',
    badge: 'Ngâm thơ • Giọng Nam Xứ Nghệ',
    bgmTheme: 'poetry-zither',
    params: {
      language: 'vi-VN',
      genre: 'poetry-recitation',
      speakerMode: 'single',
      gender: 'male',
      pitch: 'low',
      region: 'nghe-an',
      speed: 0.85,
      mood: 'melancholic-deep',
      delivery: 'dramatic-climax',
      speaker1VoiceId: 'voice-thay-do-nghe',
      speaker1Name: 'Thầy Đồ Nghệ',
    },
    rawScript: `<breath> Đường vô xứ Nghệ quanh quanh, <short pause> non xanh nước biếc như tranh họa đồ. <long pause> Tiếng ví giặm ngân lên giữa đôi bờ sông Lam như mạch nguồn văn hiến ngàn năm chưa bao giờ vơi cạn. <sigh> Mỗi câu chữ không chỉ là âm thanh, mà là cốt cách kiên cường, trọng nghĩa tình của con người miền gió Lào cát trắng.`,
    precomputedIssues: [],
    precomputedTurns: [
      {
        speaker: 'Speaker1',
        speakerLabel: 'Thầy Đồ Nghệ (Nghệ An)',
        voiceId: 'voice-thay-do-nghe',
        text: '<breath> Đường vô xứ Nghệ quanh quanh, <short pause> non xanh nước biếc như tranh họa đồ.',
        styleInstruction: 'deep, resonant Nghe An poetic recitation, expressive slow rhythm',
        estimatedDurationSec: 8.2,
        estimatedTokens: 38,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Thầy Đồ Nghệ (Nghệ An)',
        voiceId: 'voice-thay-do-nghe',
        text: '<long pause> Tiếng ví giặm ngân lên giữa đôi bờ sông Lam như mạch nguồn văn hiến ngàn năm chưa bao giờ vơi cạn.',
        styleInstruction: 'solemn, proud, rich bass literary commentary',
        estimatedDurationSec: 9.0,
        estimatedTokens: 46,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Thầy Đồ Nghệ (Nghệ An)',
        voiceId: 'voice-thay-do-nghe',
        text: '<sigh> Mỗi câu chữ không chỉ là âm thanh, mà là cốt cách kiên cường, trọng nghĩa tình của con người miền gió Lào cát trắng.',
        styleInstruction: 'warm, heartfelt, enduring emotional depth',
        estimatedDurationSec: 9.5,
        estimatedTokens: 48,
      },
    ],
  },
  {
    id: 'sample-5-international-news',
    title: 'Mẫu 5: Bản tin Quốc tế Đa ngôn ngữ (Việt / Anh-Mỹ / Nhật)',
    subtitle: 'Bản tin Công nghệ – Tài chính kiểm thử phát hiện ngôn ngữ tự động, từ điển phát âm VRG & Dịch lồng tiếng 1 chạm',
    badge: 'Đa ngôn ngữ • Tin Công nghệ',
    bgmTheme: 'news-pulse',
    params: {
      language: 'en-US',
      genre: 'news-broadcast',
      speakerMode: 'single',
      gender: 'male',
      pitch: 'medium',
      region: 'da-nang',
      speed: 1.0,
      mood: 'calm-serious',
      delivery: 'news-anchor',
      speaker1VoiceId: 'voice-minh-nhat-dn',
      speaker1Name: 'Minh Nhật International',
    },
    rawScript: `Good evening from the S-voice Global Newsdesk. <short pause> On 23/10/2026, enterprise AI adoption across Southeast Asia reached 2,5 tỷ USD in new cloud and media infrastructure investments. <breath> Meanwhile in Vietnam, VRG and leading newsrooms in TP.HCM are pioneering multi-lingual AI audio journalism to connect global audiences in real time.`,
    precomputedIssues: [
      {
        original: '23/10/2026',
        replacement: 'October twenty-third, twenty twenty-six',
        category: 'number',
        explanation: 'Chuyển ngày tháng sang cách đọc chuẩn bản tin tiếng Anh quốc tế',
      },
      {
        original: '2,5 tỷ USD',
        replacement: 'two point five billion US dollars',
        category: 'number',
        explanation: 'Bung số liệu tài chính sang tiếng Anh chuẩn phát thanh',
      },
      {
        original: 'TP.HCM',
        replacement: 'Ho Chi Minh City',
        category: 'abbreviation',
        explanation: 'Bung địa danh viết tắt sang tên quốc tế',
      },
    ],
    precomputedTurns: [
      {
        speaker: 'Speaker1',
        speakerLabel: 'Minh Nhật (Global Anchor)',
        voiceId: 'voice-minh-nhat-dn',
        text: 'Good evening from the S-voice Global Newsdesk. <short pause> On October twenty-third, twenty twenty-six, enterprise AI adoption across Southeast Asia reached two point five billion US dollars in new cloud and media infrastructure investments.',
        styleInstruction: 'crisp, authoritative international broadcast anchor delivery',
        estimatedDurationSec: 12.4,
        estimatedTokens: 64,
      },
      {
        speaker: 'Speaker1',
        speakerLabel: 'Minh Nhật (Global Anchor)',
        voiceId: 'voice-minh-nhat-dn',
        text: '<breath> Meanwhile in Vietnam, Vi-A-Gi and leading newsrooms in Ho Chi Minh City are pioneering multi-lingual AI audio journalism to connect global audiences in real time.',
        styleInstruction: 'confident, dynamic global technology report cadence',
        estimatedDurationSec: 10.6,
        estimatedTokens: 56,
      },
    ],
  },
];
