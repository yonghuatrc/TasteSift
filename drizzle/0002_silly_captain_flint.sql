CREATE TABLE `recipe_translations` (
	`recipe_id` text PRIMARY KEY NOT NULL,
	`source_hash` text NOT NULL,
	`status` text NOT NULL,
	`zh_json` text,
	`en_json` text,
	`lease_token` text,
	`lease_until` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
