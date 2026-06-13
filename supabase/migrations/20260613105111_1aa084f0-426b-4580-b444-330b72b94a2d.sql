
REVOKE EXECUTE ON FUNCTION public.is_account_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_account_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_member_to_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_owner(uuid) TO authenticated;
