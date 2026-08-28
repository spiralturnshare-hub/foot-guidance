// ============================================================
// カメラ画面を「ブラウザUI(アドレスバー/タブ帯)ごと隠して全画面表示」するための
// ユーティリティ。A4枠・足型・案内文字のオーバーレイは通常のDOMのままなので、
// 全画面化してもすべて維持される。
//
// 【設計方針 / 過去の失敗と対策 (2026-08-28)】
//   1回目の試み(CP2/CP2-fix)で A4 枠が極端に小さくなる回帰を出した。切り分けの結果、
//   原因は以下だったため、今回はそれらを一切使わない:
//     - NG: `screen.orientation.lock("landscape")`
//           → 表示だけ回転しカメラ映像は物理向きのまま → object-contain で黒帯 → 縮小。
//     - NG: globals.css の `html, body, #root { height: 100% }`
//           → iOS Safari で `position: fixed` の基準高さが短いビューポートに縮む → 縮小。
//     - NG: `<meta viewport ... viewport-fit=cover>`(safe-area 未対応のまま入れると危険)
//     - NG: `document.documentElement`(<html>) を全画面対象にする
//   OK: 全画面対象は「カメラのコンテナ <div>」に限定する。CSS の高さ連鎖は触らない。
//       ガイド寸法は window.innerWidth/innerHeight 基準で計算する(CameraView 側)。
//
//   効果の線引き:
//     - Android Chrome: 要素 requestFullscreen() でブラウザ chrome が完全に消える。◎
//     - iOS Safari    : 任意要素の Fullscreen API は非対応(<video>単体のみ)。ここは
//                       no-op になる。iOS で chrome を消すには「ホーム画面に追加」
//                       (PWA manifest / display:fullscreen)しかない。
//   必ずユーザー操作(クリック/タップ)ハンドラの同期的な延長で呼ぶこと。
// ============================================================

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export function isFullscreenActive(): boolean {
  const d = document as FsDocument;
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

/** カメラ画面へ入るときに呼ぶ。指定要素を全画面化するだけ(向きロック・CSS変更はしない)。 */
export async function enterFullscreen(el: HTMLElement | null): Promise<void> {
  if (!el || isFullscreenActive()) return;
  try {
    const target = el as FsElement;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
    }
  } catch (e) {
    // iOS Safari など未対応環境では毎回ここに来る。想定内なので警告のみ。
    console.warn("requestFullscreen 失敗(iOS Safari 等では想定内):", e);
  }
}

/** カメラ画面を抜けるときに呼ぶ。全画面解除。 */
export async function exitFullscreen(): Promise<void> {
  if (!isFullscreenActive()) return;
  try {
    const d = document as FsDocument;
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    // 無視
  }
}
