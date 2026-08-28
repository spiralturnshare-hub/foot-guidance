// ============================================================
// カメラ画面を「ブラウザUI(アドレスバー/タブ帯)ごと隠して全画面表示」するための
// ユーティリティ。A4枠・足型・案内文字などのオーバーレイは通常のDOMのままなので、
// 全画面化してもすべて維持される。
//
// 【背景 / なぜ必要か (2026-08-28)】
//   foot-guidance は upload-center から window.open(url, "_blank") で「普通のブラウザ
//   タブ」として開かれる。通常の Web ページはアドレスバー/タブ帯を自力で消せないため、
//   開発時のプレビュー環境(chrome の無い WebView 等)と違って実機では画面いっぱいに
//   ならない。これは言語/フレームワークの問題ではなく、表示コンテキストの違い。
//   全画面にする唯一の方法が Fullscreen API。
//     - Android Chrome: 要素 requestFullscreen() でブラウザ chrome が完全に消える。◎
//     - iOS Safari    : 任意要素の Fullscreen API は非対応(<video>単体のみ許可)。
//                       → 失敗しても例外を握りつぶし、CSS(100dvh + viewport-fit=cover)
//                         で可能な範囲の最大化に留める。iOS で完全 chrome レスにするには
//                         「ホーム画面に追加」(PWA manifest / display:fullscreen)が必要。
//   必ずユーザー操作(クリック/タップ)ハンドラの同期的な延長で呼ぶこと。
//
// 【過去の失敗と対策 (2026-08-28 その2)】
//   当初この enter で screen.orientation.lock("landscape") も呼んでいたが撤去した。
//   理由: 向きロックは「表示の向き」だけを強制回転させるが、getUserMedia のカメラ
//   映像は「物理デバイスの向き」に従う。端末を縦に持ったままカメラ起動すると、
//   縦長の映像を横長コンテナに object-contain 表示することになり、左右に巨大な黒帯が
//   入って CameraView の videoRect.width が 1/2〜1/3 に縮む。CameraView は A4枠・足型の
//   寸法をすべて videoRect.width 基準で計算しているため、ガイド全体が極端に小さくなり
//   撮影不能になった(冨永社長報告)。
//   → 向きは変更前と同じく「利用者が物理的に横向きにする(縦向き警告オーバーレイで誘導)」
//     に戻す。これで映像の向きと表示の向きが一致し、ガイドが最適サイズに戻る。
//     全画面化(requestFullscreen)自体は A4 のピクセル数を増やす=計測誤差を減らす方向
//     なので維持する。
// ============================================================

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

function isFullscreenActive(): boolean {
  const d = document as FsDocument;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

/** カメラ画面へ入るときに呼ぶ。全画面化のみ(向きロックはしない — 上記コメント参照)。 */
export async function enterFullscreen(el: HTMLElement = document.documentElement): Promise<void> {
  try {
    if (!isFullscreenActive()) {
      const target = el as FsElement;
      if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      }
    }
  } catch (e) {
    // iOS Safari など未対応環境では毎回ここに来る。想定内なので警告のみ。
    console.warn("requestFullscreen 失敗(iOS Safari 等では想定内):", e);
  }
}

/** カメラ画面を抜けるときに呼ぶ。全画面解除。 */
export async function exitFullscreen(): Promise<void> {
  try {
    const d = document as FsDocument;
    if (isFullscreenActive()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    }
  } catch {
    // 無視
  }
}
