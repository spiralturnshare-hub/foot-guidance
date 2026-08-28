# デプロイ・チェックポイント記録(foot-guidance)

Manusのデータが失われているため、GitHub/Vercelに現在ある状態が「唯一の正」。以後、UIに変更を加える前に必ずこの記録の一番下に新しいチェックポイントを追記してから作業する。壊れた場合はここに書かれたコミット/URLに戻せる。

## 戻し方

```
git log --oneline
git reset --hard <コミットhash>    # 要事前確認・複数回許可
git push --force-with-lease        # 要事前確認・複数回許可
```
または Vercelダッシュボード → foot-guidance → Deployments → 戻したいデプロイの「...」→「Promote to Production」。

## このリポジトリの構成メモ

- **Vite + React SPA**(commit `8a03a92` で Next.js から移行済み)。`src/App.tsx` / `src/main.tsx` / `src/pages/*` が本体。
- `src/app/*`・`next.config.ts` は移行前の Next.js の残骸(App.tsx から未参照。`vite build` は無視するが `tsc -b` の対象には入る)。
- Vercel の Dashboard 設定は「Next.js / out」のままだが、リポジトリ直下の **`vercel.json`** が `framework: vite` / `outputDirectory: dist` / `buildCommand: npm run build`(= `tsc -b && vite build`)/ `installCommand: npm install --legacy-peer-deps` で上書きしている。**tsc がビルドに含まれる**ので型エラーはデプロイを壊す。
- 公開URL: `https://foot-guidance.vercel.app`(Vercel保護なし)。

---

## チェックポイント一覧

### CP0 (2026-08-27 upload-center連携の実装着手前)
- コミット: `8a03a92`("feat: Next.js→Vite+React SPA移行")
- Vercel Production: `foot-guidance-ojeetqx4l`(公開URL `https://foot-guidance.vercel.app`)
- 内容: このセッションでの変更着手前のベースライン。URLパラメータ or FlutterFlow webview からコンテキストを受け取り、音声ガイダンス→カメラ撮影→端末保存(+`from=ff`のときのみ Green Storage アップロード)する状態。

### CP1 (2026-08-27 upload-center連携モードと画像焼き込みを追加)
- コミット: `9d61af2`("feat: upload-center連携モード + 撮影画像への注文番号/日時焼き込み")
- Vercel Production: `foot-guidance-4hzhoafb6`(公開URL `https://foot-guidance.vercel.app`)
- 内容(docs/17「アップロード完全音声化ビジョン」の第一歩・フェーズ1):
  - `GuidancePage.tsx`: `?from=upload-center` モードを追加。`orderid`/`ordername`/`uploadid`/`userid` + URLハッシュの Supabase セッションを受け取り auth 画面をスキップ。撮影完了時に「焼き込み画像を端末ダウンロード + `uploadImage` で Green Storage/`uploads_files` へアップロード + `window.opener.postMessage({source:'foot-guidance',status:'uploaded',uploadId,orderId,kind:'foot'}, origin)` + `window.close()`」。`from=ff` の既存挙動は維持。
  - `src/lib/annotateImage.ts`(新規): canvas で撮影画像下部に半透明帯を敷き「注文番号」「撮影日時」をピクセルとして焼き込む。失敗時は元画像。
  - `src/lib/api.ts` `uploadImage`: 第5引数 `filenameBase` を追加(注文番号入りファイル名を渡せる)。`mime_type`/`file_size` も記録。
- RLS 確認済み(`supabase/queries/foot_guidance_upload_rls_check.sql`): `uploads_files` INSERT / `upsys` Storage upload / 読み戻し SELECT はいずれも authenticated セッションで通る。
- 既知の割り切り(MVP): 再撮影時の旧 foot 行 `is_current=false` 化はしない(新規行を足すのみ)。靴・動画・厚紙A4モードは将来(docs/12)。
- ⚠️ セキュリティ: `uploads_files`/`upsys` の INSERT が anon でも `check: true` で通る緩い状態。Blue 本番昇格前に自分の upload_id/user_id に限定する形へ要修正(docs 記録済み)。
- 戻し方: Vercel Deployments で CP0(`foot-guidance-ojeetqx4l`)を Promote to Production。

### CP2 (2026-08-28 upload-center連携の3不具合修正 + カメラ全画面化)
- 着手前ベースライン コミット: `4d90d79`("docs: CP1のhash/デプロイ先を確定")
- 実装後 コミット: `032752d`("fix: upload-center連携の3不具合修正(顧客ID画面スキップ/自動アップロード/端末保存)+カメラ全画面化")
- Vercel Production: 着手前は CP1と同じ(`foot-guidance-4hzhoafb6` / 公開URL `https://foot-guidance.vercel.app`)。本コミットのデプロイは push 後に Vercel が自動作成。
- 戻し方: Vercel Deployments で CP1(`foot-guidance-4hzhoafb6`)を Promote to Production、または `git reset --hard 4d90d79`(要複数回許可)。
- 冨永社長からの指示で以下を修正(別セッションが customer-mgmt-console を並行修正中。本作業は foot-guidance のクライアントコードのみで完結し、DBスキーマ変更・マイグレーションは行わない。`production_workflows`/`foot_measurements`/改訂履歴RPC には触れない):
  - **A. 顧客ID要求画面が最初に出る**: `GuidancePage.tsx` の初期モード判定が `isFromUploadCenter && !!orderId && !!uploadId` で、orderId 未設定(ゲスト/未決済フロー)だと auth 入力フォームが表示されてしまう。`uploadId` があれば撮影ガイダンスへ直行するよう緩和する。
  - **B. 自動アップロードされない**: `src/lib/supabase.ts` が `import.meta.env.VITE_SUPABASE_*` のフォールバック無し(`|| ''`)。Vercel env 未設定だと全アップロードが即失敗する。foot-measure と同様に Green の URL/anon key を定数フォールバックとして持たせる。あわせてセッション復元を await 化し、失敗理由を画面に具体表示する。
  - **C. 撮影端末にダウンロードされない**: `saveImageToDevice` の `<a download>` 方式は iOS Safari が無視し、直後の `window.close()` と競合する。モバイルは `navigator.share({files})` に切替、非対応/PCは従来方式。保存完了を待ってから閉じる。
  - **D. カメラ全画面化**: Fullscreen API + `viewport-fit=cover`/`100dvh` + PWA manifest。A4枠・足型・案内文字のオーバーレイは現状の `videoRect` 基準描画のまま完全維持。
- 戻し方: Vercel Deployments で CP1(`foot-guidance-4hzhoafb6`)を Promote to Production。

### CP2-fix (2026-08-28 D の回帰修正: A4枠が極端に縮小する問題)
- コミット: `<push後に記録>`
- 症状(冨永社長報告): `032752d` デプロイ後、カメラは全画面になったが A4 の点線枠・足型ガイドが極端に小さくなり撮影不能。
- 原因: D で追加した `screen.orientation.lock("landscape")` が「表示の向き」だけを強制回転させる一方、`getUserMedia` のカメラ映像は「物理デバイスの向き」に従う。端末を縦に持ったまま起動すると縦長映像を横長コンテナに `object-contain` 表示 → 左右に大きな黒帯 → `CameraView` の `videoRect.width` が 1/2〜1/3 に縮小。ガイド寸法は全て `videoRect.width` 基準(`sc = videoRect.width * 0.28 / 297`)のため、A4枠・足型が同率で縮む。
- 修正:
  - `src/lib/fullscreen.ts`: `screen.orientation.lock/unlock` を撤去。全画面化(`requestFullscreen`)のみ残す(全画面は A4 のピクセル数を増やす=計測誤差減で望ましい)。向きは変更前と同じく利用者が物理的に横向きにする(縦向き警告オーバーレイで誘導)。
  - `src/components/Camera/CameraView.tsx`: `fullscreenchange`/`webkitfullscreenchange` で `updateVideoRect()` を遷移後(150ms/450ms)に測り直すハンドラを追加。遷移中の中途半端なサイズで固定されるのを防ぐ。
- 戻し方: 同上(CP1 を Promote、または `git reset --hard 032752d`)。
