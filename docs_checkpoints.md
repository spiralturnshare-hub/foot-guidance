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
