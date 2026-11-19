import test from "node:test";
import assert from "node:assert/strict";
import { validateImage, readImageUpload, clipboardImage } from "../../lib/recipes/images.ts";
import { parseRecipeInput } from "../../lib/recipes/model.ts";

test("rejects spoofed image types and images beyond the upload limit", () => {
  assert.throws(() => validateImage(new Uint8Array([60, 115, 118, 103, 62]), "image/png"), /imageInvalid/);
  assert.throws(() => validateImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/jpeg"), /imageTooLarge/);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ4kAAAAASUVORK5CYII=", "base64");
  assert.deepEqual(validateImage(png, "image/png"), { contentType: "image/png", extension: "png" });
  assert.throws(() => validateImage(png.slice(0, 24), "image/png"), /imageInvalid/);
});

test("accepts only generated private image paths rather than arbitrary local paths", () => {
  const recipe = { title: "饭", ingredients: ["米"], steps: ["煮"], imageUrl: "/api/recipe-images/123e4567-e89b-12d3-a456-426614174000.jpg" };
  assert.equal(parseRecipeInput(recipe).imageUrl, recipe.imageUrl);
  assert.throws(() => parseRecipeInput({ ...recipe, imageUrl: "//other.example/image.jpg" }));
  assert.throws(() => parseRecipeInput({ ...recipe, imageUrl: "/api/other-route" }));
});

test("bounds streamed multipart bodies before parsing a file", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6 * 1024 * 1024)); controller.close(); } });
  const request = new Request("https://example.com/upload", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readImageUpload(request), /imageTooLarge/);
});

test("clipboard paste selects one image and leaves ordinary text alone", () => {
  const image = new File(["image data"], "screenshot.png", { type: "image/png" });
  const text = new File(["recipe text"], "notes.txt", { type: "text/plain" });
  assert.equal(clipboardImage({ files: [text, image], items: [] }), image);
  assert.equal(clipboardImage({ files: [text], items: [] }), null);
  assert.equal(clipboardImage({ files: [], items: [{ kind: "file", type: "image/png", getAsFile: () => image }] }), image);
});
