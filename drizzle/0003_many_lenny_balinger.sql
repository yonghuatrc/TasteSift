CREATE TABLE `video_import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`source_url` text NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`recipe_json` text,
	`error` text,
	`lease_token` text,
	`lease_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `video_import_jobs_status_created` ON `video_import_jobs` (`status`,`created_at`);