-- Migration: DB trigger to maintain contact_count on contact_lists
-- Fires on INSERT/DELETE on contact_list_members to keep count accurate (LIST-05)

CREATE OR REPLACE FUNCTION update_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_lists
    SET contact_count = contact_count + 1,
        updated_at = now()
    WHERE id = NEW.contact_list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_lists
    SET contact_count = GREATEST(contact_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.contact_list_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_list_count_insert
AFTER INSERT ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();

CREATE TRIGGER trg_contact_list_count_delete
AFTER DELETE ON contact_list_members
FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();
