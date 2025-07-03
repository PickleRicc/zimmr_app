-- Create junction table for quotes and materials
CREATE TABLE quote_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_quote_materials_quote ON quote_materials(quote_id);
CREATE INDEX idx_quote_materials_material ON quote_materials(material_id);

-- Create trigger function to update updated_at field
CREATE OR REPLACE FUNCTION update_quote_materials_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger on quote_materials table
CREATE TRIGGER update_quote_materials_modified_timestamp
BEFORE UPDATE ON quote_materials
FOR EACH ROW
EXECUTE FUNCTION update_quote_materials_modified_column();

-- Enable RLS on quote_materials table
ALTER TABLE quote_materials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY quote_materials_policy_select ON quote_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_materials.quote_id 
      AND quotes.craftsman_id = auth.uid()
    )
  );

CREATE POLICY quote_materials_policy_insert ON quote_materials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_materials.quote_id 
      AND quotes.craftsman_id = auth.uid()
    )
  );

CREATE POLICY quote_materials_policy_update ON quote_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_materials.quote_id 
      AND quotes.craftsman_id = auth.uid()
    )
  );

CREATE POLICY quote_materials_policy_delete ON quote_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_materials.quote_id 
      AND quotes.craftsman_id = auth.uid()
    )
  );

-- Add total_materials_price column to quotes table
ALTER TABLE quotes ADD COLUMN total_materials_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
