export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── キーは環境変数から読むだけ（ファイルには絶対に書かない）。この構造は維持 ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  try {
    // kind: 'email'（メール本文） / 'deadline'（FAXスキャン等の締切文書） / 未指定（従来の勉強会パンフレット）
    const { kind, base64Data, mediaType, filename, subject, from, body, received } = req.body;

    // 締切のある事務連絡を抜く共通プロンプト（メールでもFAXでも中身は同じ判定）
    const deadlinePrompt = (ctx) =>
      'これは医療機関に届いた事務連絡です（行政・補助金・加算届出・各種事務局など）。' +
      (ctx === 'fax' ? 'FAXをスキャンした文書です（読み取り誤りや罫線・かすれがある前提で丁寧に読んでください）。' : '') + '\n' +
      'この連絡に「対応の締切」や「提出期間」があるかを判定し、JSONのみで返してください（前後の文章・マークダウン不要）。\n\n' +
      '判定ルール:\n' +
      '・申請/提出/届出/回答/更新/登録などの「いつまでに何かをする」期限があれば has_deadline:true。\n' +
      '・単なる開催案内・受領通知・広告で、こちらが何かを提出する締切がなければ has_deadline:false。\n' +
      '・受付や提出に「期間」がある場合は start_date(開始日)と due_date(締切日)の両方を入れる。単一の締切なら start_date は空文字。\n' +
      '・日付は必ず YYYY-MM-DD。年が無ければ受信/受領日 ' + (received || '不明') + ' を基準に最も自然な年を補う。\n' +
      '・重要度 importance は 高/中/低（行政の必須届出や補助金の締切は「高」）。\n' +
      '・dedup_key には「制度名＋手続き名」を短く（例:大阪府生産性向上補助金_実績報告）。同じ件のメールとFAXを後で突き合わせる用。\n\n' +
      '出力JSON:\n' +
      '{"has_deadline":true,"title":"何をする件か簡潔に","start_date":"YYYY-MM-DD または空文字",' +
      '"due_date":"YYYY-MM-DD","category":"行政連絡/補助金/加算届出/医師会/その他","importance":"高/中/低",' +
      '"summary":"締切までに何をすべきか1〜2文で","dedup_key":"制度名_手続き名"}';

    // ---------- (1) メール本文 ----------
    if (kind === 'email') {
      if (!body && !subject) return res.status(400).json({ error: 'メール内容が不足しています' });
      const content = [{ type: 'text', text:
        deadlinePrompt('email') + '\n\n--- メール ---\n件名: ' + (subject || '') +
        '\n差出人: ' + (from || '') + '\n本文:\n' + (body || '') }];
      const r = await callClaude(apiKey, content);
      if (r.error) return res.status(r.status).json({ error: r.error });
      if (!r.parsed) return res.status(422).json({ error: '締切情報を読み取れませんでした' });
      return res.status(200).json({ event: { ...r.parsed, source: 'email', from, subject } });
    }

    // ---------- (2) FAXスキャン等の締切文書（PDF / 画像） ----------
    if (kind === 'deadline') {
      if (!base64Data || !mediaType) return res.status(400).json({ error: 'データが不足しています' });
      const isImage = mediaType.startsWith('image/');
      const doc = isImage
        ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };
      const content = [doc, { type: 'text', text: deadlinePrompt('fax') }];
      const r = await callClaude(apiKey, content);
      if (r.error) return res.status(r.status).json({ error: r.error });
      if (!r.parsed) return res.status(422).json({ error: '締切情報を読み取れませんでした' });
      return res.status(200).json({ event: { ...r.parsed, source: 'fax', filename } });
    }

    // ---------- (3) 既存：勉強会・講演会パンフレット（PDF / 画像）※従来どおり ----------
    if (!base64Data || !mediaType) return res.status(400).json({ error: 'データが不足しています' });
    const isImage = mediaType.startsWith('image/');
    const eventPrompt =
      '以下の' + (isImage ? '画像' : 'PDF') +
      'は医薬品MR（医薬情報担当者）が持参した勉強会・講演会のパンフレットです。\n\n' +
      '以下の情報をJSONのみで返してください（前後の文章・マークダウン不要）:\n' +
      '{"title":"イベントタイトル","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM",' +
      '"location":"開催場所","organizer":"主催（製薬会社名など）","speaker":"講師名（不明なら空文字）",' +
      '"notes":"その他特記事項（参加費・弁当・単位など、なければ空文字）"}';
    const userContent = isImage
      ? [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
         { type: 'text', text: eventPrompt }]
      : [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
         { type: 'text', text: eventPrompt }];
    const r = await callClaude(apiKey, userContent);
    if (r.error) return res.status(r.status).json({ error: r.error });
    if (!r.parsed) return res.status(422).json({ error: '日時情報を読み取れませんでした' });
    return res.status(200).json({ event: { ...r.parsed, filename } });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'サーバーエラー' });
  }
}

// ── Claude 呼び出しを共通化（キーの渡し方・モデルは従来どおり） ──
async function callClaude(apiKey, userContent) {
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
    return { error: err.error?.message || 'Claude APIエラー', status: response.status };
  }
  const data = await response.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  try { return { parsed: JSON.parse(clean) }; }
  catch { return { parsed: null }; }
}
