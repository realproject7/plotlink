-- Add content_type column to storylines (fiction | cartoon)
ALTER TABLE storylines
  ADD COLUMN content_type text NOT NULL DEFAULT 'fiction';

ALTER TABLE storylines
  ADD CONSTRAINT storylines_content_type_check CHECK (content_type IN ('fiction', 'cartoon'));
