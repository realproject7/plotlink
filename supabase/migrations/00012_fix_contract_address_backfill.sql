-- Fix contract_address on existing data: re-tag from the new contract
-- (0x6b8d...) back to the old contract (0x05c4...) where all pre-redeploy
-- data was actually created. Migration 00009 incorrectly defaulted to the
-- new address.
UPDATE storylines SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
UPDATE plots SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
UPDATE donations SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
UPDATE ratings SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
UPDATE comments SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
UPDATE page_views SET contract_address = '0x05c4d59529807316d6fa09cdaa509addfe85b474' WHERE contract_address = '0x6b8d38af1773dd162ebc6f4a8eb923f3c669605d';
