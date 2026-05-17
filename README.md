# MR勉強会 カレンダー登録ツール

## ファイル構成
```
mr-calendar-tool/
├── index.html          ← フロントエンド（画面）
├── vercel.json         ← Vercel設定
├── api/
│   └── analyze.js      ← バックエンド（APIキーを安全に隠す）
└── README.md           ← この手順書
```

## セットアップ手順

### ステップ1：GitHubアカウント作成
1. https://github.com にアクセス
2. 「Sign up」→ メールアドレスで登録
3. 無料プランで十分です

### ステップ2：GitHubにファイルをアップロード
1. GitHubにログイン後、右上の「+」→「New repository」
2. Repository name: `mr-calendar-tool`
3. 「Public」を選択 → 「Create repository」
4. 「uploading an existing file」をクリック
5. このフォルダの中身を全部ドラッグ＆ドロップ
   ※ api フォルダごとドラッグしてください
6. 「Commit changes」をクリック

### ステップ3：Vercelにデプロイ
1. https://vercel.com にアクセス
2. 「Sign up」→「Continue with GitHub」でGitHubと連携
3. 「Add New Project」→ `mr-calendar-tool` を選択
4. 「Deploy」をクリック（1〜2分で完了）
5. 発行されたURL（例: mr-calendar-tool.vercel.app）をメモ

### ステップ4：環境変数を設定（APIキーをここに入れる）
Vercelのダッシュボードで：
1. プロジェクト → 「Settings」→「Environment Variables」
2. 以下の2つを追加：

| Name | Value |
|------|-------|
| ANTHROPIC_API_KEY | sk-ant-で始まるキー |
| GOOGLE_CLIENT_ID | xxxxxx.apps.googleusercontent.com |

3. 「Save」後、「Deployments」→「Redeploy」で反映

### ステップ5：Google OAuth設定
1. https://console.cloud.google.com にアクセス
2. 新しいプロジェクト作成（名前は何でも可）
3. 「APIとサービス」→「ライブラリ」→「Google Calendar API」を有効化
4. 「APIとサービス」→「認証情報」→「OAuthクライアントID」を作成
5. アプリの種類：「ウェブアプリケーション」
6. 承認済みのJavaScriptオリジンに追加：
   - https://mr-calendar-tool.vercel.app （あなたのVercel URL）
7. 承認済みのリダイレクトURIにも同じURLを追加
8. 作成されたクライアントIDをVercelの環境変数に貼り付け

## 使い方
1. ブラウザまたはスマホで VercelのURL を開く
2. 「Googleで連携」ボタンでカレンダーと接続
3. パンフレットのPDFまたは写真をドロップ
4. Claudeが日時・場所・講師を自動抽出
5. 内容を確認して「カレンダーに登録」

## 月額コスト目安
- Vercel：無料
- Google Calendar API：無料
- Anthropic API：月100枚処理で約200〜500円
