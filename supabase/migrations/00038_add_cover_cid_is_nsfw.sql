ALTER TABLE storylines
  ADD COLUMN cover_cid text,
  ADD COLUMN is_nsfw boolean NOT NULL DEFAULT false;

CREATE INDEX idx_storylines_is_nsfw ON storylines (is_nsfw);
