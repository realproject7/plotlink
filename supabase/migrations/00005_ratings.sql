-- Ratings table: one rating per user per storyline (upsert pattern)
-- Public read, no public write (writes via service role only)

CREATE TABLE ratings (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storyline_id BIGINT NOT NULL REFERENCES storylines(id),
  rater_address TEXT NOT NULL,
  score       SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storyline_id, rater_address)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON ratings FOR SELECT USING (true);
