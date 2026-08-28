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
- コミット: `2870d76`("fix: カメラガイド(A4枠/足型)が極端に縮小する回帰を修正")
- 症状(冨永社長報告): `032752d` デプロイ後、カメラは全画面になったが A4 の点線枠・足型ガイドが極端に小さくなり撮影不能。
- 原因: D で追加した `screen.orientation.lock("landscape")` が「表示の向き」だけを強制回転させる一方、`getUserMedia` のカメラ映像は「物理デバイスの向き」に従う。端末を縦に持ったまま起動すると縦長映像を横長コンテナに `object-contain` 表示 → 左右に大きな黒帯 → `CameraView` の `videoRect.width` が 1/2〜1/3 に縮小。ガイド寸法は全て `videoRect.width` 基準(`sc = videoRect.width * 0.28 / 297`)のため、A4枠・足型が同率で縮む。
- 修正:
  - `src/lib/fullscreen.ts`: `screen.orientation.lock/unlock` を撤去。全画面化(`requestFullscreen`)のみ残す(全画面は A4 のピクセル数を増やす=計測誤差減で望ましい)。向きは変更前と同じく利用者が物理的に横向きにする(縦向き警告オーバーレイで誘導)。
  - `src/components/Camera/CameraView.tsx`: `fullscreenchange`/`webkitfullscreenchange` で `updateVideoRect()` を遷移後(150ms/450ms)に測り直すハンドラを追加。遷移中の中途半端なサイズで固定されるのを防ぐ。
- 戻し方: 同上(CP1 を Promote、または `git reset --hard 032752d`)。

### CP2-fix2 (2026-08-28 D=全画面化 を全撤回。A4枠がまだ小さい問題の切り分け・A案 Step1)
- コミット: `f14ed4c`("revert: D(カメラ全画面化)を全撤回 — A4枠が小さい問題の切り分け(A案 Step1)")
- 症状(冨永社長報告・スクショ): CP2-fix(`2870d76`)後も iPhone(15 Plus 横向き)で A4 点線枠・足型ガイドが映像幅の 7〜8% しかなく撮影不能。本来は「映像幅の 28%」(`sc = videoRect.width * 0.28 / 297`, `a4W = videoRect.width * 0.28`)。
- 調査結果: ガイド寸法計算(`CameraView.tsx` の `updateVideoRect` / `videoRect.width * 0.28`)と `<video>` のコンテナ構造(`fixed inset-0 h-[100dvh]` > `w-full h-full object-contain`)は **初回コミット `503e339` から一度も変わっていない**。Vite 移行(`8a03a92`)も CP2 も、この部分の差分ゼロ。
- 有力仮説(未確定): モバイル Safari で `<video className="w-full h-full">` の `height:100%` が親(`position:fixed` + `inset-0` + `h-[100dvh]`)に対して解決されず、`<video>` が中途半端な高さに潰れて `getBoundingClientRect()` 計測 → ガイド縮小。`503e339` から存在する潜在バグで、FlutterFlow WebView / Manus プレビューでは % 高さが解決されるため表面化せず、CP1(別セッション、`?from=upload-center` 追加)で初めて「普通のモバイル Safari タブ」で開かれて露呈した可能性。
- 本 CP の対応(A案 Step1 = 切り分け): 私(Claude)が CP2/CP2-fix で入れた **D(全画面化)関連の変更をすべて撤回**し、アップロード系の A/B/C は残す。
  - 削除: `src/lib/fullscreen.ts`, `public/manifest.webmanifest`
  - `4d90d79` の状態に戻す: `src/components/Camera/CameraView.tsx`(fullscreen 呼び出し・`fullscreenchange` リスナー除去), `src/app/globals.css`(`#root {height:100%}` と `:fullscreen` を除去), `index.html`(`viewport-fit=cover` / PWA manifest / apple-touch メタ / landscape-warning の body 移動 を撤回)
  - `src/pages/GuidancePage.tsx`: `enterFullscreen/exitFullscreen` の import と呼び出しのみ除去。A(モード判定)/B(セッション await・`supabase` 静的 import)/C(`saveImageToDevice` の Web Share 化・`handleCapture` 事前焼き込み)は維持。
- 期待: この後デプロイして実機確認 → A4 枠が使えるサイズに戻れば「D が主因」。戻らなければ潜在バグ確定 → Step2(`updateVideoRect` をビューポート実寸基準に書き換え)へ。
- 戻し方: Vercel Deployments で CP1(`foot-guidance-4hzhoafb6`)を Promote、または `git reset --hard 4d90d79`。

### CP2-fix3 (2026-08-28 A案 Step2: 原因を避けて全画面化を再導入)
- コミット: `c136937`("feat: A案 Step2 — 縮小原因を避けてカメラ全画面化を再導入")
- 前提: CP2-fix2(`f14ed4c`)デプロイ後、冨永社長確認で **A4枠・足型は正しいサイズに戻った**。
  → A4枠が縮んだ主因は私の D 変更(特に `globals.css` の `html, body, #root { height: 100% }`。
     iOS Safari で `html` に明示高さを与えると `position: fixed` の基準高さがツールバー表示時の
     短いビューポートに縮み、その短い値でガイド寸法が計算され固定されていた)と確定。
  → ただし本来の要望(カメラが画面いっぱいにならない・上にブラウザのタブ帯が残る)は未解決。
- 対応: 縮小の原因(`orientation.lock` / `html,body,#root{height:100%}` / `viewport-fit=cover` /
  `<html>` を全画面対象にする)を **一切使わずに** 全画面化を再導入:
  - `src/components/Camera/CameraView.tsx`:
    - `updateVideoRect()` のコンテナ実寸を `video.getBoundingClientRect()` →
      **`window.innerWidth / window.innerHeight`** に変更。`<video>` の描画状態に依存しないため
      「潰れた瞬間を掴んで固定」事故が原理的に起きない。これが Step2 の本丸。
    - `fullscreenchange`/`webkitfullscreenchange` + マウント直後に、ディレイ付き(150/400/800ms)で
      `updateVideoRect()` を測り直し、確定値に収束させる。
    - ルート `<div>` に `rootRef` を付け、カメラ画面内の最初のタップ(`handleNextStep`)で
      `enterFullscreen(rootRef.current)` を要求。対象は `<html>` ではなくこの div に限定。
    - アンマウント時に `exitFullscreen()`。
  - `src/lib/fullscreen.ts`(新規・簡素版): 指定要素の `requestFullscreen()` のみ。向きロックなし、
    CSS 変更なし。iOS Safari は非対応で no-op。
  - `index.html`: PWA manifest / apple-mobile-web-app 系メタを再追加(**`viewport-fit=cover` は入れない**)。
    通常タブでは無変化。「ホーム画面に追加」した時だけ iOS でも chrome レス起動できる導線。
  - `public/manifest.webmanifest`(新規再追加): `display:"fullscreen"` / `orientation:"landscape"`。
  - `src/app/globals.css` / `src/pages/GuidancePage.tsx`: **変更なし**(CP2-fix2 の状態を維持)。
- 効果の線引き: Android Chrome = ブラウザ chrome が消えて真の全画面 ◎ / iOS Safari(通常タブ)=
  Fullscreen API 非対応のため chrome は残る(スクロールで最小化のみ)。iOS で完全 chrome レスに
  するには「ホーム画面に追加」。どちらの場合も **ガイド寸法は `window.innerWidth/innerHeight`
  基準なので縮小は起きない**。
- 戻し方: `git reset --hard f14ed4c`(= CP2-fix2)、または Vercel で CP2-fix2 のデプロイを Promote。

### CP2-fix4 (2026-08-28 iPhone 通常タブでの chrome 非表示を再現。`viewport-fit=cover` + `height:100%` を復活)
- コミット: `<push後に記録>`
- 経緯: 冨永社長より「以前(Next.js版)は URL 単発で iPhone でも全画面だった。CP2-fix3 では chrome が
  残る」との指摘。旧 `503e339` ツリーを全検査した結果、旧版に全画面化コードは一切無し(manifest/API/
  scroll hack/meta すべて無し)。ただし **この会話内の CP2-fix(`2870d76`)ビルドの iPhone スクショ
  では Safari の chrome が写っていなかった**。そのビルドとの差分は `viewport-fit=cover` と
  `html,body,#root{height:100%}` の有無のみ。CP2-fix でそれを外した理由は「A4枠が縮む」副作用だが、
  その副作用の根本原因(ガイド寸法が潰れる `<video>` の実測依存)は CP2-fix3 で別途解消済み。
  → よって「chrome を消す設定」と「A4枠が縮む」は分離できたので、前者だけ復活させる。
- 変更:
  - `src/app/globals.css`: `html, body, #root { height: 100% }` を復活。`body { min-height: calc(100% + 1px) }`
    を追加(scrollTo(0,1) 用の 1px スクロール余地)。
  - `index.html`: viewport meta に `viewport-fit=cover` を復活。
  - `src/components/Camera/CameraView.tsx`:
    - `updateVideoRect()` のコンテナ実寸を `window.innerWidth/innerHeight` →
      **`window.visualViewport?.width/height`(fallback: innerW/H)** に変更。visualViewport は
      Safari のツールバー/タブ帯の開閉で即座にサイズが変わるため、chrome が引っ込めば A4枠も
      自動で最適サイズに広がる(縮んだままにならない核心)。
    - `visualViewport` の `resize`/`scroll` を再計測トリガーに追加。
    - 別 `useEffect` で `window.scrollTo(0,1)` を初期・遅延(200/600/1200/2000ms)・`touchend` 後に
      繰り返しナッジし、iOS Safari のツールバー格納を能動的に誘発。
    - 撮影ボタン / 音声トグル / 右コントロール列に `env(safe-area-inset-*)` を付与
      (`viewport-fit=cover` でノッチ/ホームバーに被らないように)。
- 期待: iPhone 横向き・通常タブで、CP2-fix と同様に Safari の chrome がほぼ消え、かつ A4枠は
  正しいサイズを維持(visualViewport 追従のため)。Android は Fullscreen API で従来どおり真の全画面。
- 未確定: iOS のバージョン/設定(「タブバーを表示」等)によってはタブ帯が残る可能性。その場合の
  確実解は「ホーム画面に追加」(manifest 設置済み)。
- 戻し方: `git reset --hard c136937`(= CP2-fix3)、または Vercel で CP2-fix3 のデプロイを Promote。

---

## DB migration 010(RLS 硬化)適用 2026-08-28 — コード変更なし

`spiralturn-green-integration/supabase/migrations/010_rls_hardening.sql` を Green Supabase に適用(冨永社長が SQL Editor で実行・検証済み)。foot-guidance への影響:

- `uploads_files` / Storage `upsys` の緩い INSERT(`true` / anon)を全削除。foot-guidance は upload-center から `postMessage` でセッション注入 = **authenticated**。撮影画像の書き込みは `uploads_files_insert_own`(`upload_id → uploads.user_id → users.auth_user_id = auth.uid()`)と `allow authenticated upload to upsys` を通る。
- 注入されたセッションが正しく `authenticated` になっていること、対象 `upload_id` の `uploads.user_id` が撮影者本人の `users.id` であることが前提。どちらか外れると書き込みが RLS で弾かれる。
- 実機確認(未): upload-center から起動 → 撮影 → upload-center に戻ってファイルが反映されるか。壊れたら 010 末尾のロールバック SQL。
