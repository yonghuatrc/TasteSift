import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const members = sqliteTable("members", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  ...timestamps,
});

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    sourceUrl: text("source_url"),
    normalizedSourceUrl: text("normalized_source_url"),
    sourcePlatform: text("source_platform"),
    imageUrl: text("image_url"),
    servings: text("servings"),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    cuisine: text("cuisine"),
    dishType: text("dish_type"),
    ingredientsJson: text("ingredients_json").notNull(),
    stepsJson: text("steps_json").notNull(),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.userId),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recipes_normalized_source_url_unique").on(
      table.normalizedSourceUrl,
    ),
  ],
);

export const recipeCategories = sqliteTable("recipe_categories", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["cuisine", "dishType"] }).notNull(),
  labelZh: text("label_zh").notNull(),
  labelEn: text("label_en").notNull(),
});

export const categoryAliases = sqliteTable("category_aliases", {
  kind: text("kind", { enum: ["cuisine", "dishType"] }).notNull(),
  normalizedName: text("normalized_name").notNull(),
  categoryId: text("category_id").notNull().references(() => recipeCategories.id),
}, (table) => [primaryKey({ columns: [table.kind, table.normalizedName] })]);

export const recipeTranslations = sqliteTable("recipe_translations", {
  recipeId: text("recipe_id").primaryKey().references(() => recipes.id, { onDelete: "cascade" }),
  sourceHash: text("source_hash").notNull(),
  status: text("status", { enum: ["pending", "ready", "failed"] }).notNull(),
  zhJson: text("zh_json"),
  enJson: text("en_json"),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const videoImportJobs = sqliteTable("video_import_jobs", {
  id: text("id").primaryKey(),
  createdBy: text("created_by").notNull().references(() => members.userId),
  sourceUrl: text("source_url").notNull(),
  status: text("status", { enum: ["queued", "running", "ready", "failed"] }).notNull(),
  stage: text("stage", { enum: ["connecting", "reading", "transcribing", "organizing", "ready"] }).notNull(),
  recipeJson: text("recipe_json"),
  error: text("error"),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
  ...timestamps,
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("video_import_jobs_status_created").on(table.status, table.createdAt)]);
