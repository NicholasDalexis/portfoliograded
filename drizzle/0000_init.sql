CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clerkId` varchar(191) NOT NULL,
	`name` text,
	`email` varchar(320),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`stripeCustomerId` varchar(191),
	`stripeSubscriptionId` varchar(191),
	`subscriptionStatus` varchar(32),
	`proExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_clerkId_unique` UNIQUE(`clerkId`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`url` text NOT NULL,
	`role` varchar(160) NOT NULL,
	`overall` int NOT NULL,
	`overallGrade` varchar(8) NOT NULL,
	`scores` json NOT NULL,
	`insights` json NOT NULL,
	`report` json NOT NULL,
	`isPro` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audits_userId_idx` ON `audits` (`userId`);
