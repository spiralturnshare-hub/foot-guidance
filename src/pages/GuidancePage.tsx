import { useState, useEffect, useRef } from "react";
import StepWizard from "@/components/Guidance/StepWizard";
import CameraView from "@/components/Camera/CameraView";
import PreviewModal from "@/components/Review/PreviewModal";
import { uploadImage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { saveImageToDevice, isIOS } from "@/lib/saveImage";
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

  // auth 画面(オーダーID+名前の手入力フォーム)を出すかどうかの判定。
  // ここで "guidance" を初期値にできれば、顧客に情報を打たせず撮影ガイダンスへ直行する。
  //  - FF WebView 経由(from=ff): 常にスキップ。FF 側が顧客コンテキストを保証する。
  //  - upload-center 経由(from=upload-center): uploadId さえ渡っていれば「confirm-user」
  //    (インソール利用者名の確認画面)へ進む(下記 insoleUserName 取得 useEffect 参照)。
  //    【過去の失敗と対策 (2026-08-28)】以前は orderId も必須(&& !!orderId)にしていたため、
  //    ゲスト/未決済フローで upload-center 側の orderId が空のとき、顧客に不要な
  //    「オーダーID入力画面」が表示されていた。アップロードは uploadId さえあれば
  //    api.ts 側で完結でき、画像に焼き込むラベルは orderLabel(= ordername || orderid ||
  //    "(不明)") 側で吸収するため、orderId 必須条件を外す。
  //  - どちらでもない直リンク: 従来どおり orderid & name が URL にあればスキップ。
  type Mode = "auth" | "confirm-user" | "guidance" | "camera" | "ask-save";
  const [mode, setMode] = useState<Mode>(
    isFromFF
      ? "guidance"
      : (isFromUploadCenter && !!uploadId)
        ? "confirm-user"
        : searchParams.get("name")
          ? "guidance"
          : "auth"
  );
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Green へのアップロード成功後、「端末にも保存しますか?」の確認(ask-save)で使う画像。
  //   2026-09-05 冨永社長指示: 取扱店が事前撮影 → 端末にも控えを残す、という使い方があるため、
  //   埋め込みモードでも端末保存を選べるようにする(自動では保存しない。任意)。
  const [pendingSave, setPendingSave] = useState<{ blob: Blob; filename: string } | null>(null);
  const [savingToDevice, setSavingToDevice] = useState(false);
  // window.close() が効かなかった場合(iOS Safari 等)に手動で閉じてもらう案内を出すためのフラグ
  const [showCloseFallback, setShowCloseFallback] = useState(false);

  // インソール利用者名(uploads.insole_user_name = 発注時に登録された「何様の」インソールか)。
  //   【なぜ必要か (2026-09-05 冨永社長指示)】操作している人(注文者)と、実際に足を撮影される人
  //   (家族分の代理注文等)が別人のケースがある。撮影前に「◯◯様の撮影で間違いないか」を
  //   明示確認させることで取り違えを防ぐ。あわせて画像にも焼き込み、A4紙にお客様自身の手で
  //   名前を書いてもらう従来運用(顔が映らない足だけの写真では誰の撮影か分からないための代替
  //   手段だった)を不要にする。
  const [insoleUserName, setInsoleUserName] = useState<string | null>(null);
  const [nameFetchDone, setNameFetchDone] = useState(false);

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

  // upload-center 経由(uploadId あり)のとき、insole_user_name を取得して
  // 「◯◯様の撮影で間違いないか」の確認画面(confirm-user)に表示する。
  //   セッション復元(上記 useEffect)が先に走るため、そのPromiseを待ってから読む。
  useEffect(() => {
    if (!(isFromUploadCenter && uploadId)) {
      setNameFetchDone(true);
      return;
    }
    (async () => {
      try {
        if (sessionRestoreRef.current) await sessionRestoreRef.current;
        const { data, error } = await supabase
          .from("uploads")
          .select("insole_user_name")
          .eq("id", uploadId)
          .maybeSingle();
        if (!error && data?.insole_user_name) {
          setInsoleUserName(data.insole_user_name as string);
        }
      } catch (e) {
        console.warn("insole_user_name 取得失敗(確認画面は名前無しにフォールバック):", e);
      } finally {
        setNameFetchDone(true);
      }
    })();
  }, [isFromUploadCenter, uploadId]);

  // 名前が取得できなかった(取得失敗 or 未登録)場合は確認画面を出さずそのまま撮影へ進む
  // (確認する対象が無いため)。
  useEffect(() => {
    if (mode === "confirm-user" && nameFetchDone && !insoleUserName) {
      setMode("guidance");
    }
  }, [mode, nameFetchDone, insoleUserName]);

  // 単独アクセス(upload-center を経由しない直接アクセス)時の確認フォーム。
  //   2026-09-05 冨永社長指示: オーダーIDは「どこにあるか分からない」お客様がほとんどのため
  //   必須項目から外す。画像の見分けはお名前だけで十分。
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName) {
      setMode("guidance");
    } else {
      alert("お名前を入力してください。");
    }
  };

  // 画像の下部に焼き込む行(注文番号・お名前・撮影日時)。
  //   お名前は uploads.insole_user_name(confirm-user で確認済みの「何様の」インソールか)、
  //   または単独アクセス時に入力してもらった userName。
  //   顔が映らない足だけの写真では誰の撮影か分からないため、A4紙に手書きしてもらっていた
  //   名前をここで自動的に代替する(2026-09-05 冨永社長指示)。単独アクセス時は
  //   オーダーIDを入力させない(お客様が「どこにあるか分からない」ため)ので、
  //   注文番号の行は分かる時だけ出す。
  const annotationLines = (now: Date) => [
    orderLabel ? `注文番号: ${orderLabel}` : null,
    (insoleUserName || userName) ? `お名前: ${insoleUserName || userName} 様` : null,
    `撮影日時: ${formatNow(now)}`,
  ].filter((l): l is string => !!l);

  const handleCapture = async (blob: Blob) => {
    setCapturedBlob(blob);
    // 撮影時刻でファイル名を確定し、焼き込みもこの場で済ませておく。
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const labelForName = (orderLabel || "foot").replace(/[^\w.\-]/g, "_");
    const filename = `foot_${labelForName}_${timestamp}.jpg`;
    try {
      const annotated = await annotateImage(blob, annotationLines(now));
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
        const annotated = await annotateImage(capturedBlob, annotationLines(now)).catch(() => capturedBlob);
        payload = { blob: annotated, filename };
      }
      const { blob: annotated, filename } = payload;

      if (isEmbedded) {
        // upload-center / FF に埋め込まれている場合は Green Storage / uploads_files への
        // アップロードを行い、成功後に呼び出し元へ通知する。
        //   【2026-09-05 変更】以前はここで端末保存(navigator.share の OS 共有シート)を
        //   自動で挟んでいたが、共有シートが「別の画面に遷移した」ように見えてお客様が
        //   混乱するとの指摘(冨永社長)。一方で取扱店が事前撮影 → 端末にも控えを残す、
        //   という使い方もあるため、自動実行ではなく「端末にも保存しますか?」を
        //   アプリ内の確認画面(ask-save)で尋ね、選んだ場合のみ保存する形にする。
        // セッション復元が進行中なら完了を待ってから送信する(未認証での空振り防止)
        if (sessionRestoreRef.current) {
          await sessionRestoreRef.current;
        }
        const res = await uploadImage(annotated, orderId, uploadId, userId, filename);
        if (res.success) {
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
          // upload-center 側にはすでに通知済み。ここでは閉じずに端末保存の意思確認へ。
          // capturedBlob を消しておかないと PreviewModal が ask-save 画面の上に残ってしまう。
          setPendingSave({ blob: annotated, filename });
          setCapturedBlob(null);
          setMode("ask-save");
        } else {
          alert(`アップロードに失敗しました: ${res.message}`);
        }
      } else {
        // 埋め込みでない直リンク利用時は従来どおり端末保存のみ(サーバーへは送らない)。
        const saveResult = await saveImageToDevice(annotated, filename);
        const savedNote =
          saveResult === "shared" || saveResult === "downloaded"
            ? "端末に画像を保存しました。"
            : saveResult === "cancelled"
              ? "※端末への保存はキャンセルされました。"
              : "※端末への保存に失敗しました。";
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

  // window.close() は iOS Safari 等で「ユーザー操作から時間が経つ・共有シート等の
  // 別UIを経由した」場合に無視されることがある(ブラウザの仕様。呼び出し側では検知不能)。
  //   【2026-09-05 冨永社長報告】「端末に保存しますか」で「はい」を選んだ後、閉じずに
  //   画面が残るケースがあった。閉じなかった場合に備え、手動で閉じる案内を必ず表示する。
  const closeOrShowFallback = () => {
    window.close();
    setTimeout(() => setShowCloseFallback(true), 400);
  };

  // 「端末にも保存しますか?」への回答(ask-save)。
  //   「はい」ボタンの click ハンドラの中で saveImageToDevice を直接呼ぶことで、
  //   navigator.share に必要なユーザー操作の有効化(user activation)を保つ。
  const handleSaveYes = async () => {
    if (!pendingSave) { closeOrShowFallback(); return; }
    setSavingToDevice(true);
    try {
      await saveImageToDevice(pendingSave.blob, pendingSave.filename);
    } catch (e) {
      console.warn("端末保存に失敗:", e);
    } finally {
      setSavingToDevice(false);
      closeOrShowFallback();
    }
  };
  const handleSaveNo = () => {
    closeOrShowFallback();
  };

  return (
    <main className={`min-h-screen bg-gray-50 ${mode === "camera" ? "overflow-hidden h-[100dvh]" : ""}`}>
      {mode === "auth" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">計測の準備</h1>
            <p className="text-sm text-gray-600 mb-6">
              お名前（またはニックネーム）を入力してください。撮影する方を後で見分けるために画像に記録します。
            </p>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
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
      {mode === "confirm-user" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center">
            {!nameFetchDone ? (
              <p className="text-sm text-gray-500">読み込み中…</p>
            ) : (
              <>
                <h1 className="text-lg font-bold text-gray-800 mb-3">撮影する方の確認</h1>
                <p className="text-sm text-gray-600 mb-2">これから撮影するのは</p>
                <p className="text-2xl font-bold mb-2" style={{ color: "#2563EB" }}>
                  {insoleUserName} 様
                </p>
                <p className="text-sm text-gray-600 mb-6">の足で間違いありませんか？</p>
                <button
                  type="button"
                  onClick={() => setMode("guidance")}
                  className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition"
                >
                  はい、間違いありません
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  ご注文者様と撮影される方が異なる場合(ご家族分のご注文など)、必ずこの方の足を撮影してください。
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {mode === "ask-save" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center">
            {showCloseFallback ? (
              <>
                <h1 className="text-lg font-bold text-gray-800 mb-3">この画面を閉じてください</h1>
                <p className="text-sm text-gray-600">
                  アップロードは完了しています。ブラウザの操作でこのタブ/画面を閉じると、
                  元のアップロードセンターの画面に戻ります。
                </p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-bold text-gray-800 mb-3">端末にも保存しますか？</h1>
                <p className="text-sm text-gray-600 mb-6">
                  アップロードは完了しました。この端末にも画像を保存しておくと、後で見返すことができます。
                </p>
                {isIOS() && (
                  <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: "#2563EB", backgroundColor: "#DBEAFE" }}>
                    「はい」を選ぶと次に共有画面が開きます。そこで「画像を保存」を選んでください。
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveNo}
                    disabled={savingToDevice}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    いいえ
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveYes}
                    disabled={savingToDevice}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {savingToDevice ? "保存中…" : "はい、保存する"}
                  </button>
                </div>
              </>
            )}
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
