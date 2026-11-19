CREATE TABLE `category_aliases` (
	`kind` text NOT NULL,
	`normalized_name` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`kind`, `normalized_name`),
	FOREIGN KEY (`category_id`) REFERENCES `recipe_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`label_zh` text NOT NULL,
	`label_en` text NOT NULL
);
