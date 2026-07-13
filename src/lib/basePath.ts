export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function getAssetPath(path: string): string {
  if (path.startsWith("http") || path.startsWith("data:")) {
    return path;
  }
  // Ensure path starts with / if it doesn't
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
