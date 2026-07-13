interface PreviewModalProps {
    imageBlob: Blob;
    onRetake: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    mode: "ff" | "direct";
}

import { getAssetPath } from "@/lib/basePath";

export default function PreviewModal({ imageBlob, onRetake, onSubmit, isSubmitting, mode }: PreviewModalProps) {
    const imageUrl = URL.createObjectURL(imageBlob);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-white p-4 rounded-lg max-w-lg w-full m-4 text-center">
                <h2 className="text-xl font-bold mb-4">確認</h2>
                <div className="flex justify-center mb-4 overflow-hidden rounded-lg bg-gray-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Captured" className="block max-h-[60vh] max-w-full w-auto h-auto pointer-events-none" />
                </div>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={onRetake}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded text-lg"
                        disabled={isSubmitting}
                    >
                        撮り直し
                    </button>
                    <button
                        onClick={onSubmit}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-lg"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "処理中..." : mode === "ff" ? "この画像を使う" : "保存"}
                    </button>
                </div>
            </div>
        </div>
    );
}
