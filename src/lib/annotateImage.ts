/**
 * 撮影画像の上部に半透明の帯を敷き、指定テキスト(注文番号・お名前・撮影日時など)を
 * ピクセルとして焼き込んだ JPEG Blob を返す。
 * ファイル名が失われても、どの注文の画像か画像自体から判別できるようにするのが目的。
 * canvas 非対応・変換失敗時は元の Blob をそのまま返す(撮影を止めない)。
 *
 * 【2026-09-05 冨永社長指摘・修正】
 *   - 配置を下部→**上部**に変更。下部には壁・かかと・A4用紙など計測に必要な内容が
 *     写ることが多く、そこに文字を重ねると見づらくなるため。
 *   - 半透明の帯だけでなく、**文字に黒縁取り(stroke)を追加**。床の色によっては
 *     帯があっても白文字が視認しづらい場合があるため、二重の対策で確実性を上げる。
 */
export async function annotateImage(source: Blob, lines: string[]): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return source;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const cleaned = lines.map((l) => (l ?? "").trim()).filter((l) => l.length > 0);
    if (cleaned.length > 0) {
      const pad = Math.round(canvas.width * 0.03);
      const fontSize = Math.max(18, Math.round(canvas.width * 0.032));
      const lineH = Math.round(fontSize * 1.45);
      const barH = pad * 2 + lineH * cleaned.length;

      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, canvas.width, barH);

      ctx.font = `bold ${fontSize}px -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.fillStyle = "#ffffff";
      cleaned.forEach((text, i) => {
        const y = pad + i * lineH;
        ctx.strokeText(text, pad, y);
        ctx.fillText(text, pad, y);
      });
    }

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? source), "image/jpeg", 0.92);
    });
  } catch (e) {
    console.error("annotateImage failed, using original blob:", e);
    return source;
  }
}
