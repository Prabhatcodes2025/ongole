CREATE OR REPLACE FUNCTION public.enforce_locked_pg_room()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.security_deposit IS NULL THEN
    RAISE EXCEPTION 'Security deposit is required.'
      USING ERRCODE = '23502';
  END IF;

  IF NEW.security_deposit < 0 THEN
    RAISE EXCEPTION 'Security deposit cannot be negative.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;