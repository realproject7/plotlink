-- [#549] Clean up orphan storylines 25-33 from first E2E attempt
--
-- These were created on the old v4 factory (0x92c3bd44...) with wrong
-- content hashes during initial E2E testing. The new v4b factory
-- (0x9D2AE1E99D0A6300bfcCF41A82260374e38744Cf) has the correct data.

-- 1. Delete plots for orphan storylines
DELETE FROM plots WHERE storyline_id BETWEEN 25 AND 33;

-- 2. Delete donations for orphan storylines
DELETE FROM donations WHERE storyline_id BETWEEN 25 AND 33;

-- 3. Delete ratings for orphan storylines
DELETE FROM ratings WHERE storyline_id BETWEEN 25 AND 33;

-- 4. Delete comments for orphan storylines
DELETE FROM comments WHERE storyline_id BETWEEN 25 AND 33;

-- 5. Delete page views for orphan storylines
DELETE FROM page_views WHERE storyline_id BETWEEN 25 AND 33;

-- 6. Delete trade history for orphan storylines
DELETE FROM trade_history WHERE storyline_id BETWEEN 25 AND 33;

-- 7. Delete the orphan storylines themselves
DELETE FROM storylines WHERE storyline_id BETWEEN 25 AND 33;

-- 8. Clean up backfill_failures for orphan storylines
DELETE FROM backfill_failures WHERE storyline_id BETWEEN 25 AND 33;

-- 9. Clean up notification_queue for orphan storylines (skip if table doesn't exist)
DO $$ BEGIN
  DELETE FROM notification_queue WHERE storyline_id BETWEEN 25 AND 33;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
