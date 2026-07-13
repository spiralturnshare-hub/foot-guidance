# 統合・デプロイ計画書

本ドキュメントは、本アプリケーションの Firebase Hosting へのデプロイ、および FlutterFlow との統合、Supabase を利用したデータ管理に関する詳細な手順と仕様をまとめたものです。

## 1. デプロイ構成
- **プラットフォーム**: Firebase Hosting
- **ビルド設定**: Next.js (Static Export)

## 2. FlutterFlow との連携フロー

### アクセス経路
1. **FlutterFlow アプリ**: Supabase Auth で認証済みの状態で、WebView を介して本アプリの「FF用エンドポイント」にアクセスします。
2. **パラメータと認証情報の伝達**: 
   - **URL パラメータ（クエリ）**: 必要なコンテキスト情報（`orderid`, `name`, `from=ff` 等）を渡します。
   - **URL フラグメント（ハッシュ）**: Supabase の認証状態を引き継ぐため、`access_token` と `refresh_token` を渡します。
   - URL構成例: `https://[Next.jsアプリドメイン]/upload?orderid=123&from=ff#access_token=[TOKEN]&refresh_token=[TOKEN]`

### 本アプリ（Next.js）側の動作（FFモード）
1. `from=ff` パラメータを検知し、FFモードで動作します。
2. **セッションの復元と秘匿化**: ページマウント時に URL フラグメントからトークンを抽出し、Supabase クライアントにセッション（ログイン状態）をセットします。漏洩防止のため、取得直後に `window.history.replaceState` を用いてブラウザの URL からトークン部分を即座に消去します。
3. **完了通知**: 撮影およびデータ処理（Storage/DBへのアップロード）が完了した際、以下の JavaScript を実行して FlutterFlow に完了を通知します。
   ```javascript
   if (window.ff_webview_handler) {
     window.ff_webview_handler.postMessage("データ（JSON文字列等）");
   }

### FlutterFlow 側の動作
1. **JavaScript Channel**: `ff_webview_handler` を登録しておき、メッセージを受信します。
2. **アクション**: 受信したデータに基づき、次のページへの遷移やバックエンド処理を実行します。

## 3. セキュリティと認証管理

### Supabase Functions の活用
Auth 情報や API キーなど、セキュリティ上クライアントサイドで直接管理すべきでない情報は、**Supabase Edge Functions** に保持させます。
- **秘匿情報の管理**: `supabase secrets set` を使用して環境変数を管理します。
- **関数の役割**:
  - 署名付きURLの発行
  - 認証トークンの検証
  - 外部サービス（Gemini等）へのセキュアなリクエスト

## 4. データベース仕様 (Supabase)

### テーブル名: `uploads_files`

| 列名 | データ型 | Null許容 | デフォルト値 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | NO | `gen_random_uuid()` |
| `created_at` | timestamp with time zone | NO | `now()` |
| `updated_at` | timestamp with time zone | NO | NULL |
| `order_id` | uuid | NO | NULL |
| `upload_id` | uuid | NO | NULL |
| `user_id` | uuid | NO | NULL |
| `status` | text | NO | `'draft'::text` |
| `file_type` | text | NO | NULL |
| `kind` | text | NO | NULL |
| `url` | text | YES | NULL |
| `index` | bigint | YES | NULL |

### RLS (Row Level Security) ポリシー

| ポリシー名 | コマンド | ロール | 条件 (qual) | チェック (with_check) |
| :--- | :--- | :--- | :--- | :--- |
| `enable_insert_for_users_based_on_user_id` | INSERT | authenticated | NULL | `(auth.uid() = user_id)` |
| `enable_update_for_users_based_on_user_id` | UPDATE | authenticated | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `enable_users_to_view_their_own_data_only` | SELECT | authenticated | `(auth.uid() = user_id)` | NULL |
| `full_access_on_all_data_for_admins` | ALL | authenticated | `is_admin(auth.uid())` | `is_admin(auth.uid())` |
| `full_access_on_all_data_for_analysers` | ALL | authenticated | `is_analyser(auth.uid())` | `is_analyser(auth.uid())` |

### 制約 (Constraints)
- `uploads_files_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES ordering_information(id)`
- `uploads_files_pkey`: `PRIMARY KEY (id)`
- `uploads_files_upload_id_fkey`: `FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE`
- `uploads_files_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES users(id)`

## 5. ストレージ仕様 (Supabase Storage)

- **バケット名**: `upsys`
- **アップロードパス構成**:
  `{User ID}/(debug mode ? /dev/ : /live/){upload id}/{kind}/{uploadFile id}/[ファイル名].jpg`

## 6. 詳細手順

※ Supabase (Table/Storage) および FlutterFlow アプリは構築済みのものを利用します。

1. **環境の確認**:
   - 既存の `uploads_files` テーブルおよび RLS ポリシーが上記仕様に準拠しているか確認。
   - Supabase Storage の `upsys` バケットが利用可能であることを確認。
2. **Next.js アプリの改修**:
   - URLフラグメント（`#access_token=...`）の解析と、Supabase Client SDK へのセッションセット処理、および実行後の URL クリーンアップ処理の実装。
   - 復元したセッション（認証情報）を利用した DB/Storage へのアップロードロジックの構築。
   - FlutterFlow への `postMessage` による完了通知処理の実装。
3. **Firebase Hosting 設定**:
   - Firebase CLI を使用して Hosting を初期化し、ビルド成果物（`out` ディレクトリ）をデプロイするように設定します。
   - Supabase への接続情報（URL, Anon Key）等はビルド時の環境変数として設定します。
4. **FlutterFlow 統合**:
   - 既存アプリ内の WebView Widget にて、現在の Supabase セッションから取得した Access / Refresh トークンを URL フラグメントとして結合し、動的にロード URL を生成する処理を実装。
   - 既存の JavaScript Channel `ff_webview_handler` の動作確認。
