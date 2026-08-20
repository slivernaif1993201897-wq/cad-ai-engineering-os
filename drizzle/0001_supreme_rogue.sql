CREATE TABLE `engineering_conversation_events` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`conversationId` varchar(96) NOT NULL,
	`kind` enum('CREATED','RENAMED','ARCHIVED','RESTORED','DELETED') NOT NULL,
	`priorTitle` varchar(255),
	`nextTitle` varchar(255),
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engineering_conversation_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engineering_conversations` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('ACTIVE','ARCHIVED','DELETED') NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`archivedAt` timestamp,
	`deletedAt` timestamp,
	CONSTRAINT `engineering_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engineering_lineage_nodes` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`kind` varchar(64) NOT NULL,
	`parentId` varchar(96),
	`sourceRecordId` varchar(96),
	`title` varchar(255) NOT NULL,
	`reasonForChange` text NOT NULL,
	`changeSummary` text NOT NULL,
	`status` varchar(64) NOT NULL,
	`authorSource` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engineering_lineage_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engineering_memory_records` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`conversationId` varchar(96),
	`kind` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`truthStatus` varchar(64) NOT NULL,
	`validationStage` varchar(64) NOT NULL,
	`sourceRecordId` varchar(96),
	`relatedConceptId` varchar(96),
	`relatedRequirementId` varchar(96),
	`relatedConfigurationId` varchar(96),
	`relatedGeometryJson` text,
	`authorSource` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engineering_memory_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engineering_messages` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`conversationId` varchar(96) NOT NULL,
	`role` enum('USER','CAD_AGENT','SYSTEM') NOT NULL,
	`body` text NOT NULL,
	`mode` varchar(48) NOT NULL,
	`actionKind` varchar(64),
	`truthStatus` varchar(64) NOT NULL,
	`contextJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engineering_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engineering_projects` (
	`id` varchar(96) NOT NULL,
	`name` varchar(255) NOT NULL,
	`accessKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`archivedAt` timestamp,
	CONSTRAINT `engineering_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `engineering_projects_accessKey_unique` UNIQUE(`accessKey`)
);
--> statement-breakpoint
CREATE INDEX `engineering_conversation_events_project_conversation_idx` ON `engineering_conversation_events` (`projectId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `engineering_conversations_project_status_idx` ON `engineering_conversations` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `engineering_lineage_project_parent_idx` ON `engineering_lineage_nodes` (`projectId`,`parentId`);--> statement-breakpoint
CREATE INDEX `engineering_memory_project_kind_idx` ON `engineering_memory_records` (`projectId`,`kind`);--> statement-breakpoint
CREATE INDEX `engineering_memory_project_conversation_idx` ON `engineering_memory_records` (`projectId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `engineering_messages_project_conversation_idx` ON `engineering_messages` (`projectId`,`conversationId`);