# Firebase Hosting へのデプロイ手順

本プロジェクトは Firebase Hosting を利用して静的ホスティングを行います。以下にその設定手順を記載します。

## 1. Firebase プロジェクトの作成・準備

1. [Firebase Console](https://console.firebase.google.com/) にアクセスします。
2. 「プロジェクトを追加」をクリックし、新しいプロジェクトを作成（または既存のプロジェクトを選択）します。

## 2. Firebase CLI のインストールとログイン

1. Firebase CLI がインストールされていない場合は、以下のコマンドでインストールします。
   ```bash
   npm install -g firebase-tools
   ```
2. Firebase にログインします。
   ```bash
   firebase login
   ```

## 3. 自動ビルド・デプロイの設定 (GitHub Actions)

本プロジェクトでは GitHub Actions を使用して、Firebase Hosting への自動デプロイが設定されています。

1. **サービスアカウントの作成**:
   - Google Cloud Console または Firebase Console で、Firebase Hosting へのデプロイ権限を持つサービスアカウントを作成します。
2. **GitHub Secrets の設定**:
   - リポジトリの `Settings > Secrets and variables > Actions` に以下の Secret を追加します。
     - `FIREBASE_SERVICE_ACCOUNT_SPIRAL_TURN_FOOTCALC`: 作成したサービスアカウントの JSON キー（または適切な形式）。
3. **ワークフロー**:
   - **プルリクエスト**: `main` ブランチへの PR が作成・更新されると、自動的にビルドチェックが行われ、プレビュー用の URL が発行されます。
   - **マージ**: `main` ブランチにマージされると、自動的にビルドが行われ、本番環境（Live チャンネル）へデプロイされます。

## 4. 手動でのビルドとデプロイ（必要な場合）

1. Next.js アプリケーションを静的エクスポート用にビルドします。
   ```bash
   npm run build
   ```
   ※ `out` ディレクトリが生成されます。

2. Firebase Hosting にデプロイします。
   ```bash
   # 事前に firebase login およびプロジェクトの選択が必要です
   firebase deploy --only hosting
   ```

## 5. 環境変数の扱い

静的エクスポート（Static Export）の場合、環境変数はビルド時に埋め込まれます。
`.env.local` やビルド環境の環境変数が反映されます。クライアントサイドで必要な `NEXT_PUBLIC_` プレフィックスのついた変数が正しく設定されていることを確認してください。

## 6. 旧 GitHub Pages の停止（必要な場合）

1. GitHub リポジトリの `Settings` > `Pages` を開きます。
2. `Build and deployment` > `Source` を `GitHub Actions` から `None` または `Deploy from a branch` に戻し、デプロイを停止します。
