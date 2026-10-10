-- Apply in Supabase SQL Editor as database owner. Atomic, rerunnable migration.
BEGIN;
LOCK TABLE public.requests, public.tasks IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.task_inherit_request_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE parent public.requests%ROWTYPE;
BEGIN
  IF NEW.request_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.requests WHERE id = NEW.request_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task request_id has no parent Request'; END IF;
  NEW.subject_request := parent.subject;
  NEW.customer := parent.customer;
  NEW.end_user := parent.end_user;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.task_inherit_request_identity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.request_propagate_task_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.tasks SET subject_request = NEW.subject, customer = NEW.customer, end_user = NEW.end_user
  WHERE request_id = NEW.id AND
    (subject_request IS DISTINCT FROM NEW.subject OR customer IS DISTINCT FROM NEW.customer OR end_user IS DISTINCT FROM NEW.end_user);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.request_propagate_task_identity() FROM PUBLIC;

DROP TRIGGER IF EXISTS task_inherit_request_identity ON public.tasks;
CREATE TRIGGER task_inherit_request_identity BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.task_inherit_request_identity();
DROP TRIGGER IF EXISTS request_propagate_task_identity ON public.requests;
CREATE TRIGGER request_propagate_task_identity AFTER UPDATE OF subject, customer, end_user ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.request_propagate_task_identity();

UPDATE public.tasks t SET subject_request = r.subject, customer = r.customer, end_user = r.end_user
FROM public.requests r WHERE t.request_id = r.id AND
(t.subject_request IS DISTINCT FROM r.subject OR t.customer IS DISTINCT FROM r.customer OR t.end_user IS DISTINCT FROM r.end_user);
COMMIT;
