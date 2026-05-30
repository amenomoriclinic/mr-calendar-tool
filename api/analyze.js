export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });
  try {
    const { base64Data, mediaType, filename } = req.body;
    if (!base64Data || !mediaType) return res.status(400).json({ error: 'データが不足しています' });
    const isImage = mediaType.startsWith('image/');
    const userContent = isImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: '以下の画像は医薬品MR（医薬情報担当者）が持参した勉強会・講演会のパンフレットです。\n\n以下の情報をJSONのみで返してください（前後の文章・マークダウン不要）:\n{"title":"イベントタイトル","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","location":"開催場所","organizer":"主催（製薬会社名など）","speaker":"講師名（不明なら空文字）","notes":"その他特記事項（参加費・弁当・単位など、なければ空文字）"}' }
        ]
      : [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
          { type: 'text', text: '以下のPDFは医薬品MR（医薬情報担当者）が持参した勉強会・講演会のパンフレットです。\n\n以下の情報をJSONのみで返してください（前後の文章・マークダウン不要）:\n{"title":"イベントタイトル","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","location":"開催場所","organizer":"主催（製薬会社名など）","speaker":"講師名（不明なら空文字）","notes":"その他特記事項（参加費・弁当・単位など、なければ空文字）"}' }
        ];
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Claude APIエラー' });
    }
    const data = await response.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return res.status(422).json({ error: '日時情報を読み取れませんでした' }); }
    return res.status(200).json({ event: { ...parsed, filename } });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラー' });
  }
}
