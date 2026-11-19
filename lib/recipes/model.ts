import { z } from "zod";

const requiredLine = (label: string) =>
  z.string().trim().min(1, `${label} must not be empty`);

const optionalText = z.string().trim().min(1).nullable().optional();
const optionalHttpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch { return false; }
  }, "Source must be a valid HTTP or HTTPS URL")
  .nullable()
  .optional();

const recipeInputSchema = z.object({
  title: requiredLine("Title"),
  description: optionalText,
  sourceUrl: optionalHttpUrl,
  sourcePlatform: optionalText,
  imageUrl: z.string().trim().refine((value) => {
    if (/^\/(?:api\/recipe-images\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|images\/recipes\/[a-z0-9-]+)\.(jpg|png|webp)$/.test(value)) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }, "Image must be a valid HTTP URL or an uploaded image").nullable().optional(),
  servings: optionalText,
  prepMinutes: z.number().int().nonnegative().nullable().optional(),
  cookMinutes: z.number().int().nonnegative().nullable().optional(),
  cuisine: optionalText,
  dishType: optionalText,
  ingredients: z
    .array(requiredLine("Ingredient"))
    .min(1, "At least one ingredient is required"),
  steps: z.array(requiredLine("Step")).min(1, "At least one step is required"),
  notes: optionalText,
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

export type RecipeRecord = RecipeInput & {
  id: string;
  normalizedSourceUrl: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export function parseRecipeInput(value: unknown): RecipeInput {
  return recipeInputSchema.parse(value);
}
