CREATE TABLE `engineering_cad_files` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`conversationId` varchar(96),
	`fileName` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`format` enum('STEP','STL','UNSUPPORTED') NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` int NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`version` int NOT NULL,
	`parentFileId` varchar(96),
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(768) NOT NULL,
	`parser` varchar(64) NOT NULL,
	`parserVersion` varchar(96) NOT NULL,
	`parseStatus` enum('UPLOADED','VALIDATING','PARSED','PARTIALLY_PARSED','PARSE_FAILED','UNSUPPORTED','CORRUPTED','REMOVED') NOT NULL,
	`validationStatus` enum('VALID','INVALID','UNKNOWN') NOT NULL,
	`contextJson` text NOT NULL,
	`parserErrorJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`removedAt` timestamp,
	CONSTRAINT `engineering_cad_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `engineering_cad_files_project_hash_idx` ON `engineering_cad_files` (`projectId`,`sha256`);--> statement-breakpoint
CREATE INDEX `engineering_cad_files_project_name_version_idx` ON `engineering_cad_files` (`projectId`,`normalizedName`,`version`);--> statement-breakpoint
CREATE INDEX `engineering_cad_files_project_conversation_idx` ON `engineering_cad_files` (`projectId`,`conversationId`);