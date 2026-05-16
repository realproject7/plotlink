-- Add content_type column to storylines (fiction | cartoon)
ALTER TABLE storylines
  ADD COLUMN content_type text NOT NULL DEFAULT 'fiction';
