-- Create documents table for Document Management System (DMS)
-- Supports folder structure: /Clients /Quotes /Invoices /Uploads /Notes /Comms
-- Stores document metadata only - PDFs generated on-demand

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  craftsman_id uuid NOT NULL,
  customer_id uuid NULL,
  appointment_id uuid NULL,
  quote_id bigint NULL,
  invoice_id uuid NULL,
  
  -- Document metadata
  title varchar(255) NOT NULL,
  description text NULL,
  tags text[] NULL,
  
  -- Folder organization
  folder_type varchar(20) NOT NULL CHECK (folder_type IN ('clients', 'quotes', 'invoices', 'uploads', 'notes', 'comms')),
  
  -- Document type and content
  document_type varchar(50) NOT NULL CHECK (document_type IN ('quote', 'invoice', 'note', 'communication', 'upload', 'client_info')),
  content_data jsonb NULL, -- Store document content/metadata for PDF generation
  
  -- Version control
  version integer NOT NULL DEFAULT 1,
  parent_document_id uuid NULL, -- for version history
  is_latest_version boolean NOT NULL DEFAULT true,
  
  -- Comments and notes
  notes text NULL,
  
  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_craftsman_id_fkey FOREIGN KEY (craftsman_id) REFERENCES craftsmen (id) ON DELETE CASCADE,
  CONSTRAINT documents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT documents_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
  CONSTRAINT documents_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE SET NULL,
  CONSTRAINT documents_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
  CONSTRAINT documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES documents (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Indexes for performance
CREATE INDEX idx_documents_craftsman ON public.documents USING btree (craftsman_id);
CREATE INDEX idx_documents_customer ON public.documents USING btree (customer_id);
CREATE INDEX idx_documents_appointment ON public.documents USING btree (appointment_id);
CREATE INDEX idx_documents_quote ON public.documents USING btree (quote_id);
CREATE INDEX idx_documents_invoice ON public.documents USING btree (invoice_id);
CREATE INDEX idx_documents_folder_type ON public.documents USING btree (folder_type);
CREATE INDEX idx_documents_document_type ON public.documents USING btree (document_type);
CREATE INDEX idx_documents_status ON public.documents USING btree (status);
CREATE INDEX idx_documents_tags ON public.documents USING gin (tags);
CREATE INDEX idx_documents_title ON public.documents USING btree (title);
CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at);
CREATE INDEX idx_documents_content_data ON public.documents USING gin (content_data);

-- Trigger for updated_at timestamp
CREATE TRIGGER documents_set_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION set_updated_at();

-- Function to handle version control
CREATE OR REPLACE FUNCTION handle_document_versioning()
RETURNS TRIGGER AS $$
BEGIN
  -- When updating a document with a new version, mark old versions as not latest
  IF TG_OP = 'INSERT' AND NEW.parent_document_id IS NOT NULL THEN
    UPDATE documents 
    SET is_latest_version = false 
    WHERE id = NEW.parent_document_id OR parent_document_id = NEW.parent_document_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version control
CREATE TRIGGER documents_handle_versioning 
  AFTER INSERT ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_document_versioning();
