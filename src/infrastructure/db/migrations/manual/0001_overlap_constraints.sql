-- Overlap prevention at the database level (spec §5).
--
-- The domain checks these rules too, so the UI can show a friendly message,
-- but only the database can hold the line when two admins save at the same
-- instant. `btree_gist` is what lets a GiST exclusion constraint mix an
-- equality column with a range column.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A person cannot hold two overlapping shifts. Cancelled shifts are exempt so
-- a cancelled slot can be re-used.
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_no_overlap;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');

-- A trainer cannot be booked into two sessions at once. Cancelled and no-show
-- sessions do not block the slot.
ALTER TABLE trainer_sessions
  DROP CONSTRAINT IF EXISTS trainer_sessions_no_overlap;

ALTER TABLE trainer_sessions
  ADD CONSTRAINT trainer_sessions_no_overlap
  EXCLUDE USING gist (
    trainer_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('booked', 'completed'));

-- A shift and a session must each be a positive-length interval.
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_positive_duration;
ALTER TABLE shifts
  ADD CONSTRAINT shifts_positive_duration CHECK (ends_at > starts_at);

ALTER TABLE trainer_sessions
  DROP CONSTRAINT IF EXISTS sessions_positive_duration;
ALTER TABLE trainer_sessions
  ADD CONSTRAINT sessions_positive_duration CHECK (ends_at > starts_at);

-- A visit cannot end before it started.
ALTER TABLE checkins
  DROP CONSTRAINT IF EXISTS checkins_checkout_after_checkin;
ALTER TABLE checkins
  ADD CONSTRAINT checkins_checkout_after_checkin
  CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at);

-- Speeds up "who is in the gym right now", which the desk polls.
CREATE INDEX IF NOT EXISTS checkins_open_idx
  ON checkins (checked_in_at DESC)
  WHERE checked_out_at IS NULL;

-- Backs the front-desk name search.
CREATE INDEX IF NOT EXISTS members_name_search_idx
  ON members ((lower(first_name || ' ' || last_name)));
