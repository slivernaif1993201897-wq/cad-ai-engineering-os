CREATE TABLE `seat_knowledge_attachments` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`entityId` varchar(96) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mediaType` varchar(128) NOT NULL,
	`storageReference` varchar(768) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`sourceReference` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_knowledge_attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `seat_knowledge_attachment_hash_idx` UNIQUE(`projectId`,`entityId`,`sha256`)
);
--> statement-breakpoint
CREATE TABLE `seat_knowledge_audit_events` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`entityId` varchar(96) NOT NULL,
	`action` enum('CREATED','UPDATED','RELATED','APPROVED','RELEASED','SUPERSEDED','ATTACHED') NOT NULL,
	`actor` varchar(128) NOT NULL,
	`reason` text NOT NULL,
	`priorHash` varchar(64),
	`nextHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_knowledge_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_knowledge_entities` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`seatDesignId` varchar(96),
	`seatRevisionId` varchar(96),
	`parentEntityId` varchar(96),
	`entityType` enum('ASSEMBLY','GEOMETRY','DIMENSION','CONSTRAINT','LOAD_CASE','CAE_CONFIGURATION','MESH','SOLVER_RUN','RESULT','VALIDATION','TEST','REPORT','EVIDENCE','PROVENANCE') NOT NULL,
	`externalKey` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`valueText` text,
	`unit` varchar(64),
	`toleranceText` text,
	`coordinateReference` varchar(255),
	`sourceType` enum('USER_PROVIDED','TOOL_GENERATED','REFERENCE','CERTIFICATE','TEST','IMPORT') NOT NULL,
	`sourceReference` text NOT NULL,
	`evidenceReference` varchar(512),
	`artifactHash` varchar(64),
	`status` enum('DRAFT','REVIEW','APPROVED','RELEASED','STALE','SUPERSEDED','REJECTED','REQUIRED_INPUT','COMPUTED','VALIDATED') NOT NULL,
	`approvalStatus` enum('UNREVIEWED','PROPOSED','APPROVED','REJECTED') NOT NULL DEFAULT 'UNREVIEWED',
	`revision` int NOT NULL,
	`supersedesEntityId` varchar(96),
	`recordHash` varchar(64) NOT NULL,
	`createdBy` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`releasedAt` timestamp,
	CONSTRAINT `seat_knowledge_entities_id` PRIMARY KEY(`id`),
	CONSTRAINT `seat_knowledge_entity_identity_idx` UNIQUE(`projectId`,`entityType`,`externalKey`,`revision`)
);
--> statement-breakpoint
CREATE TABLE `seat_knowledge_relations` (
	`id` varchar(96) NOT NULL,
	`projectId` varchar(96) NOT NULL,
	`sourceEntityId` varchar(96) NOT NULL,
	`targetEntityId` varchar(96) NOT NULL,
	`relationship` varchar(96) NOT NULL,
	`reason` text NOT NULL,
	`evidenceReference` varchar(512),
	`status` enum('ACTIVE','STALE','SUPERSEDED','REJECTED') NOT NULL DEFAULT 'ACTIVE',
	`createdBy` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seat_knowledge_relations_id` PRIMARY KEY(`id`),
	CONSTRAINT `seat_knowledge_relation_identity_idx` UNIQUE(`projectId`,`sourceEntityId`,`targetEntityId`,`relationship`)
);
--> statement-breakpoint
CREATE INDEX `seat_knowledge_attachment_entity_idx` ON `seat_knowledge_attachments` (`projectId`,`entityId`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_audit_entity_idx` ON `seat_knowledge_audit_events` (`projectId`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_project_type_status_idx` ON `seat_knowledge_entities` (`projectId`,`entityType`,`status`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_revision_idx` ON `seat_knowledge_entities` (`seatRevisionId`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_parent_idx` ON `seat_knowledge_entities` (`projectId`,`parentEntityId`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_relation_source_idx` ON `seat_knowledge_relations` (`projectId`,`sourceEntityId`);--> statement-breakpoint
CREATE INDEX `seat_knowledge_relation_target_idx` ON `seat_knowledge_relations` (`projectId`,`targetEntityId`);