/**
 * Saves a Blob image to the user's device by triggering a download.
 * @param blob - The image blob to save.
 * @param filename - The filename to save as (e.g. "foot_image_20260305.jpg").
 */
export function saveImageToDevice(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
