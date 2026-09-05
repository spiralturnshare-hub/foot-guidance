"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAudio } from "@/hooks/useAudio";
import { getAssetPath } from "@/lib/basePath";
import { enterFullscreen, exitFullscreen } from "@/lib/fullscreen";
import LevelIndicator/*, { requestLevelPermission }*/ from "./LevelIndicator";

interface CameraViewProps {
    onCapture: (blob: Blob) => void;
    onRetake?: () => void;
}

const STEPS = [
    {
        audio: getAssetPath("/assets/step1.m4a"),
        text: "A4用紙にシワ・折れ目・切れ目はないですか？",
        btn: "撮影を進める(STEP1/4)",
    },
    {
        audio: getAssetPath("/assets/step2.m4a"),
        text: "かかとは壁についていますか？",
        btn: "撮影を進める(STEP2/4)",
    },
    {
        audio: getAssetPath("/assets/step3.m4a"),
        text: "床と壁の境界線は写っていますか？",
        btn: "撮影を進める(STEP3/4)",
    },
    {
        audio: getAssetPath("/assets/step4.m4a"),
        text: "つま先は正面を向いていますか？",
        btn: "撮影を進める(STEP4/4)",
    },
    {
        audio: getAssetPath("/assets/capture.m4a"),
        text: "撮影ボタンを押して撮影しましょう！",
        btn: "撮影",
    },
];

export default function CameraView({ onCapture }: CameraViewProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stepIndex, setStepIndex] = useState(-1); // -1: Initial state before first click
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isPaperDetected, setIsPaperDetected] = useState(false);
    const [isLevel, setIsLevel] = useState(false);
    const [isFeetInFrame, setIsFeetInFrame] = useState(false);
    const [showFinalInstruction, setShowFinalInstruction] = useState(true);
    // 全要素の寯法: scale = videoRect.width * 0.28 / 297 (px/mm)
    // 比率: A4縦(210mm) : A4横(297mm) : 足(245mm) : 壁〜A4下辺距離(81mm) : 画面下〜壁(130mm) = 210:297:245:81:130
    // 壁位置(bottom) = scale*130px
    // A4下辺(bottom) = scale*(130+81) = scale*211px
    // A4高さ = scale*210px
    // 足の高さ = scale*245px, かかと(bottom) = scale*130px
    // paperPointsは SVGの viewBox 内の座標ではなく、幅基準%で記述する
    // x%: 左=36.0, 右=64.0 (A4幅=28%, 中央配置)
    // y%: 幅基準で bottomを表現するのは複雑なので、A4ラベル・SVGはインラインstyleで直接px計算する
    // paperPointsは引き続き使用するが、SVG描画は下記のインラインstyleに切り替える
    const [paperPoints, setPaperPoints] = useState("36.0,41.8 64.0,41.8 64.0,22.0 36.0,22.0");
    const [videoRect, setVideoRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const { play } = useAudio();
    const _searchParams = new URLSearchParams(window.location.search);
    // ?debug=1 で計測値を画面に出す(不具合切り分け用。通常運用では出ない)
    const showDebug = _searchParams.get("debug") === "1";

    const updateVideoRect = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

        // コンテナ = <video> の親(className="fixed inset-0")が占める領域 = 実際に
        // 見えているビューポート。visualViewport は Safari のツールバー/タブ帯が
        // 表示/非表示に切り替わると即座にサイズが変わり、chrome が引っ込めば full に
        // 近づく。ここを基準にすれば、chrome が消えたら A4枠も自動で最適サイズに広がる。
        //  【過去の失敗と対策 (2026-08-28)】以前は video.getBoundingClientRect() を使って
        //   いたが、モバイル Safari では <video className="w-full h-full"> の height:100% が
        //   親(position:fixed + inset-0)に対して解決されず <video> が中途半端な高さに
        //   潰れて計測され、A4枠・足型ガイドが極端に小さくなる事故が起きた(冨永社長報告)。
        //   getBoundingClientRect は「潰れた瞬間」を掴むと二度と直らない。visualViewport /
        //   innerWidth/innerHeight は <video> の描画状態に依存しないため、この事故が起きない。
        const vv = window.visualViewport;
        const containerWidth = vv?.width ?? window.innerWidth;
        const containerHeight = vv?.height ?? window.innerHeight;
        if (containerWidth === 0 || containerHeight === 0) return;

        // 【核心 (2026-08-28)】このアプリは横向き専用。iOS Safari は getUserMedia 直後に
        //  一時的に縦向きの videoWidth/videoHeight(例 1080x1920, 比 0.56)を返すことがあり、
        //  その比でガイドを組むと A4枠・足型が 1/3 サイズになる(冨永社長スクショで確認)。
        //  縦比(<1)や異常値は誤りとみなし、横向き 16:9 として扱う。正しい横向き値が来たら
        //  それを使う(video の resize イベントで再計算される)。
        let videoRatio = video.videoWidth / video.videoHeight;
        if (!isFinite(videoRatio) || videoRatio < 1) {
            videoRatio = 16 / 9;
        }
        const containerRatio = containerWidth / containerHeight;

        let width, height, top, left;

        if (videoRatio > containerRatio) {
            // Video is wider than container (letterbox top/bottom)
            width = containerWidth;
            height = containerWidth / videoRatio;
            left = 0;
            top = (containerHeight - height) / 2;
        } else {
            // Video is taller than container (letterbox left/right)
            height = containerHeight;
            width = containerHeight * videoRatio;
            top = 0;
            left = (containerWidth - width) / 2;
        }

        setVideoRect({ top, left, width, height });
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new ResizeObserver(() => {
            updateVideoRect();
            setTimeout(updateVideoRect, 100);
        });
        observer.observe(video);

        const handleResize = () => {
            updateVideoRect();
            setTimeout(updateVideoRect, 100);
        };

        const remeasureWithDelays = () => {
            updateVideoRect();
            [150, 400, 800].forEach((ms) => setTimeout(updateVideoRect, ms));
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        document.addEventListener("fullscreenchange", remeasureWithDelays);
        document.addEventListener("webkitfullscreenchange", remeasureWithDelays);
        window.visualViewport?.addEventListener("resize", handleResize);
        window.visualViewport?.addEventListener("scroll", handleResize);
        // 【核心 (2026-08-28)】<video> の resize は videoWidth/videoHeight が変わった時に発火する。
        //  iOS Safari は getUserMedia 直後に一時的に縦向き(例 1080x1920)の寸法を返し、その後
        //  横向き 16:9 に確定することがある。最初の loadedmetadata の値でガイドを組むと縦横比が
        //  ずれて A4枠・足型が極端に小さくなる(冨永社長報告)。resize/playing/loadeddata で
        //  必ず測り直す。
        video.addEventListener("resize", handleResize);
        video.addEventListener("playing", handleResize);
        video.addEventListener("loadeddata", handleResize);

        // 起動直後の ~3秒間、毎フレーム測り直して確定値に収束させる
        // (映像寸法の確定・カメラ権限ダイアログ・iOS ツールバー格納 が非同期に起きるため)。
        let rafId = 0;
        const settleUntil = performance.now() + 3000;
        const settleLoop = () => {
            updateVideoRect();
            if (performance.now() < settleUntil) {
                rafId = requestAnimationFrame(settleLoop);
            }
        };
        rafId = requestAnimationFrame(settleLoop);

        remeasureWithDelays();
        // 遅めのタイミングでも一応叩く
        const lateTimers = [1200, 1800, 2600, 4000].map((ms) => setTimeout(updateVideoRect, ms));

        return () => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
            lateTimers.forEach(clearTimeout);
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
            document.removeEventListener("fullscreenchange", remeasureWithDelays);
            document.removeEventListener("webkitfullscreenchange", remeasureWithDelays);
            window.visualViewport?.removeEventListener("resize", handleResize);
            window.visualViewport?.removeEventListener("scroll", handleResize);
            video.removeEventListener("resize", handleResize);
            video.removeEventListener("playing", handleResize);
            video.removeEventListener("loadeddata", handleResize);
        };
    }, [updateVideoRect]);

    // iOS Safari のツールバー/タブ帯を能動的に格納させる。
    // scrollTo(0,1) は body に 1px のスクロール余地(globals.css の min-height:calc(100%+1px))が
    // ある時だけ効く。カメラ表示直後・少し遅延・タップ後 に繰り返しナッジする。
    useEffect(() => {
        const nudge = () => window.scrollTo(0, 1);
        nudge();
        const timers = [200, 600, 1200, 2000].map((ms) => setTimeout(nudge, ms));
        const onTouchEnd = () => setTimeout(nudge, 50);
        document.addEventListener("touchend", onTouchEnd, { passive: true });
        return () => {
            timers.forEach(clearTimeout);
            document.removeEventListener("touchend", onTouchEnd);
        };
    }, []);

    // アンマウント時(撮影完了・戻る など)に全画面を解除する。
    useEffect(() => {
        return () => {
            void exitFullscreen();
        };
    }, []);

    useEffect(() => {
        if (stepIndex === STEPS.length - 1) {
            setShowFinalInstruction(true);
            const timer = setTimeout(() => {
                setShowFinalInstruction(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [stepIndex]);

    useEffect(() => {
        let active = true;
        async function startCamera() {
            // Check if mediaDevices API is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (active) alert("お使いのブラウザはカメラへのアクセスをサポートしていないか、HTTPS接続されていません。");
                return;
            }

            try {
                // 【2026-09-05 冨永社長指示】計測誤差を減らすため、端末が対応する最高解像度で
                // 撮影する(4K を ideal として要求。getUserMedia の ideal は「対応していれば使う」
                // 制約なので、非対応の端末は自動的に出せる最大解像度にフォールバックする)。
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: "environment" },
                        width: { ideal: 3840 },
                        height: { ideal: 2160 },
                    },
                });
                if (videoRef.current && active) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.warn("Video play failed:", e));
                }
            } catch (err) {
                console.warn("Environment camera failed, trying user camera", err);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment" },
                    });
                    if (videoRef.current && active) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(e => console.warn("Video play failed:", e));
                    }
                } catch (e) {
                    if (active) {
                        console.error("Camera access failed", e);
                        alert("カメラを起動できませんでした。権限を確認してください。(HTTPS接続が必要です)");
                    }
                }
            }
        }
        startCamera();

        const video = videoRef.current;
        return () => {
            active = false;
            if (video) {
                const stream = video.srcObject as MediaStream;
                if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                }
                video.srcObject = null;
            }
        };
    }, []);

    const handleNextStep = async () => {
        // カメラ画面内の最初のタップで全画面化を要求する(ユーザー操作の延長でないと
        // requestFullscreen が弾かれる)。対象は <html> ではなくカメラのコンテナ div
        // に限定。既に全画面なら fullscreen.ts 側で no-op。iOS Safari は非対応で no-op。
        void enterFullscreen(rootRef.current);

        const nextStep = stepIndex + 1;

        /*
        // Request orientation permission on first click (iOS)
        if (stepIndex === -1) {
            await requestLevelPermission();
        }
        */

        if (nextStep < STEPS.length) {
            // Play audio and show next instruction
            if (isAudioEnabled) {
                play(STEPS[nextStep].audio);
            }
            setStepIndex(nextStep);

            // Simulation: Detect paper after step 1
            if (nextStep >= 1) {
                setIsPaperDetected(true);
            }
            // Simulation: Detect feet in frame for capture step
            if (nextStep === STEPS.length - 1) {
                setIsFeetInFrame(true);
            }
        }
    };

    const currentStepData = stepIndex >= 0 ? STEPS[stepIndex] : null;
    const isReadyToCapture = stepIndex === STEPS.length - 1;
    const canCapture = isPaperDetected && isFeetInFrame;

    const handleCapture = async () => {
        /*
        // Always request orientation permission on user gesture (iOS requirement)
        await requestLevelPermission();
        */

        if (!canCapture) {
            console.log("Conditions not met for capture:", { isPaperDetected, isFeetInFrame });
            return;
        }

        // Capture logic
        //   【2026-09-05 修正(冨永社長報告): ダウンロード画像が非常に粗い】
        //   従来は canvas を「画面上の表示サイズ(videoRect、CSSピクセル)× devicePixelRatio」
        //   で作成し、そこへ video を描画していた。これは実際のカメラ解像度(getUserMedia の
        //   1920x1080〜4K)を無視し、スマホの画面サイズ相当まで縮小してから保存していたのが
        //   「粗い画像」の直接の原因。計測精度には解像度が重要なため、canvas を
        //   video.videoWidth/videoHeight(カメラの実解像度)で作成し、そのまま等倍で描画する。
        //   注文番号・お名前・撮影日時の焼き込みは GuidancePage.tsx の annotateImage() が
        //   一元的に行う(このコンポーネントで別途 fillText していた赤文字は重複・情報不整合
        //   だったため削除)。
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            if (context && video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

                // JPEG で書き出す(この後 annotateImage() が再度 JPEG に変換するため、
                // PNG を経由すると 4K フレームで無駄にメモリ・処理時間を消費する)。
                canvas.toBlob((blob: Blob | null) => {
                    if (blob) onCapture(blob);
                }, "image/jpeg", 0.95);
            }
        }
    };

    return (
        <div ref={rootRef} className="fixed inset-0 h-[100dvh] overflow-hidden bg-black touch-none">
            {showDebug && (
                <div
                    style={{
                        position: "fixed", left: 0, top: 0, zIndex: 9999,
                        background: "rgba(0,0,0,0.75)", color: "#0f0",
                        font: "11px/1.35 monospace", padding: "4px 6px",
                        whiteSpace: "pre", pointerEvents: "none",
                    }}
                >
                    {`vv    = ${Math.round(window.visualViewport?.width || 0)} x ${Math.round(window.visualViewport?.height || 0)}\n` +
                     `inner = ${window.innerWidth} x ${window.innerHeight}\n` +
                     `screen= ${window.screen.width} x ${window.screen.height}\n` +
                     `video = ${videoRef.current?.videoWidth || 0} x ${videoRef.current?.videoHeight || 0}\n` +
                     `rect  = ${Math.round(videoRect.width)} x ${Math.round(videoRect.height)}  L${Math.round(videoRect.left)} T${Math.round(videoRect.top)}\n` +
                     `fs    = ${!!document.fullscreenElement}  dpr=${window.devicePixelRatio}`}
                </div>
            )}
            {/* Landscape Warning Overlay */}
            <div id="landscape-warning" className="pointer-events-auto">
                <div className="flex flex-col items-center gap-4">
                    <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="text-xl font-bold">
                        <p>画面を横向きにしてください</p>
                        <p className="text-xl opacity-80 mt-1">Please rotate your device to landscape mode</p>
                    </div>
                </div>
            </div>

            {/* Video Stream */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                onLoadedMetadata={updateVideoRect}
                className="w-full h-full object-contain"
            />

            {/* Guides Overlay (CSS) */}
            {videoRect.width > 0 && (
                <div
                    className="absolute pointer-events-none z-10"
                    style={{
                        top: `${videoRect.top}px`,
                        left: `${videoRect.left}px`,
                        width: `${videoRect.width}px`,
                        height: `${videoRect.height}px`,
                    }}
                >
                    {/*
                  Dynamic A4 Paper Frame: 用紙の枠線
                  - 線の太さを変えたい場合は、globals.css の #paper-dynamic-frame { stroke-width: 2px; } を変更してください。
                */}
                    {/* A4横置き枚線 SVG: scaleベースで比率 210:297:245:81 を完全に実現 */}
                    {(() => {
                        const sc = videoRect.width * 0.28 / 297; // px/mm
                        const a4W = 297 * sc;   // A4横
                        const a4H = 210 * sc;   // A4縦
                        const gap = 81 * sc;    // 壁〜A4下辺距離（固定81mm）
                        const wallBottom = 130 * sc; // 画面下端〜壁距離（130mm）
                        const a4BottomPx = wallBottom + gap; // 画面下端からの距離
                        const a4TopPx = a4BottomPx + a4H;
                        const a4Left = (videoRect.width - a4W) / 2;
                        const a4Right = a4Left + a4W;
                        // viewBox内の座標（y軸は上が0、下が大きい）
                        const svgH = videoRect.height || 100;
                        const svgA4Top    = svgH - a4TopPx;
                        const svgA4Bottom = svgH - a4BottomPx;
                        return (
                            <svg
                                className="absolute inset-0 w-full h-full"
                                viewBox={`0 0 ${videoRect.width || 100} ${svgH}`}
                            >
                                <polygon
                                    id="paper-dynamic-frame"
                                    points={`${a4Left},${svgA4Top} ${a4Right},${svgA4Top} ${a4Right},${svgA4Bottom} ${a4Left},${svgA4Bottom}`}
                                    className={isPaperDetected ? "detected" : "undetected"}
                                />
                            </svg>
                        );
                    })()}

                    {/* 「つま先はまっすぐ」ラベル: A4枠の上辺すぐ近くに配置 */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-[#00ffff] whitespace-nowrap z-20 flex flex-col items-center"
                        style={{
                            bottom: `${videoRect.width * 0.28 / 297 * (130 + 81 + 210) + 6}px`,
                        }}
                    >
                        <span>つま先はまっすぐ</span>
                        <span className="text-sm mt-0.5">Toes straight</span>
                    </div>

                    {/*
                  Static A4 Guide Label: 「A4用紙」ラベル
                  - 文字を大きくしたい場合は、text-sm を text-base, text-lg, text-xl などに変更してください。
                */}
                    {/* A4用紙ラベル: 枠の外・左側に配置、フォントサイズ30%縮小 */}
                    <div
                        className="absolute flex flex-col items-start justify-center pointer-events-none"
                        style={{
                            height: `${videoRect.width * 0.28 / 297 * 210}px`,
                            left: `${(videoRect.width - videoRect.width * 0.28) / 2 - 4}px`,
                            bottom: `${videoRect.width * 0.28 / 297 * (130 + 81)}px`,
                            transform: 'translateX(-100%)',
                        }}
                    >
                        <div className={`flex flex-col items-end transition-colors duration-300 font-bold leading-tight ${isPaperDetected ? "text-[#00ff00]" : "text-white"}`}>
                            <span className="text-[1.1rem]">A4用紙</span>
                            <span className="text-[0.875rem]">A4 Paper</span>
                        </div>
                    </div>

                    {/* 水平警告メッセージ */}
                    {/* {isReadyToCapture && !isLevel && (
                    <div className="absolute top-[10.4%] left-1/2 -translate-x-1/2 h-[27.2%] aspect-[210/297] flex items-center justify-center z-30 pointer-events-none">
                        <div className="text-2xl font-bold text-[#eab308] text-center whitespace-nowrap drop-shadow-[0_0_8px_rgba(0,0,0,1)] flex flex-col items-center">
                            <span>端末を水平に保ってください</span>
                            <span className="text-lg">Keep the device level</span>
                        </div>
                    </div>
                )} この部分は一時的に非表示にしているが、また必要になるかもしれないので、変更時に削除しないこと。*/}

                    {/*
                  Foot Guides: 足のガイド
                  - 枠線の太さを変えたい場合は、globals.css の .foot-guide { stroke-width: 1.5px; } を変更してください。
                */}
                    {/* 左足ガイド: scaleベースpxで比率 210:297:245:81 を完全実現 */}
                    <div
                        className="absolute aspect-[163/423]"
                        style={{
                            height: `${videoRect.width * 0.28 / 297 * 245}px`,
                            bottom: `${videoRect.width * 0.28 / 297 * 130}px`,
                            left: `${videoRect.width / 2 - videoRect.width * 0.28 / 297 * 30 / 2 - videoRect.width * 0.28 / 297 * 245 * (163 / 423)}px`,
                        }}
                    >
                        {/*
                      「左足 / LEFT」ラベル
                      - 文字サイズ: text-[10px] を text-xs, text-sm などに変更。
                    */}
                        <div className="absolute top-10 left-0 right-0 flex flex-col items-center text-xl font-bold text-[#00ffff] drop-shadow-[0_0_2px_#00ffff] z-20">
                            <span>左</span>
                            <div className="text-base"><span>Lt</span></div>
                        </div>
                        <svg viewBox="0 0 163 423" className="w-full h-full foot-guide relative z-10">
                            <path d="M105.129 72.5398L105.235 72.5404C105.823 72.5472 106.483 72.5749 107.071 72.6459C112.028 73.3009 117.547 73.3034 122.396 74.4256C132.223 76.7001 141.404 80.6887 149.517 86.7211C151.02 87.8388 152.08 89.359 153.314 90.6973C160.419 98.3994 161.907 109.255 161.57 119.432C161.105 133.488 152.593 147.117 141.61 155.689C134.605 161.157 124.684 166.177 116.363 169.505C99.6937 174.817 86.2334 183.716 76.2815 198.287C75.1766 199.91 73.6096 201.589 72.5668 203.381C63.6756 218.657 57.8949 236.44 57.6294 254.199C57.4643 265.388 57.5278 274.841 61.5818 285.26C67.6937 300.967 78.1603 304.18 92.6129 309.464C98.4132 311.584 109.714 319.516 114.132 324.103C122.568 332.862 129.575 345.75 130.48 358.074C130.795 361.686 131.438 365.002 131.229 368.689C131.067 371.544 130.884 374.267 130.49 377.101C129.73 386.36 127.072 393.608 122.31 401.556C121.375 403.116 119.487 406.18 118.195 407.422C116.932 408.874 114.489 411.725 113.137 412.831C108.643 416.353 100.128 421.132 94.372 421.208C90.0131 421.266 82.9272 421.691 78.6799 421.186C55.4229 418.413 41.7746 401.428 36.3597 379.694C31.85 361.592 30.7059 343.165 29.6383 324.619C29.3241 319.043 29.6332 313.298 29.3342 307.65C28.3135 284.808 26.0627 262.04 22.591 239.441C20.0896 223.872 16.5196 208.492 11.9065 193.413C8.05638 180.585 3.04332 168.509 1.84494 154.945C0.685608 141.823 1.75534 128.112 10.5687 117.583C16.684 110.277 25.7802 104.205 33.5792 98.8185C50.0224 87.2327 68.3655 78.1258 88.2146 74.2479C93.2725 73.2598 99.834 72.9871 105.129 72.5398Z" />
                            <path d="M130.992 0.507227C139.152 0.406998 142.456 0.456452 149.38 5.74712C154.635 10.0486 158.852 18.5134 159.121 25.2893C159.838 43.3737 160.543 63.353 137.725 65.7528C137.327 65.8102 136.928 65.8583 136.528 65.8971C130.553 66.4665 123.717 64.4279 119.145 60.5977C103.138 47.1909 106.606 2.4661 130.992 0.507227Z" />
                            <path d="M90.8086 12.0628C102.173 10.5687 106.167 21.7223 105.793 31.0501C105.47 39.0945 106.092 49.9681 100.506 56.4632C98.3992 58.9122 95.4937 59.4489 92.4871 59.4588C89.9057 59.5119 87.7491 59.6095 85.5864 57.7111C79.6711 51.7406 77.6549 38.3251 76.9247 30.1342C76.009 19.863 80.711 12.8502 90.8086 12.0628Z" />
                            <path d="M62.0949 31.4355C65.8501 31.2252 68.0151 31.5627 70.9733 33.9319C74.6096 36.8443 77.1865 43.0389 77.3782 47.5658C77.6367 53.6718 78.1187 61.6697 73.6785 66.4436C71.2665 69.0366 70.3997 69.6718 66.9973 69.9753C63.2238 70.0781 59.6689 67.567 57.6519 64.4727C50.7978 53.9589 45.9289 35.9949 62.0949 31.4355Z" />
                            <path d="M40.5606 51.2744C48.7913 50.7618 51.1026 57.9555 52.1681 64.8936C53.503 73.586 52.4838 82.8973 42.0049 84.4078C34.4033 84.1262 30.0298 73.0623 29.5074 66.6211C29.1768 62.546 30.1707 57.9956 33.0443 54.9473C35.5353 52.3049 36.8933 51.4819 40.5606 51.2744Z" />
                            <path d="M15.7359 66.7342C20.4315 66.0515 24.7664 69.4096 25.877 73.9423C27.0962 78.9183 27.5048 88.9164 25.3012 93.6892C23.4151 97.7745 20.5605 99.8055 16.45 101.16C16.1473 101.237 15.8416 101.302 15.5337 101.354C9.8718 102.274 7.12096 96.6474 6.40005 91.9597C5.06439 83.2743 4.30537 68.5973 15.7359 66.7342Z" />
                        </svg>
                    </div>
                    {/* 右足ガイド: scaleベースpxで比率 210:297:245:81 を完全実現 */}
                    <div
                        className="absolute aspect-[163/423]"
                        style={{
                            height: `${videoRect.width * 0.28 / 297 * 245}px`,
                            bottom: `${videoRect.width * 0.28 / 297 * 130}px`,
                            right: `${videoRect.width / 2 - videoRect.width * 0.28 / 297 * 30 / 2 - videoRect.width * 0.28 / 297 * 245 * (163 / 423)}px`,
                        }}
                    >
                        {/* 「右足 / RIGHT」ラベル */}
                        <div className="absolute top-10 left-0 right-0 flex flex-col items-center text-xl font-bold text-[#00ffff] drop-shadow-[0_0_2px_#00ffff] z-20">
                            <span>右</span>
                            <div className="text-base"><span>Rt</span></div>

                        </div>
                        <svg viewBox="0 0 163 423" className="w-full h-full foot-guide relative z-10">
                            <path d="M57.8708 72.5398L57.7651 72.5404C57.1769 72.5472 56.5166 72.5749 55.9288 72.6459C50.9718 73.3009 45.4533 73.3034 40.6043 74.4256C30.7767 76.7001 21.5965 80.6887 13.4828 86.7211C11.9799 87.8388 10.9204 89.359 9.68571 90.6973C2.58077 98.3994 1.09273 109.255 1.42966 119.432C1.89535 133.488 10.4068 147.117 21.3897 155.689C28.395 161.157 38.3157 166.177 46.6372 169.505C63.3063 174.817 76.7666 183.716 86.7185 198.287C87.8234 199.91 89.3904 201.589 90.4332 203.381C99.3244 218.657 105.105 236.44 105.371 254.199C105.536 265.388 105.472 274.841 101.418 285.26C95.3063 300.967 84.8397 304.18 70.3871 309.464C64.5868 311.584 53.2861 319.516 48.8684 324.103C40.4316 332.862 33.4253 345.75 32.5195 358.074C32.2051 361.686 31.5622 365.002 31.7712 368.689C31.9331 371.544 32.1162 374.267 32.5098 377.101C33.2697 386.36 35.9283 393.608 40.69 401.556C41.6246 403.116 43.5125 406.18 44.8048 407.422C46.0679 408.874 48.5115 411.725 49.8634 412.831C54.357 416.353 62.8716 421.132 68.628 421.208C72.9869 421.266 80.0728 421.691 84.3201 421.186C107.577 418.413 121.225 401.428 126.64 379.694C131.15 361.592 132.294 343.165 133.362 324.619C133.676 319.043 133.367 313.298 133.666 307.65C134.686 284.808 136.937 262.04 140.409 239.441C142.91 223.872 146.48 208.492 151.093 193.413C154.944 180.585 159.957 168.509 161.155 154.945C162.314 141.823 161.245 128.112 152.431 117.583C146.316 110.277 137.22 104.205 129.421 98.8185C112.978 87.2327 94.6345 78.1258 74.7854 74.2479C69.7275 73.2598 63.166 72.9871 57.8708 72.5398Z" />
                            <path d="M32.0084 0.507227C23.8477 0.406998 20.5439 0.456452 13.6199 5.74712C8.36472 10.0486 4.14798 18.5134 3.87934 25.2893C3.16193 43.3737 2.45691 63.353 25.2753 65.7528C25.6731 65.8102 26.0719 65.8583 26.472 65.8971C32.4475 66.4665 39.2825 64.4279 43.8554 60.5977C59.8622 47.1909 56.3938 2.4661 32.0084 0.507227Z" />
                            <path d="M72.1914 12.0628C60.827 10.5687 56.8331 21.7223 57.2072 31.0501C57.5297 39.0945 56.908 49.9681 62.4944 56.4632C64.6008 58.9122 67.5063 59.4489 70.5129 59.4588C73.0943 59.5119 75.2509 59.6095 77.4136 57.7111C83.3289 51.7406 85.3451 38.3251 86.0753 30.1342C86.991 19.863 82.289 12.8502 72.1914 12.0628Z" />
                            <path d="M100.905 31.4355C97.1499 31.2252 94.9849 31.5627 92.0267 33.9319C88.3904 36.8443 85.8135 43.0389 85.6218 47.5658C85.3633 53.6718 84.8813 61.6697 89.3215 66.4436C91.7335 69.0366 92.6003 69.6718 96.0027 69.9753C99.7762 70.0781 103.331 67.567 105.348 64.4727C112.202 53.9589 117.071 35.9949 100.905 31.4355Z" />
                            <path d="M122.439 51.2744C114.209 50.7618 111.897 57.9555 110.832 64.8936C109.497 73.586 110.516 82.8973 120.995 84.4078C128.597 84.1262 132.97 73.0623 133.493 66.6211C133.823 62.546 132.829 57.9956 129.956 54.9473C127.465 52.3049 126.107 51.4819 122.439 51.2744Z" />
                            <path d="M147.264 66.7342C142.568 66.0515 138.234 69.4096 137.123 73.9423C135.904 78.9183 135.495 88.9164 137.699 93.6892C139.585 97.7745 142.44 99.8055 146.55 101.16C146.853 101.237 147.158 101.302 147.466 101.354C153.128 102.274 155.879 96.6474 156.6 91.9597C157.936 83.2743 158.695 68.5973 147.264 66.7342Z" />
                        </svg>
                    </div>

                    {/*
                  Wall Edge Guide: 壁の境界線（画面下側の横線）
                  - 横向き撮影で踵は画面下側の壁に接する
                */}
                    <div
                        className="absolute left-0 right-0 border-b-2 border-dashed border-[#eab308] z-20"
                        style={{ bottom: `${videoRect.width * 0.28 / 297 * 130}px` }}
                    >
                        {/* 床ラベル (点線の上) */}
                        <div className="text-black absolute top-[-36px] left-[10px] text-2xl font-bold bg-[#00ffff] w-8 h-8 flex items-center justify-center rounded-full leading-tight">
                            床
                        </div>

                        {/* 壁ラベル (点線の下) */}
                        <div className="text-black absolute top-[4px] left-[10px] text-2xl font-bold bg-[#eab308] w-8 h-8 flex items-center justify-center rounded-full leading-tight">
                            壁
                        </div>
                    </div>

                    {/*
                  Wall Area Guide (Bottom Overlay): かかと合わせエリア（画面下側の横帯）
                  - 横向き撮影で踵は画面下側の壁に接する
                */}
                    <div
                        className="bg-black/25 absolute bottom-0 left-0 right-0 z-10 flex flex-row items-center justify-center gap-4"
                        style={{ height: `${videoRect.width * 0.28 / 297 * 130}px` }}
                    >
                        <div className="text-[#eab308] text-center font-bold text-sm leading-tight whitespace-nowrap">
                            <div className="text-xl">
                                <p>踵を壁にピタリと着けましょう</p>
                            </div>
                            <p>Align heel with the wall</p>
                        </div>
                    </div>

                    {/*
                  Heel Induction Arrows: かかと誘導矢印
                  - アイコンサイズ: w-8 h-8 (幅・高さ) を w-10 h-10 などに変更。
                  - 線の太さ: strokeWidth={2} を strokeWidth={3} などに変更。
                */}
                    {/* かかと誤導矢印: 下向き矢印、画面下側中央に配置 */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
                        style={{ bottom: `${videoRect.width * 0.28 / 297 * 130 + 8}px` }}
                    >
                        <svg className="w-8 h-8 text-[#eab308] animate-heel-induction" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>

                    {/* Level Indicator */}
                    {/*
                {isReadyToCapture && (
                    <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                        <LevelIndicator onLevelChange={setIsLevel} />
                    </div>
                )}
                */}
                </div>
            )}

            {/*
              Bottom Controls Container: 下部コントロールエリア
            */}
            <div
                className="absolute top-0 right-0 h-full w-[22%] flex flex-col items-center justify-end pb-4 px-2 gap-2 z-50"
                // viewport-fit=cover でノッチ/ホームバーの内側までコントロールを寄せる
                style={{
                    paddingRight: "max(0.5rem, env(safe-area-inset-right))",
                    paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                    paddingTop: "env(safe-area-inset-top)",
                }}
            >
                {/*
                  Conditional Capture Button: 撮影ボタン
                  - 文字サイズ: <span> 内の text-* クラスで調整可能。
                  - 余白(サイズ): px-6 py-4 (左右・上下) を調整。
                */}
                {isReadyToCapture && (
                    <button
                        id="capture-button"
                        onClick={handleCapture}
                        style={{
                            bottom: "max(1rem, env(safe-area-inset-bottom))",
                            right: "max(0.5rem, env(safe-area-inset-right))",
                        }}
                        className={`
                            absolute z-60 px-4 py-3 rounded-full font-bold text-white shadow-2xl transition-all duration-300 flex flex-col items-center leading-tight text-sm
                            ${canCapture
                                ? "bg-green-600 opacity-100 scale-110 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                                : "bg-gray-600 opacity-50 scale-100"}
                        `}
                    >
                        <span>撮影を開始する</span>
                        <span className="text-[10px] opacity-80">START CAPTURE</span>
                    </button>
                )}



                {/*
                  Action Button: 次へ進むボタン
                  - 文字サイズ: text-lg を text-xl などに変更。
                  - 高さ(余白): py-3 を py-5 などに変更。
                */}


                {/* 音声案内チェックボックス: UI右上に固定配置 */}
                <label
                    style={{
                        top: "max(0.5rem, env(safe-area-inset-top))",
                        right: "max(0.5rem, env(safe-area-inset-right))",
                    }}
                    className="absolute flex items-center gap-2 text-white cursor-pointer bg-black/50 px-3 py-1 rounded-full z-50"
                >
                    <input
                        type="checkbox"
                        checked={isAudioEnabled}
                        onChange={(e) => setIsAudioEnabled(e.target.checked)}
                        className="w-5 h-5 accent-green-500"
                    />
                    <span className="text-sm font-bold">
                        {isAudioEnabled ? "音声案内がオンになっています" : "音声案内がオフになっています"}
                    </span>
                </label>

                <div className={`w-full flex flex-col items-center gap-1 ${isReadyToCapture ? 'invisible pointer-events-none' : ''}`}>
                    {/* 音声案内チェックボックスは右上に移動済み */}
                    <button
                        onClick={handleNextStep}
                        className="w-full py-3 rounded-lg font-bold text-white shadow-xl text-lg transition-colors bg-green-600 hover:bg-green-700"
                    >
                        {stepIndex === -1
                            ? "撮影を進める"
                            : currentStepData?.btn || "次へ"}
                    </button>
                </div>

            </div>

            {/* Speech Bubble: A4枠の右隣に絶対配置（fixed inset-0の直接子） */}
            {(stepIndex >= -1 && (stepIndex < STEPS.length - 1 || showFinalInstruction)) && (() => {
                const vw = videoRect.width > 0 ? videoRect.width : window.innerWidth * 0.78;
                const sc = vw * 0.28 / 297;
                const a4W = 297 * sc;
                const a4Left = videoRect.left + (vw - a4W) / 2;
                const a4Right = a4Left + a4W;
                const sidebarW = window.innerWidth * 0.22;
                const bubbleLeft = a4Right + 8;
                const availableW = window.innerWidth - sidebarW - bubbleLeft - 8;
                const bubbleW = Math.max(160, availableW);
                const wallBottom = 130 * sc;
                const a4Bottom = wallBottom + 81 * sc;
                const a4Top = a4Bottom + 210 * sc;
                const bubbleBottom = a4Bottom + (a4Top - a4Bottom) * 0.1;
                const iconSize = 54;
                return (
                    <>
                        {/* アイコン：白い枠の外・上部 */}
                        <div
                            className="absolute z-70"
                            style={{
                                left: `${bubbleLeft + bubbleW / 2 - iconSize / 2}px`,
                                bottom: `${bubbleBottom + 4}px`,
                                transform: 'translateY(0)',
                            }}
                        >
                            <img src={getAssetPath("/assets/ashiura.png")} alt="Icon" width={iconSize} height={Math.round(iconSize * 38 / 54)} className="" />
                        </div>
                        {/* 白い吹き出し枠：文字のみ */}
                        <div
                            className="absolute flex items-center justify-center bg-white/90 z-70 rounded-lg shadow-lg"
                            style={{
                                left: `${bubbleLeft}px`,
                                bottom: `${bubbleBottom}px`,
                                width: `${bubbleW}px`,
                                minWidth: '160px',
                                maxWidth: `${availableW}px`,
                                padding: '10px 16px',
                                boxSizing: 'border-box' as const,
                            }}
                        >
                            <p className="font-bold text-black leading-tight text-center m-0" style={{fontSize: '1.2rem', whiteSpace: 'nowrap'}}>
                                {currentStepData ? currentStepData.text : "準備はよいでしょうか？"}
                            </p>
                        </div>
                    </>
                );
            })()}
            

            {/* Hidden Canvas for Capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
