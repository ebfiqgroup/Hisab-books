
DROP VIEW IF EXISTS public.admin_user_overview;
CREATE VIEW public.admin_user_overview AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.created_at,
  p.status,
  COALESCE(sum(CASE WHEN t.type = 'income'::txn_type THEN t.amount ELSE 0::numeric END), 0::numeric) AS total_income,
  COALESCE(sum(CASE WHEN t.type = 'expense'::txn_type THEN t.amount ELSE 0::numeric END), 0::numeric) AS total_expense,
  count(t.id) AS tx_count,
  EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role) AS is_admin
FROM profiles p
LEFT JOIN transactions t ON t.user_id = p.id
GROUP BY p.id;
