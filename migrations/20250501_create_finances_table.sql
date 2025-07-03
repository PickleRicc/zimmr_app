-- Migration: Create finances table for craftsman revenue goals (MVP-simple)
CREATE TABLE finances (
  id SERIAL PRIMARY KEY,
  craftsman_id INTEGER NOT NULL REFERENCES craftsmen(id) ON DELETE CASCADE,
  goal_amount NUMERIC(12,2) NOT NULL,
  goal_period VARCHAR(16) NOT NULL, -- 'month', 'year', 'all'
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (craftsman_id, goal_period)
);

-- Index for quick lookup by craftsman
CREATE INDEX idx_finances_craftsman_id ON finances(craftsman_id);
