# 足サイズ計測Webアプリ (spiral_turn_footcalc)

スマートフォンなどのブラウザから、A4用紙を用いた足の測定用写真を撮影し、SupabaseへデータをアップロードするためのWebアプリケーションです。主に **FlutterFlow製ネイティブアプリからのWebブラウザ/WebView連携** を前提として設計されています。

## 主な機能
- **ガイダンス機能**: 初めてのユーザーでも正しく撮影できる、ステップバイステップの画面および音声案内。
- **カメラ連携 (WebRTC)**: A4用紙の配置と足の位置を補助する、オーバーレイガイド付きのカメラ撮影機能。
- **Supabase バックエンド連携**: 撮影画像の Storage へのセキュアなアップロードと、`uploads_files` テーブルへのメタデータとユーザー情報の登録。
- **FlutterFlow アプリ統合**: URLクエリとフラグメントを通じたパラメーター（オーダーID等）およびセッショントークンの引き継ぎ機構。

## アクセスパターンと挙動

本アプリは、アクセス時のURLパラメータに応じて挙動が自動で切り替わります。

| パターン | 必須パラメータ等 | 挙動概要 |
| :--- | :--- | :--- |
| **FlutterFlowからの連携モード** | `?from=ff&orderid=...&userid=...&uploadid=...` | 撮影後、端末保存に加えて**Supabaseへのアップロード**が実行されます。完了後、元のアプリへの復帰を促す（またはWebViewに対し完了メッセージを送出する）よう動作します。 |
| **単独動作モード** | パラメータなし（通常アクセス） | 事前の動作確認用モード。撮影後、画像は**端末への保存のみ**行われます（クラウドアップロードはバイパスされます）。 |

## 技術スタック
- **フロントエンド**: Next.js (App Router), React
- **スタイリング**: Tailwind CSS
- **バックエンド/BaaS**: Supabase (PostgreSQL データベース, Storage, Authentication)
- **ホスティング/デプロイ**: Firebase Hosting (Next.js Static Exportとしてデプロイ)

## 開発環境の構築と実行

### 1. 依存関係のインストールと環境変数
```bash
npm install
```
プロジェクトルートに `.env.local` ファイルを作成し、Supabaseのプロジェクト情報を設定してください。
```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 2. 開発サーバーの起動
```bash
npm run dev
```
[http://localhost:3000](http://localhost:3000) でシステムを確認できます。

### 3. 静的エクスポート（ビルド）
Firebase Hostingへデプロイするためのビルドコマンドです。
```bash
npm run build
```
ビルドが完了すると、`out` ディレクトリに配信用静的ファイル一式が出力されます。

## 関連ドキュメント（docs/）

本プロジェクトをFlutterFlowアプリへ統合する際の手順や、テスト環境に関する詳細は以下のドキュメントを参照してください。

*   [FlutterFlow統合引き継ぎ書](./docs/flutterflow_integration_handover.md) : アプローチの選定条件と、Next.jsに渡すURLパラメータの技術仕様。
*   [サンプルFlutterFlowアプリについて](./docs/flutterflow_sample_app_info.md) : 動作検証用のテストアプリURL、連携時に推奨されるCustom Functionの実装コード、テストユーザー情報。

## ライセンス
このプロジェクトの新規作成コードの著作権は、支払い完了時に委託者へ移転します。
