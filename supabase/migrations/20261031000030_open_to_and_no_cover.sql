-- 0030 - "Open to" on the storefront; no more cover images
--
-- OPEN TO. The last page of the creator sign-up asks what the creator is open
-- to: "Paid collaborations" and/or "Long-term brand partnerships". Like the
-- barter and travel answers before 0082, it lived only in
-- `applications.profile`, which only admins read, so neither the storefront
-- nor the admin creator page could show it. It is copied onto `creators`
-- (public) the same way: existing creators are backfilled from their
-- application, new ones get it when approval links the application to the
-- account. Only the two known answers are kept.
--
-- COVER IMAGES. Creators no longer set a cover: the upload is gone from the
-- studio and the storefront never showed one. The "Cover image" step comes off
-- the profile checklist, so it no longer counts towards the percentage.
-- Covers already uploaded stay where they are and aren't shown anywhere.

begin;

alter table public.creators
  add column if not exists open_to text[] not null default '{}'
    check (open_to <@ array['Paid collaborations', 'Long-term brand partnerships']::text[]);

comment on column public.creators.open_to is
  'What the creator is open to, from the sign-up form: Paid collaborations and/or Long-term brand partnerships.';

-- The known answers from an application, in the order they were given.
create or replace function private.application_open_to(p_profile jsonb)
returns text[]
language sql
immutable
set search_path to ''
as $$
  select coalesce(array(
    select t.v
    from jsonb_array_elements_text(
           case when jsonb_typeof(p_profile -> 'open_to') = 'array' then p_profile -> 'open_to' else '[]'::jsonb end
         ) with ordinality as t(v, i)
    where t.v in ('Paid collaborations', 'Long-term brand partnerships')
    group by t.v
    order by min(t.i)
  ), '{}'::text[]);
$$;

-- ---------------------------------------------------------------- backfill --
-- The same application 0082 picked: the one approval linked, else the one
-- sent from their email.

update public.creators c
set open_to = private.application_open_to(src.profile)
from (
  select distinct on (cr.id) cr.id as creator_id, a.profile
  from public.creators cr
  join public.profiles pr on pr.id = cr.profile_id
  join public.applications a
    on a.role = 'creator'
   and (a.profile_id = cr.profile_id or (a.profile_id is null and lower(a.email) = lower(pr.email)))
  order by cr.id, (a.profile_id is not null) desc, (a.status = 'approved') desc, a.created_at desc
) src
where src.creator_id = c.id
  and c.open_to = '{}'::text[];

-- ------------------------------------------------------- carried at approval --
-- 0082's trigger function, now copying "open to" as well.

create or replace function private.copy_application_answers_to_creator()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_open_to text[] := private.application_open_to(new.profile);
begin
  update public.creators c
  set barter_stance = coalesce(private.application_barter_stance(new.profile), c.barter_stance),
      travel_scope  = coalesce(private.application_travel_scope(new.profile), c.travel_scope),
      open_to       = case when cardinality(v_open_to) > 0 then v_open_to else c.open_to end
  where c.profile_id = new.profile_id;
  return null;
end;
$$;

-- ----------------------------------------------- checklist without the cover --
-- 0029's checklist with the "Cover image" step taken out.

create or replace function public.get_creator_completion(p_creator_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_creator_id, private.my_creator_id());
  v_c public.creators;
  v_items jsonb;
  v_done int;
  v_total int;
begin
  select * into v_c from public.creators where id = v_id;
  if not found then
    return jsonb_build_object('percent', 0, 'items', '[]'::jsonb, 'can_publish', false);
  end if;
  if v_c.profile_id is distinct from auth.uid() and not private.is_admin() then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;

  v_items := jsonb_build_array(
    -- ---- required: enough to identify and review the creator ----------------
    jsonb_build_object('key', 'photo', 'label', 'Profile photo', 'required', true, 'done', v_c.profile_image_url is not null),
    jsonb_build_object('key', 'bio', 'label', 'Bio (40+ characters)', 'required', true, 'done', char_length(coalesce(v_c.bio, '')) >= 40),
    jsonb_build_object('key', 'location', 'label', 'City', 'required', true, 'done', v_c.city is not null),
    jsonb_build_object('key', 'languages', 'label', 'Languages you create in', 'required', true,
      'done', exists (select 1 from public.creator_languages l where l.creator_id = v_id)),
    jsonb_build_object('key', 'categories', 'label', 'At least one category', 'required', true,
      'done', exists (select 1 from public.creator_categories cc where cc.creator_id = v_id)),
    jsonb_build_object('key', 'creator_type', 'label', 'Creator type', 'required', true, 'done', v_c.creator_type is not null),
    jsonb_build_object('key', 'social', 'label', 'A social account', 'required', true,
      'done', exists (select 1 from public.creator_social_accounts s where s.creator_id = v_id)),

    -- ---- recommended: added from the dashboard after approval ---------------
    jsonb_build_object('key', 'intro_video', 'label', 'Intro video', 'required', false, 'done', v_c.intro_video_url is not null),
    jsonb_build_object('key', 'services', 'label', 'Your first service', 'required', false,
      'done', exists (select 1 from public.creator_services s where s.creator_id = v_id and s.active and s.archived_at is null)),
    jsonb_build_object('key', 'portfolio', 'label', '3+ portfolio pieces', 'required', false,
      'done', (select count(*) from public.portfolio_items p where p.creator_id = v_id and not p.is_hidden) >= 3),
    jsonb_build_object('key', 'demographics', 'label', 'Gender and age', 'required', false, 'done', v_c.gender is not null and v_c.age is not null),
    jsonb_build_object('key', 'addons', 'label', 'An add-on', 'required', false,
      'done', exists (select 1 from public.service_addons a join public.creator_services s on s.id = a.service_id
                      where s.creator_id = v_id and a.active))
  );

  select count(*) filter (where (x ->> 'done')::boolean), count(*)
  into v_done, v_total
  from jsonb_array_elements(v_items) x;

  return jsonb_build_object(
    'percent', round(v_done * 100.0 / v_total)::int,
    'items', v_items,
    'can_publish', not exists (
      select 1 from jsonb_array_elements(v_items) x
      where (x ->> 'required')::boolean and not (x ->> 'done')::boolean
    ),
    'status', v_c.status
  );
end;
$$;

commit;
