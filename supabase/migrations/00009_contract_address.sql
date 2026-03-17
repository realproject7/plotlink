-- Add contract_address to all tables for multi-contract support
-- Default existing rows to old contract address (lowercase)

ALTER TABLE storylines ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';
ALTER TABLE plots ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';
ALTER TABLE donations ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';
ALTER TABLE ratings ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';
ALTER TABLE comments ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';
ALTER TABLE page_views ADD COLUMN contract_address TEXT NOT NULL DEFAULT '0x05c4d59529807316d6fa09cdaa509addfe85b474';

-- After backfilling existing rows, change default to empty string
-- Indexers will always explicitly pass the value
ALTER TABLE storylines ALTER COLUMN contract_address SET DEFAULT '';
ALTER TABLE plots ALTER COLUMN contract_address SET DEFAULT '';
ALTER TABLE donations ALTER COLUMN contract_address SET DEFAULT '';
ALTER TABLE ratings ALTER COLUMN contract_address SET DEFAULT '';
ALTER TABLE comments ALTER COLUMN contract_address SET DEFAULT '';
ALTER TABLE page_views ALTER COLUMN contract_address SET DEFAULT '';
