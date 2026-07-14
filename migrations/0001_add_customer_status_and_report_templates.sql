-- Migration: Add customer status fields and saved report templates
-- Applies: customerStatus, leadOrigin, state columns to customers; creates saved_report_templates table

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_status text DEFAULT 'pendente';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_origin text;

CREATE TABLE IF NOT EXISTS saved_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  name text NOT NULL,
  filters_json text NOT NULL DEFAULT '{}',
  columns_json text NOT NULL DEFAULT '[]',
  created_at timestamp DEFAULT now()
);
