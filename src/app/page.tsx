"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StepWizard from "@/components/Guidance/StepWizard";
import CameraView from "@/components/Camera/CameraView";
import PreviewModal from "@/components/Review/PreviewModal";
import { uploadImage } from "@/lib/api";
import { saveImageToDevice } from "@/lib/saveImage";

function GuidanceContent() {
  useEffect(() => {
    // アプリ起動時に縦画面に強制ロックし、以降の回転を完全に無効化
    async function lockOrientation() {
      // expo-screen-orientation might not be available during SSR or on some environments
      if (typeof window === 'undefined') return;

      try {
        // Dynamic import to avoid SSR issues if the module doesn't handle it
        const ScreenOrientation = await import("expo-screen-orientation");
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (e) {
        console.warn("Screen orientation lock is not supported on this platform.", e);
      }
    }
    lockOrientation();
  }, []);

  const searchParams = useSearchParams();
  const isFromFF = searchParams.get("from") === "ff";
  const [orderId, setOrderId] = useState(searchParams.get("orderid") || "");
  const [userName, setUserName] = useState(searchParams.get("name") || "");
  const [userId, setUserId] = useState(searchParams.get("userid") || searchParams.get("userId") || "");
  const [uploadId, setUploadId] = useState(searchParams.get("uploadid") || searchParams.get("upload_id") || "");

  const [mode, setMode] = useState<"auth" | "guidance" | "camera">(
    isFromFF ? "guidance" : (searchParams.get("orderid") && searchParams.get("name")) ? "guidance" : "auth"
  );

  useEffect(() => {
    if (isFromFF && typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ error }) => {
            if (error) console.error("Session restore error:", error);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          });
        });
      }
    }
  }, [isFromFF]);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId && userName) {
      setMode("guidance");
    } else {
      alert("オーダーIDと名前を入力してください。");
    }
  };

  const handleCapture = (blob: Blob) => {
    setCapturedBlob(blob);
  };

  const handleRetake = () => {
    setCapturedBlob(null);
  };

  const handleSubmit = async () => {
    if (!capturedBlob) return;
    setIsSubmitting(true);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `foot_image_${timestamp}.jpg`;

    try {
      if (isFromFF) {
        // FlutterFlowモード: 端末に保存 + DBにアップロード
        saveImageToDevice(capturedBlob, filename);
        const res = await uploadImage(capturedBlob, orderId, uploadId, userId);
        if (res.success) {
          alert("画像をアップロードしました。端末にも画像が保存されました");
          if (typeof window !== "undefined" && (window as any).ff_webview_handler) {
            (window as any).ff_webview_handler.postMessage(JSON.stringify({ success: true, message: "upload complete" }));
          }
          window.close();
        } else {
          alert(`アップロードに失敗しました: ${res.message}`);
        }
      } else {
        // 直接アクセスモード: 端末に保存のみ
        saveImageToDevice(capturedBlob, filename);
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
      {mode === "camera" && (
        <CameraView onCapture={handleCapture} />
      )}
      {capturedBlob && (
        <PreviewModal
          imageBlob={capturedBlob}
          onRetake={handleRetake}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          mode={isFromFF ? "ff" : "direct"}
        />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <GuidanceContent />
    </Suspense>
  );
}
