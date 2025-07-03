-- Function to create a quote with materials in one transaction
CREATE OR REPLACE FUNCTION create_quote_with_materials(
  quote_data JSONB,
  materials_data JSONB
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_quote_id BIGINT;
  result JSONB;
  material JSONB;
BEGIN
  -- Insert the quote using the correct column names from the actual schema
  INSERT INTO quotes (
    craftsman_id, customer_id, appointment_id, status, 
    amount, tax_amount, total_amount, vat_exempt,
    total_materials_price, notes, due_date, service_date, location
  )
  SELECT 
    craftsman_id, customer_id, appointment_id, status, 
    amount, tax_amount, total_amount, vat_exempt,
    total_materials_price, notes, due_date, service_date, location
  FROM jsonb_populate_record(NULL::quotes, quote_data)
  RETURNING id INTO new_quote_id;
    
  -- Insert materials if any provided
  IF jsonb_array_length(materials_data) > 0 THEN
    FOR material IN SELECT * FROM jsonb_array_elements(materials_data)
    LOOP
      INSERT INTO quote_materials (
        quote_id, 
        material_id, 
        quantity, 
        unit_price,
        name,
        unit
      ) VALUES (
        new_quote_id,
        (material->>'material_id')::UUID,
        (material->>'quantity')::NUMERIC,
        (material->>'unit_price')::NUMERIC,
        material->>'name',
        material->>'unit'
      );
    END LOOP;
  END IF;
  
  -- Return the created quote with its materials
  SELECT jsonb_build_object(
    'quote', row_to_json(q)::JSONB,
    'materials', COALESCE(jsonb_agg(row_to_json(qm)::JSONB), '[]'::JSONB)
  ) INTO result
  FROM quotes q
  LEFT JOIN quote_materials qm ON qm.quote_id = q.id
  WHERE q.id = new_quote_id
  GROUP BY q.id;
  
  RETURN result;
END;
$$;

-- Function to update a quote with materials in one transaction
CREATE OR REPLACE FUNCTION update_quote_with_materials(
  quote_id BIGINT,
  quote_data JSONB,
  materials_data JSONB
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  material JSONB;
BEGIN
  -- Update the quote
  UPDATE quotes
  SET (
    customer_id,
    appointment_id,
    status,
    title,
    description,
    total_price,
    total_materials_price,
    tax_rate,
    valid_until,
    notes
  ) = (
    (quote_data->>'customer_id')::UUID,
    NULLIF(quote_data->>'appointment_id', '')::UUID,
    quote_data->>'status',
    quote_data->>'title',
    quote_data->>'description',
    (quote_data->>'total_price')::NUMERIC,
    (quote_data->>'total_materials_price')::NUMERIC,
    (quote_data->>'tax_rate')::NUMERIC,
    NULLIF(quote_data->>'valid_until', '')::TIMESTAMP,
    quote_data->>'notes'
  )
  WHERE id = quote_id;
  
  -- Delete existing materials
  DELETE FROM quote_materials WHERE quote_id = quote_id;
  
  -- Insert materials if any provided
  IF jsonb_array_length(materials_data) > 0 THEN
    FOR material IN SELECT * FROM jsonb_array_elements(materials_data)
    LOOP
      INSERT INTO quote_materials (
        quote_id, 
        material_id, 
        quantity, 
        unit_price,
        name,
        unit
      ) VALUES (
        quote_id,
        (material->>'material_id')::UUID,
        (material->>'quantity')::NUMERIC,
        (material->>'unit_price')::NUMERIC,
        material->>'name',
        material->>'unit'
      );
    END LOOP;
  END IF;
  
  -- Return the updated quote with its materials
  SELECT jsonb_build_object(
    'quote', row_to_json(q)::JSONB,
    'materials', COALESCE(jsonb_agg(row_to_json(qm)::JSONB), '[]'::JSONB)
  ) INTO result
  FROM quotes q
  LEFT JOIN quote_materials qm ON qm.quote_id = q.id
  WHERE q.id = quote_id
  GROUP BY q.id;
  
  RETURN result;
END;
$$;
