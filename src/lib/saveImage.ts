// ============================================================
// 撮影画像を利用者の端末に保存させるユーティリティ。
//
// 【過去の失敗と対策 (2026-08-28)】
//   従来は <a download> をプログラムからクリックするだけだった。これは:
//     - iOS Safari が download 属性を無視し、blob URL へその場で画面遷移してしまう。
//       直後に GuidancePage が window.close() を呼ぶため、結局ファイルは保存されない
//       (=「撮影しても撮影端末にダウンロードされない」の主因)。
//     - Android でも保存先は「ダウンロード」フォルダで、写真アプリ(ギャラリー)には出ない。
//   → モバイルでは Web Share API Level 2 (navigator.share({files})) を第一手にする。
//     iOS/Android とも OS の共有シートが開き「画像を保存 / 写真に追加」を選べる。
//     files 共有に非対応の環境(デスクトップ等)は従来の <a download> にフォールバックする。
//   呼び出し側(handleSubmit)は必ずこの Promise を await してから window.close() すること。
// ============================================================

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * @param blob     保存する画像(注文番号・日時を焼き込み済みのもの)
 * @param filename 保存ファイル名 (例: "foot_ORDER-123_2026-08-28....jpg")
 */
export async function saveImageToDevice(blob: Blob, filename: string): Promise<SaveResult> {
    const type = blob.type || 'image/jpeg';
    const file = new File([blob], filename, { type });

    // 1) Web Share API (files 共有に対応している場合のみ)
    const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
    };
    if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
    ) {
        try {
            await nav.share({ files: [file], title: filename });
            return 'shared';
        } catch (e) {
            // 共有シートをユーザーが閉じた場合は AbortError。これは失敗ではない。
            if (e instanceof DOMException && e.name === 'AbortError') {
                return 'cancelled';
            }
            // それ以外(NotAllowedError 等)は <a download> にフォールバック
            console.warn('navigator.share に失敗。ダウンロードにフォールバックします:', e);
        }
    }

    // 2) <a download> フォールバック
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // 即時 revoke するとダウンロードが中断される端末があるため遅延させる
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        return 'downloaded';
    } catch (e) {
        console.error('端末への保存(ダウンロード)に失敗しました:', e);
        return 'failed';
    }
}
