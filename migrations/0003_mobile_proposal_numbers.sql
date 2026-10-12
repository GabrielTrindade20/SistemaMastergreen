-- Run in a transaction before deploying the reader. No existing web number changes.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE quotations, mobile_quick_proposals IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE mobile_quick_proposals ADD COLUMN IF NOT EXISTS quotation_number text;

CREATE OR REPLACE FUNCTION assign_mastergreen_proposal_number() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE candidate text; attempts integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.quotation_number IS NOT NULL THEN
    IF NEW.quotation_number IS DISTINCT FROM OLD.quotation_number THEN
      RAISE EXCEPTION 'Proposal numbers are immutable';
    END IF;
    RETURN NEW;
  END IF;
  -- Serialize allocation across both sources, including concurrent web inserts.
  PERFORM pg_advisory_xact_lock(712026, 3);
  candidate := NEW.quotation_number;
  LOOP
    EXIT WHEN candidate IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM quotations WHERE quotation_number = candidate)
      AND NOT EXISTS (SELECT 1 FROM mobile_quick_proposals WHERE quotation_number = candidate);
    attempts := attempts + 1;
    IF attempts > 100 THEN RAISE EXCEPTION 'Unable to allocate proposal number'; END IF;
    candidate := '#' || lpad(floor(random() * 100000000)::bigint::text, 8, '0');
  END LOOP;
  NEW.quotation_number := candidate;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER assign_mobile_proposal_number
BEFORE INSERT OR UPDATE OF quotation_number ON mobile_quick_proposals
FOR EACH ROW EXECUTE FUNCTION assign_mastergreen_proposal_number();
CREATE OR REPLACE TRIGGER assign_web_proposal_number
BEFORE INSERT ON quotations
FOR EACH ROW EXECUTE FUNCTION assign_mastergreen_proposal_number();

UPDATE mobile_quick_proposals SET quotation_number = NULL WHERE quotation_number IS NULL;
ALTER TABLE mobile_quick_proposals ALTER COLUMN quotation_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mobile_quick_proposals_number_key ON mobile_quick_proposals (quotation_number);
