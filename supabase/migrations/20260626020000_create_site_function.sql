create or replace function public.create_site(
  name text,
  domain text,
  primary_color text
)
returns public.sites
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.sites;
begin
  insert into public.sites (user_id, name, allowed_domains, primary_color)
  values (
    (select id from public.users where auth_user_id = auth.uid()),
    name,
    array[domain],
    primary_color
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function public.create_site(text, text, text) to authenticated;
