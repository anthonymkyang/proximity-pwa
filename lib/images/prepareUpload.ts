export async function prepareImageFileForUpload(
  file: File,
  maxDim = 2048,
  quality = 0.8
): Promise<Blob> {
  // Read into bitmap (faster & memory-friendly vs. Image() tag)
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);

  // Prefer WebP when available
  const type = "image/webp";
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b as Blob), type, quality)
  );
  return blob;
}
