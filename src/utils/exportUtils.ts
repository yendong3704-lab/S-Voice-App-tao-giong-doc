import { DialogueTurn, StudioParameters, VoiceProfile } from '../types/studio';

function formatSrtTimestamp(seconds: number, separator: ',' | '.' = ','): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.round((safeSec - Math.floor(safeSec)) * 1000);

  return (
    String(hrs).padStart(2, '0') +
    ':' +
    String(mins).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    separator +
    String(Math.min(999, ms)).padStart(3, '0')
  );
}

/**
 * Tạo nội dung phụ đề chuẩn .SRT (SubRip) khớp thời gian từng câu thoại cho CapCut / Premiere
 */
export function generateSrtContent(turns: DialogueTurn[]): string {
  let cursor = 0;
  return turns
    .map((turn, idx) => {
      const start = turn.startTimeSec ?? cursor;
      const end = turn.endTimeSec ?? start + turn.estimatedDurationSec;
      cursor = end;
      const cleanLine = turn.text
        .replace(/<[^>]+>/g, '')
        .replace(/\|([^|]+)\|/g, '($1)')
        .replace(/\s+/g, ' ')
        .trim();
      return `${idx + 1}\n${formatSrtTimestamp(start, ',')} --> ${formatSrtTimestamp(
        end,
        ','
      )}\n[${turn.speakerLabel}] ${cleanLine}\n`;
    })
    .join('\n');
}

/**
 * Tạo nội dung phụ đề chuẩn WebVTT (.VTT)
 */
export function generateVttContent(turns: DialogueTurn[]): string {
  let cursor = 0;
  const blocks = turns.map((turn, idx) => {
    const start = turn.startTimeSec ?? cursor;
    const end = turn.endTimeSec ?? start + turn.estimatedDurationSec;
    cursor = end;
    const cleanLine = turn.text
      .replace(/<[^>]+>/g, '')
      .replace(/\|([^|]+)\|/g, '($1)')
      .replace(/\s+/g, ' ')
      .trim();
    return `${idx + 1}\n${formatSrtTimestamp(start, '.')} --> ${formatSrtTimestamp(
      end,
      '.'
    )}\n<v ${turn.speakerLabel}>${cleanLine}`;
  });
  return `WEBVTT - S-voice AI Studio Subtitle\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Tải xuống file bất kỳ trên trình duyệt
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Xuất Bảng phân cảnh Kịch bản ra file Excel (.CSV chuẩn UTF-8 BOM hiển thị đúng tiếng Việt)
 */
export function exportStoryboardCsv(turns: DialogueTurn[], params: StudioParameters): void {
  const headers = [
    'STT',
    'Vai đọc (Speaker)',
    'Tên Giọng Đọc',
    'Mốc Bắt Đầu (s)',
    'Mốc Kết Thúc (s)',
    'Thời lượng (s)',
    'Chỉ dẫn Biểu cảm (speech_metadata.style)',
    'Lời thoại chuẩn hóa (Transcript)',
    'Token Ước tính',
  ];

  let cursor = 0;
  const rows = turns.map((t, i) => {
    const start = t.startTimeSec ?? cursor;
    const end = t.endTimeSec ?? start + t.estimatedDurationSec;
    cursor = end;
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    return [
      i + 1,
      escapeCsv(t.speaker),
      escapeCsv(t.speakerLabel),
      start.toFixed(2),
      end.toFixed(2),
      t.estimatedDurationSec.toFixed(2),
      escapeCsv(t.styleInstruction),
      escapeCsv(t.text),
      t.estimatedTokens,
    ].join(',');
  });

  const metaFooter = `\n"Thông số Phòng thu S-voice","Ngôn ngữ: ${params.language}","Thể loại: ${params.genre}","Tốc độ: ${params.speed}x","","","","",""`;
  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n') + metaFooter;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBrowserDownload(blob, `S-voice-Bang-Phan-Canh-${Date.now()}.csv`);
}

/**
 * Xuất Kịch bản Phòng thu sang định dạng Word (.doc chuẩn HTML-Word mở trực tiếp trên MS Word / Google Docs)
 */
export function exportScriptWordDoc(
  turns: DialogueTurn[],
  params: StudioParameters,
  rawScript: string
): void {
  let cursor = 0;
  const rowsHtml = turns
    .map((t, idx) => {
      const start = t.startTimeSec ?? cursor;
      const end = t.endTimeSec ?? start + t.estimatedDurationSec;
      cursor = end;
      return `
        <tr>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;color:#1e3a8a;">${
            t.speakerLabel
          }</td>
          <td style="padding:8px;border:1px solid #cbd5e1;font-family:monospace;">${formatSrtTimestamp(
            start
          )} - ${formatSrtTimestamp(end)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;font-style:italic;color:#b45309;">${
            t.styleInstruction
          }</td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${t.text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</td>
        </tr>`;
    })
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <title>Kịch bản Phòng thu S-voice</title>
    </head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;line-height:1.6;">
      <h1 style="color:#1e3a8a;margin-bottom:4px;">S-VOICE – PHÒNG THU GIỌNG ĐỌC AI & BIÊN TẬP KỊCH BẢN ĐA NGÔN NGỮ</h1>
      <p style="color:#475569;margin-top:0;">Khởi tạo bởi Nhà báo Đặng Sinh • Xuất bản lúc: ${new Date().toLocaleString(
        'vi-VN'
      )}</p>
      <hr />
      <h3>1. Thông số Đạo diễn Phòng thu</h3>
      <ul>
        <li><strong>Ngôn ngữ:</strong> ${params.language} | <strong>Vùng miền:</strong> ${
    params.region
  }</li>
        <li><strong>Chế độ đọc:</strong> ${
          params.speakerMode === 'multi' ? 'Đối thoại 2 người (Multi-speaker)' : '1 người đọc (Single-speaker)'
        }</li>
        <li><strong>Tốc độ đọc:</strong> ${params.speed}x | <strong>Cảm xúc:</strong> ${
    params.mood
  } | <strong>Kỹ thuật:</strong> ${params.delivery}</li>
      </ul>
      <h3>2. Văn bản gốc</h3>
      <p style="background:#f8fafc;padding:12px;border-left:4px solid #6366f1;">${rawScript
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>
      <h3>3. Bảng Phân Vai & Mốc Thời Gian Chi Tiết</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;">
            <th style="padding:8px;border:1px solid #cbd5e1;">Lượt</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Người đọc</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Timecode</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Chỉ dẫn Sắc thái (speech_metadata)</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Lời thoại (Transcript)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF', html], { type: 'application/msword;charset=utf-8' });
  triggerBrowserDownload(blob, `S-voice-Kich-Ban-Phong-Thu-${Date.now()}.doc`);
}

/**
 * Xuất / Nhập hồ sơ Giọng nhân bản cá nhân (.svoice)
 */
export function exportVoiceProfileSvoice(voice: VoiceProfile): void {
  const payload = {
    format: 'svoice-profile-v1',
    exportedAt: new Date().toISOString(),
    app: 'S-voice – Phòng thu Giọng đọc AI (Nhà báo Đặng Sinh)',
    voice,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const safeName = voice.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  triggerBrowserDownload(blob, `${safeName || 'custom-voice'}.svoice`);
}

/**
 * Tạo đường dẫn đặt lịch xuất bản Google Calendar
 */
export function buildGoogleCalendarUrl(turns: DialogueTurn[], params: StudioParameters): string {
  const now = new Date();
  const start = new Date(now.getTime() + 30 * 60 * 1000);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const title = encodeURIComponent(
    `[S-voice Studio] Xuất bản Âm thanh & Kịch bản (${params.language.toUpperCase()})`
  );
  const scriptPreview = turns
    .map((t, idx) => `${idx + 1}. [${t.speakerLabel}]: ${t.text}`)
    .join('\n')
    .slice(0, 900);
  const details = encodeURIComponent(
    `Dự án sản xuất trên S-voice – Phòng thu Giọng đọc AI & Biên tập Kịch bản Đa ngôn ngữ (Khởi tạo bởi Nhà báo Đặng Sinh).\n\n` +
      `• Ngôn ngữ: ${params.language} | Vùng miền: ${params.region} | Tốc độ: ${params.speed}x\n` +
      `• Chế độ: ${params.speakerMode === 'multi' ? '2 người đọc' : '1 người đọc'}\n\n` +
      `--- Kịch bản tóm tắt ---\n${scriptPreview}`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(
    start
  )}/${fmt(end)}&details=${details}`;
}

/**
 * Tạo đường dẫn mở Gmail gửi Kịch bản & Thông số phòng thu
 */
export function buildGmailComposeUrl(turns: DialogueTurn[], params: StudioParameters): string {
  const subject = encodeURIComponent(
    `[S-voice Studio] Kịch bản Phòng thu & Thông số Đạo diễn Giọng đọc AI (${params.language})`
  );
  const bodyText =
    `Xin chào Ban Biên tập / Đội ngũ Sản xuất,\n\n` +
    `Dưới đây là kịch bản đã chuẩn hóa và thông số đạo diễn âm thanh từ ứng dụng "S-voice – Phòng thu Giọng đọc AI & Biên tập Kịch bản Đa ngôn ngữ":\n\n` +
    `1. THÔNG SỐ PHÒNG THU:\n` +
    `- Ngôn ngữ: ${params.language}\n` +
    `- Chế độ: ${params.speakerMode === 'multi' ? '2 người đọc (Multi-speaker)' : '1 người đọc'}\n` +
    `- Tốc độ đọc: ${params.speed}x | Cảm xúc: ${params.mood} | Kỹ thuật: ${params.delivery}\n\n` +
    `2. KỊCH BẢN PHÂN VAI & TIMECODE:\n` +
    turns
      .map(
        (t, i) =>
          `Lượt ${i + 1} [${t.speakerLabel}] (${t.estimatedDurationSec}s | Style: ${t.styleInstruction}):\n"${t.text}"`
      )
      .join('\n\n') +
    `\n\n---\nKhởi tạo bởi S-voice AI Audio Studio (Nhà báo Đặng Sinh)`;

  return `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${encodeURIComponent(
    bodyText.slice(0, 1800)
  )}`;
}
