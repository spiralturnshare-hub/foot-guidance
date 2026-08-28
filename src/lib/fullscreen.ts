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
// ============================================================

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function isFullscreenActive(): boolean {
  const d = document as FsDocument;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

/** カメラ画面へ入るときに呼ぶ。全画面化 + 可能なら横向きロック。 */
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

  try {
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (orientation?.lock) await orientation.lock("landscape");
  } catch {
    // 横向きロック非対応(iOS 等)は無視。CameraView 側に縦向き警告オーバーレイがある。
  }
}

/** カメラ画面を抜けるときに呼ぶ。全画面解除 + 横向きロック解除。 */
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
  try {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  } catch {
    // 無視
  }
}
