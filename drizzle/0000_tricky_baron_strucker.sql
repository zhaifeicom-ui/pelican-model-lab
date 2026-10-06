CREATE TABLE `experiments` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`output` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_experiments_user_created` ON `experiments` (`user_id`,`created_at`);