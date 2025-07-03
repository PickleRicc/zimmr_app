-- Drop tables if they exist
DROP TABLE IF EXISTS materials_confirmations CASCADE;
DROP TABLE IF EXISTS materials CASCADE;

-- Create materials table
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  craftsman_id UUID REFERENCES craftsmen(id) ON DELETE CASCADE, -- NULL allowed for default materials
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Add constraint: craftsman_id must be present for non-default materials
  CONSTRAINT materials_craftsman_id_check CHECK (is_default = TRUE OR craftsman_id IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX idx_materials_craftsman ON materials(craftsman_id);
CREATE INDEX idx_materials_name ON materials(name);

-- Create materials_confirmations table to track user confirmation
CREATE TABLE materials_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  craftsman_id UUID NOT NULL REFERENCES craftsmen(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(craftsman_id)
);

-- Create trigger function to update updated_at field
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger on materials table
DROP TRIGGER IF EXISTS update_materials_modtime ON materials;
CREATE TRIGGER update_materials_modtime
BEFORE UPDATE ON materials
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- No verification needed since we're creating tables from scratch

-- Add RLS policies
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS materials_policy_select ON materials;
DROP POLICY IF EXISTS materials_policy_insert ON materials;
DROP POLICY IF EXISTS materials_policy_update ON materials;
DROP POLICY IF EXISTS materials_policy_delete ON materials;

-- Create new policies
CREATE POLICY materials_policy_select ON materials
  FOR SELECT USING ((craftsman_id = auth.uid() AND is_default = false) OR is_default = true);

CREATE POLICY materials_policy_insert ON materials
  FOR INSERT WITH CHECK ((craftsman_id = auth.uid() AND is_default = false) OR is_default = true);

CREATE POLICY materials_policy_update ON materials
  FOR UPDATE USING (craftsman_id = auth.uid() AND is_default = false);

CREATE POLICY materials_policy_delete ON materials
  FOR DELETE USING (craftsman_id = auth.uid() AND is_default = false);

-- Enable RLS on confirmations table
ALTER TABLE materials_confirmations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any  
DROP POLICY IF EXISTS confirmations_policy_select ON materials_confirmations;
DROP POLICY IF EXISTS confirmations_policy_insert ON materials_confirmations;

-- Create new policies
CREATE POLICY confirmations_policy_select ON materials_confirmations
  FOR SELECT USING (craftsman_id = auth.uid());

CREATE POLICY confirmations_policy_insert ON materials_confirmations
  FOR INSERT WITH CHECK (craftsman_id = auth.uid());
