-- Create time entries table (this matches the actual AWS database schema)
CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  craftsman_id INTEGER NOT NULL REFERENCES craftsmen(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL, -- Optional link to appointment
  customer_id INTEGER, -- Foreign key to customers table
  description VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INTEGER, -- Duration in minutes (equivalent to our break_duration)
  is_billable BOOLEAN DEFAULT TRUE, -- Whether this time is billable to customer (named is_billable instead of billable)
  hourly_rate NUMERIC(10,2), -- Hourly rate for billing
  notes TEXT, -- Additional notes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_time_entries_craftsman ON time_entries(craftsman_id);
CREATE INDEX idx_time_entries_appointment ON time_entries(appointment_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);

-- Auto-update updated_at timestamp
CREATE TRIGGER set_updated_at_timestamp
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
