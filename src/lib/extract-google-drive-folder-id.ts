/**
 * Ambil ID folder Google Drive dari tautan (atau ID mentah yang ditempel).
 */
export function extractGoogleDriveFolderId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;

  if (/^[a-zA-Z0-9_-]{10,}$/.test(t) && !t.includes("/") && !t.toLowerCase().includes("http")) {
    return t;
  }

  const fromPath = /\/folders\/([a-zA-Z0-9_-]+)/.exec(t);
  if (fromPath?.[1]) return fromPath[1];

  const fromQuery = /[?&]id=([a-zA-Z0-9_-]+)/.exec(t);
  if (fromQuery?.[1]) return fromQuery[1];

  return null;
}

export function googleDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
