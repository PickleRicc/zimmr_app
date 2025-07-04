-- Create junction table for invoices and materials
CREATE TABLE invoice_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_invoice_materials_invoice ON invoice_materials(invoice_id);
CREATE INDEX idx_invoice_materials_material ON invoice_materials(material_id);

-- Create trigger function to update updated_at field
CREATE OR REPLACE FUNCTION update_invoice_materials_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger on invoice_materials table
CREATE TRIGGER update_invoice_materials_modified_timestamp
BEFORE UPDATE ON invoice_materials
FOR EACH ROW
EXECUTE FUNCTION update_invoice_materials_modified_column();

-- Enable RLS on invoice_materials table
ALTER TABLE invoice_materials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY invoice_materials_policy_select ON invoice_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_materials.invoice_id 
      AND invoices.craftsman_id = auth.uid()
    )
  );

CREATE POLICY invoice_materials_policy_insert ON invoice_materials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_materials.invoice_id 
      AND invoices.craftsman_id = auth.uid()
    )
  );

CREATE POLICY invoice_materials_policy_update ON invoice_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_materials.invoice_id 
      AND invoices.craftsman_id = auth.uid()
    )
  );

CREATE POLICY invoice_materials_policy_delete ON invoice_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_materials.invoice_id 
      AND invoices.craftsman_id = auth.uid()
    )
  );

-- Add total_materials_price column to invoices table
ALTER TABLE invoices ADD COLUMN total_materials_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
