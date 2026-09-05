// ============================================================
// 撮影画像を利用者の端末に保存させるユーティリティ。
//
// 【過去の失敗と対策 (2026-08-28)】
//   従来は <a download> をプログラムからクリックするだけだった。これは:
//     - iOS Safari が download 属性を無視し、blob URL へその場で画面遷移してしまう。
//       直後に GuidancePage が window.close() を呼ぶため、結局ファイルは保存されない
//       (=「撮影しても撮影端末にダウンロードされない」の主因)。
//   → モバイルでは Web Share API Level 2 (navigator.share({files})) を第一手にする。
//     OS の共有シートが開き「画像を保存 / 写真に追加」を選べる。
//
// 【2026-09-05 追記(冨永社長指示): プラットフォーム別に方式を分岐】
//   iOS Safari は WebKit の仕様上、Web ページからの「ワンタップ・無操作での自動保存」
//   ができない(セキュリティ上の意図的な制限。2026年時点でも未解決 - bugs.webkit.org
//   #167341)。iOS は navigator.share(共有シート)が最善で、これは変えられない。
//   一方 Android/デスクトップは <a download> が「ダウンロードフォルダへワンタップで
//   無操作保存」でき、共有シートより手数が少なく分かりやすい。
//   → iOS だけ navigator.share、それ以外(Android/デスクトップ)は <a download> を
//     優先する(従来は全プラットフォームで share を先に試していた)。
// ============================================================

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

export function isIOS(): boolean {
    const ua = navigator.userAgent;
    // iPadOS 13+ は Mac として名乗るため、タッチ対応の Macintosh も iOS 扱いにする
    return /iPad|iPhone|iPod/.test(ua) ||
        (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function downloadViaAnchor(blob: Blob, filename: string): SaveResult {
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

async function shareViaWebShare(blob: Blob, filename: string, type: string): Promise<SaveResult | null> {
    const file = new File([blob], filename, { type });
    const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
    };
    if (
        typeof nav.share !== 'function' ||
        typeof nav.canShare !== 'function' ||
        !nav.canShare({ files: [file] })
    ) {
        return null; // 非対応。呼び出し側で <a download> にフォールバック
    }
    try {
        await nav.share({ files: [file], title: filename });
        return 'shared';
    } catch (e) {
        // 共有シートをユーザーが閉じた場合は AbortError。これは失敗ではない。
        if (e instanceof DOMException && e.name === 'AbortError') {
            return 'cancelled';
        }
        console.warn('navigator.share に失敗。ダウンロードにフォールバックします:', e);
        return null;
    }
}

/**
 * @param blob     保存する画像(注文番号・日時を焼き込み済みのもの)
 * @param filename 保存ファイル名 (例: "foot_ORDER-123_2026-08-28....jpg")
 */
export async function saveImageToDevice(blob: Blob, filename: string): Promise<SaveResult> {
    const type = blob.type || 'image/jpeg';

    if (isIOS()) {
        // iOS: 共有シートが唯一の現実的な保存経路。失敗時のみ <a download> を試す
        // (多くは同じくブロックされ画面遷移するだけだが、最後の保険として残す)。
        const shared = await shareViaWebShare(blob, filename, type);
        if (shared) return shared;
        return downloadViaAnchor(blob, filename);
    }

    // Android / デスクトップ: <a download> の方が手数が少なく無操作で保存できるため優先。
    const downloaded = downloadViaAnchor(blob, filename);
    if (downloaded === 'downloaded') return downloaded;
    // 何らかの理由で <a download> が失敗した環境向けのフォールバック
    const shared = await shareViaWebShare(blob, filename, type);
    return shared ?? downloaded;
}
