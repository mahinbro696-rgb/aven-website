export const CLIENT_IMAGE_LIMIT = 15 * 1024 * 1024;
export async function prepareProductImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG অথবা WebP ছবি বাছাই করুন।");
  if (!file.size || file.size > CLIENT_IMAGE_LIMIT) throw new Error("ছবি 15 MB-এর মধ্যে রাখুন।");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("ছবিটি পড়া যাচ্ছে না। অন্য JPG, PNG অথবা WebP দিন।"); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 60_000_000) throw new Error("ছবির resolution বেশি। একটু ছোট করে আবার দিন।");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("এই browser-এ ছবি প্রস্তুত করা যাচ্ছে না। অন্য browser দিয়ে চেষ্টা করুন।");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.92, .82, .72]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= 3 * 1024 * 1024) return blob;
    }
    throw new Error("ছবিটি compress করার পরেও বড়। ছোট resolution-এর ছবি দিন।");
  } finally { bitmap.close(); }
}
