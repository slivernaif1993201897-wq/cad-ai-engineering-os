CREATE TABLE `seat_components` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`seatRevisionId` varchar(96) NOT NULL,
	`name` varchar(255) NOT NULL,
	`componentType` varchar(96) NOT NULL,
	`materialId` varchar(96),
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_components_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_designs` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('CONCEPT','REVIEW','VERIFIED','RELEASED','ARCHIVED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seat_designs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_materials` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`name` varchar(255) NOT NULL,
	`specification` varchar(255) NOT NULL,
	`propertiesJson` text NOT NULL,
	`validationStatus` enum('UNKNOWN','VALID','INVALID') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_requirements` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`seatDesignId` varchar(96) NOT NULL,
	`requirementId` varchar(96) NOT NULL,
	`description` text NOT NULL,
	`constraintJson` text NOT NULL,
	`verificationMethod` varchar(255) NOT NULL,
	`status` enum('OPEN','VERIFIED','BLOCKED','REJECTED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_revisions` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`seatDesignId` varchar(96) NOT NULL,
	`revisionNumber` int NOT NULL,
	`status` enum('DRAFT','REVIEW','VERIFIED','RELEASED','SUPERSEDED') NOT NULL,
	`description` text NOT NULL,
	`designSnapshotHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_trace_links` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceId` varchar(96) NOT NULL,
	`targetType` varchar(64) NOT NULL,
	`targetId` varchar(96) NOT NULL,
	`relationship` varchar(96) NOT NULL,
	`reason` text NOT NULL,
	`evidenceJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_trace_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `seat_components_revision_idx` ON `seat_components` (`seatRevisionId`);--> statement-breakpoint
CREATE INDEX `seat_components_project_idx` ON `seat_components` (`projectId`);--> statement-breakpoint
CREATE INDEX `seat_designs_project_status_idx` ON `seat_designs` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `seat_materials_project_name_idx` ON `seat_materials` (`projectId`,`name`);--> statement-breakpoint
CREATE INDEX `seat_requirements_design_idx` ON `seat_requirements` (`seatDesignId`);--> statement-breakpoint
CREATE INDEX `seat_requirements_project_idx` ON `seat_requirements` (`projectId`);--> statement-breakpoint
CREATE INDEX `seat_revisions_design_revision_idx` ON `seat_revisions` (`seatDesignId`,`revisionNumber`);--> statement-breakpoint
CREATE INDEX `seat_revisions_project_idx` ON `seat_revisions` (`projectId`);--> statement-breakpoint
CREATE INDEX `seat_trace_source_idx` ON `seat_trace_links` (`projectId`,`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `seat_trace_target_idx` ON `seat_trace_links` (`projectId`,`targetType`,`targetId`);