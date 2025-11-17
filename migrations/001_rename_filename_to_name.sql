-- Migration: Rename fileName to name in Attachment table
-- Date: 2025-11-17
-- Description: Rename the fileName column to name for consistency and to allow file renaming

-- Rename column
ALTER TABLE `Attachment` CHANGE COLUMN `fileName` `name` VARCHAR(255) NULL DEFAULT NULL;

-- Note: If the table doesn't exist yet or the column has already been renamed,
-- this migration can be skipped. The schema.js file will create the table
-- with the correct column name on first run.
