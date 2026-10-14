-- ============================================================
-- EstimatorPro — Keep task tender identity aligned with its request
-- ============================================================
-- Request is the source of truth for tender identity:
-- subject, Sales PIC (request_by), customer, and end user.
-- The tasks table has no tender_code column; the application always resolves
-- EP Code from the linked request. Task retains only operational/execution
-- fields such as subject_task, location, scope, priority, target date,
-- category, and pipeline status.

CREATE OR REPLACE FUNCTION public.sync_task_request_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks AS t
     SET subject_request = NEW.subject,
         request_by = NEW.request_by,
         customer = NEW.customer,
         end_user = NEW.end_user,
         updated_at = now()
   WHERE t.request_id = NEW.id
     AND (
       t.subject_request IS DISTINCT FROM NEW.subject
       OR t.request_by IS DISTINCT FROM NEW.request_by
       OR t.customer IS DISTINCT FROM NEW.customer
       OR t.end_user IS DISTINCT FROM NEW.end_user
     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_task_request_identity_on_request_update ON public.requests;
CREATE TRIGGER sync_task_request_identity_on_request_update
  AFTER UPDATE OF subject, request_by, customer, end_user ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.subject IS DISTINCT FROM NEW.subject
    OR OLD.request_by IS DISTINCT FROM NEW.request_by
    OR OLD.customer IS DISTINCT FROM NEW.customer
    OR OLD.end_user IS DISTINCT FROM NEW.end_user
  )
  EXECUTE FUNCTION public.sync_task_request_identity();

-- Repair existing rows once so previously created tasks use their request's
-- current tender identity. This does not alter task execution fields.
UPDATE public.tasks AS t
   SET subject_request = r.subject,
       request_by = r.request_by,
       customer = r.customer,
       end_user = r.end_user,
       updated_at = now()
  FROM public.requests AS r
 WHERE t.request_id = r.id
   AND (
     t.subject_request IS DISTINCT FROM r.subject
     OR t.request_by IS DISTINCT FROM r.request_by
     OR t.customer IS DISTINCT FROM r.customer
     OR t.end_user IS DISTINCT FROM r.end_user
   );

REVOKE ALL ON FUNCTION public.sync_task_request_identity() FROM PUBLIC, anon, authenticated;
