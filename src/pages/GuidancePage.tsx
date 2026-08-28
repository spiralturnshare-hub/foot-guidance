import { useState, useEffect, useRef } from "react";
import StepWizard from "@/components/Guidance/StepWizard";
import CameraView from "@/components/Camera/CameraView";
import PreviewModal from "@/components/Review/PreviewModal";
import { uploadImage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { saveImageToDevice } from "@/lib/saveImage";
import { annotateImage } from "@/lib/annotateImage";
import { enterFullscreen, exitFullscreen } from "@/lib/fullscreen";

// 撮影日時を "YYYY-MM-DD HH:mm"(ローカル時刻)で返す
function formatNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function GuidancePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const isFromFF = searchParams.get("from") === "ff";
  // upload-center から「かんたん撮影アプリを起動」ボタンで開かれたモード。
  // 撮影→焼き込み→アップロード→端末ダウンロード→呼び出し元へ postMessage→自動クローズ。
  const isFromUploadCenter = searchParams.get("from") === "upload-center";
  const isEmbedded = isFromFF || isFromUploadCenter;

  const [orderId, setOrderId] = useState(searchParams.get("orderid") || "");
  const [userName, setUserName] = useState(searchParams.get("name") || "");
  const [userId] = useState(searchParams.get("userid") || searchParams.get("userId") || "");
  const [uploadId] = useState(searchParams.get("uploadid") || searchParams.get("upload_id") || "");
  // 画像に焼き込む注文番号(注文名)。無ければ orderId を使う。
  const orderLabel = searchParams.get("ordername") || searchParams.get("orderName") || orderId;
  // postMessage の宛先オリジン(upload-center 側が自分の origin を渡す)
  const returnOrigin = searchParams.get("origin") || "";

  // auth 画面(オーダーID+名前の手入力フォーム)を出すかどうかの判定。
  // ここで "guidance" を初期値にできれば、顧客に情報を打たせず撮影ガイダンスへ直行する。
  //  - FF WebView 経由(from=ff): 常にスキップ。FF 側が顧客コンテキストを保証する。
  //  - upload-center 経由(from=upload-center): uploadId さえ渡っていればスキップする。
  //    【過去の失敗と対策 (2026-08-28)】以前は orderId も必須(&& !!orderId)にしていたため、
  //    ゲスト/未決済フローで upload-center 側の orderId が空のとき、顧客に不要な
  //    「オーダーID入力画面」が表示されていた。アップロードは uploadId さえあれば
  //    api.ts 側で完結でき、画像に焼き込むラベルは orderLabel(= ordername || orderid ||
  //    "(不明)") 側で吸収するため、orderId 必須条件を外す。
  //  - どちらでもない直リンク: 従来どおり orderid & name が URL にあればスキップ。
  const [mode, setMode] = useState<"auth" | "guidance" | "camera">(
    isFromFF || (isFromUploadCenter && !!uploadId)
      ? "guidance"
      : (searchParams.get("orderid") && searchParams.get("name"))
        ? "guidance"
        : "auth"
  );
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 焼き込み済み(注文番号・撮影日時をピクセル化した)画像と保存ファイル名。
  // 撮影確定(handleCapture)の時点で用意しておく。
  //  【なぜ事前生成するか (2026-08-28)】保存(handleSubmit)で navigator.share を
  //   使うが、これはユーザー操作の直後でないと iOS Safari に弾かれる。handleSubmit
  //   内で annotateImage を await してから share を呼ぶと操作の有効化が切れることが
  //   あるため、重い焼き込みは撮影時に済ませ、保存時は share を最初の await にする。
  const annotatedRef = useRef<{ blob: Blob; filename: string } | null>(null);

  // セッション復元処理の Promise を保持する。撮影完了時(handleSubmit)は
  // uploadImage を呼ぶ前に必ずこれを await する。
  //  【過去の失敗と対策 (2026-08-28)】以前はセッション復元が fire-and-forget で、
  //   撮影→送信が速いユーザーだと uploadImage 内の supabase.auth.getUser() が
  //   セッション未確立のまま空振りし、userid URL パラメータ頼み(＝ゲストで未指定だと
  //   必ず失敗)になっていた。復元完了を待ってから送信する。
  const sessionRestoreRef = useRef<Promise<void> | null>(null);

  // 埋め込みモード(FF / upload-center): URLハッシュからSupabaseセッションを復元
  useEffect(() => {
    if (!isEmbedded || !window.location.hash) return;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    sessionRestoreRef.current = (async () => {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error("Session restore error:", error);
      } catch (e) {
        console.error("Session restore threw:", e);
      } finally {
        // URL からトークンを消す(履歴・共有リンクに残さない)
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    })();
  }, [isEmbedded]);

  // カメラ画面を抜けたら全画面/横向きロックを解除する(auth・guidance では no-op)。
  // アンマウント時(タブが閉じられない直リンク利用など)にも確実に解除する。
  useEffect(() => {
    if (mode !== "camera") void exitFullscreen();
    return () => {
      void exitFullscreen();
    };
  }, [mode]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId && userName) {
      setMode("guidance");
    } else {
      alert("オーダーIDと名前を入力してください。");
    }
  };

  const handleCapture = async (blob: Blob) => {
    setCapturedBlob(blob);
    // 撮影時刻でファイル名を確定し、焼き込みもこの場で済ませておく。
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const labelForName = (orderLabel || "foot").replace(/[^\w.\-]/g, "_");
    const filename = `foot_${labelForName}_${timestamp}.jpg`;
    try {
      const annotated = await annotateImage(blob, [
        `注文番号: ${orderLabel || "(不明)"}`,
        `撮影日時: ${formatNow(now)}`,
      ]);
      annotatedRef.current = { blob: annotated, filename };
    } catch (e) {
      // 焼き込み失敗時は元画像で続行(annotateImage の従来仕様と同じ割り切り)
      console.warn("annotateImage 失敗、元画像で続行:", e);
      annotatedRef.current = { blob, filename };
    }
  };
  const handleRetake = () => {
    setCapturedBlob(null);
    annotatedRef.current = null;
  };

  const handleSubmit = async () => {
    if (!capturedBlob) return;
    setIsSubmitting(true);
    try {
      // 通常は handleCapture で焼き込み済み。万一無ければここで生成(フォールバック)。
      let payload = annotatedRef.current;
      if (!payload) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const labelForName = (orderLabel || "foot").replace(/[^\w.\-]/g, "_");
        const filename = `foot_${labelForName}_${timestamp}.jpg`;
        const annotated = await annotateImage(capturedBlob, [
          `注文番号: ${orderLabel || "(不明)"}`,
          `撮影日時: ${formatNow(now)}`,
        ]).catch(() => capturedBlob);
        payload = { blob: annotated, filename };
      }
      const { blob: annotated, filename } = payload;

      // 端末保存(モバイル=OS共有シート / それ以外=ダウンロード)。
      // navigator.share はユーザー操作直後でないと弾かれるため、これを最初の await にする。
      const saveResult = await saveImageToDevice(annotated, filename);
      const savedNote =
        saveResult === "shared" || saveResult === "downloaded"
          ? "端末にも画像を保存しました。"
          : saveResult === "cancelled"
            ? "※端末への保存はキャンセルされました。"
            : "※端末への保存に失敗しました。";

      if (isEmbedded) {
        // Green Storage / uploads_files へアップロード
        // セッション復元が進行中なら完了を待ってから送信する(未認証での空振り防止)
        if (sessionRestoreRef.current) {
          await sessionRestoreRef.current;
        }
        const res = await uploadImage(annotated, orderId, uploadId, userId, filename);
        if (res.success) {
          alert(`画像をアップロードしました。${savedNote}`);
          if (isFromFF && (window as any).ff_webview_handler) {
            (window as any).ff_webview_handler.postMessage(
              JSON.stringify({ success: true, message: "upload complete" })
            );
          }
          if (isFromUploadCenter && window.opener) {
            window.opener.postMessage(
              { source: "foot-guidance", status: "uploaded", uploadId, orderId, kind: "foot" },
              returnOrigin || "*"
            );
          }
          window.close();
        } else {
          alert(`アップロードに失敗しました: ${res.message}`);
        }
      } else {
        alert(saveResult === "failed" ? "端末への保存に失敗しました。" : savedNote);
        window.close();
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`エラーが発生しました: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`min-h-screen bg-gray-50 ${mode === "camera" ? "overflow-hidden h-[100dvh]" : ""}`}>
      {mode === "auth" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">計測の準備</h1>
            <p className="text-sm text-gray-600 mb-6">
              オーダーIDと、お名前（またはニックネーム）を入力してください。
            </p>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">オーダーID</label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="mt-1 block w-full border border-gray-600 rounded-md shadow-sm p-2 text-gray-900 placeholder:text-gray-400"
                  placeholder="例: ORDER-123"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">お名前</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="mt-1 block w-full border border-gray-600 rounded-md shadow-sm p-2 text-gray-900 placeholder:text-gray-400"
                  placeholder="例: 山田 太郎"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition"
              >
                計測を開始する
              </button>
            </form>
          </div>
        </div>
      )}
      {mode === "guidance" && (
        <StepWizard
          onComplete={() => {
            // StepWizard 最後の「カメラ起動」ボタンのタップ延長で全画面化する
            // (ユーザー操作ハンドラ内でないと requestFullscreen が弾かれるため)。
            void enterFullscreen();
            setMode("camera");
          }}
        />
      )}
      {mode === "camera" && <CameraView onCapture={handleCapture} />}
      {capturedBlob && (
        <PreviewModal
          imageBlob={capturedBlob}
          onRetake={handleRetake}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          mode={isEmbedded ? "ff" : "direct"}
        />
      )}
    </main>
  );
}
