import { useState, useEffect } from "react";
import StepWizard from "@/components/Guidance/StepWizard";
import CameraView from "@/components/Camera/CameraView";
import PreviewModal from "@/components/Review/PreviewModal";
import { uploadImage } from "@/lib/api";
import { saveImageToDevice } from "@/lib/saveImage";
import { annotateImage } from "@/lib/annotateImage";

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

  const [mode, setMode] = useState<"auth" | "guidance" | "camera">(
    isFromFF || (isFromUploadCenter && !!orderId && !!uploadId)
      ? "guidance"
      : (searchParams.get("orderid") && searchParams.get("name"))
        ? "guidance"
        : "auth"
  );
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 埋め込みモード(FF / upload-center): URLハッシュからSupabaseセッションを復元
  useEffect(() => {
    if (isEmbedded && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        import("@/lib/supabase").then(({ supabase }) => {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ error }) => {
            if (error) console.error("Session restore error:", error);
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          });
        });
      }
    }
  }, [isEmbedded]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId && userName) {
      setMode("guidance");
    } else {
      alert("オーダーIDと名前を入力してください。");
    }
  };

  const handleCapture = (blob: Blob) => setCapturedBlob(blob);
  const handleRetake = () => setCapturedBlob(null);

  const handleSubmit = async () => {
    if (!capturedBlob) return;
    setIsSubmitting(true);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const labelForName = (orderLabel || "foot").replace(/[^\w.\-]/g, "_");
    const filename = `foot_${labelForName}_${timestamp}.jpg`;
    try {
      // 撮影画像に注文番号と撮影日時をピクセルとして焼き込む
      const annotated = await annotateImage(capturedBlob, [
        `注文番号: ${orderLabel || "(不明)"}`,
        `撮影日時: ${formatNow(now)}`,
      ]);

      if (isEmbedded) {
        // 端末にダウンロード + Green Storage / uploads_files へアップロード
        saveImageToDevice(annotated, filename);
        const res = await uploadImage(annotated, orderId, uploadId, userId, filename);
        if (res.success) {
          alert("画像をアップロードしました。端末にも画像が保存されました");
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
        saveImageToDevice(annotated, filename);
        alert("端末に保存されました");
        window.close();
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。");
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
      {mode === "guidance" && <StepWizard onComplete={() => setMode("camera")} />}
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
