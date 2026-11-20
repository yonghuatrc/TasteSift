export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageNamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp)$/;

export function clipboardImage(data: { files: Iterable<File>; items: Iterable<Pick<DataTransferItem, "kind" | "type" | "getAsFile">> }): File | null {
  for (const file of data.files) if (file.type.startsWith("image/")) return file;
  for (const item of data.items) if (item.kind === "file" && item.type.startsWith("image/")) {
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

export function validateImage(bytes: Uint8Array, claimedType: string): { contentType: string; extension: string } {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("imageTooLarge");
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let type = "";
  if (bytes.length >= 33 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]) && text(12, 16) === "IHDR" && text(bytes.length - 8, bytes.length - 4) === "IEND") type = "image/png";
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) type = "image/jpeg";
  if (bytes.length >= 20 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP" && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) === bytes.length - 8) type = "image/webp";
  if (!type || type !== claimedType) throw new Error("imageInvalid");
  return { contentType: type, extension: type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp" };
}

export async function readImageUpload(request: Request): Promise<File> {
  const contentType = request.headers.get("content-type") ?? "";
  const multipart = contentType.startsWith("multipart/form-data;");
  const maximumBody = multipart ? MAX_IMAGE_BYTES + 64 * 1024 : MAX_IMAGE_BYTES;
  if (Number(request.headers.get("content-length")) > maximumBody) throw new Error("imageTooLarge");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("imageInvalid");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBody) { await reader.cancel(); throw new Error("imageTooLarge"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  if (!multipart) return new File([bytes], "cover", { type: contentType });
  const form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  const file = form.get("image");
  if (!(file instanceof File)) throw new Error("imageInvalid");
  return file;
}
