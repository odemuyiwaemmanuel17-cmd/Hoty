-- SUPERSEDED (Firebase migration): authorization now lives in firestore.rules +
-- functions/index.js (updateOrderStatus) + storage.rules. Kept as design record.
-- Hot & Appetizing — admin & order-management schema (Phase 5)
-- Extends 0001_commerce.sql. Apply AFTER 0001 in the same project.
-- Authorization is enforced HERE (RLS + is_admin()), never by hiding frontend routes.
-- Bootstrap an admin (run once with the service role / SQL editor):
--   select bootstrap_admin('owner@example.com');

-- ───────────────────────── admin identity ─────────────────────────
create table if not exists admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

-- One-time bootstrap helper (service role / SQL editor only; revoked below).
create or replace function bootstrap_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claims', true) is not null
     and not (auth.jwt() ->> 'role' in ('service_role','supabase_admin')) then
    raise exception 'bootstrap_admin requires the service role';
  end if;
  insert into admin_emails (email) values (lower(btrim(p_email))) on conflict do nothing;
end $$;
revoke all on function bootstrap_admin(text) from public, anon, authenticated;

-- is_admin(): compares the JWT email claim against the allow-list.
-- Browser storage cannot forge this — the JWT is signed by Supabase Auth.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in (select email from admin_emails),
    false
  );
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

-- ───────────────────── product lifecycle additions ─────────────────────
alter table products add column if not exists archived boolean not null default false;
alter table products add column if not exists updated_at timestamptz not null default now();

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();

-- Customers must not see archived products (history in orders stays intact via
-- order_items snapshots + the FK row that soft-delete preserves).
drop policy if exists "public read products" on products;
create policy "public read products" on products
  for select using (not archived);

-- ───────────────────── admin menu management (RLS) ─────────────────────
create policy "admin read all products" on products
  for select to authenticated using (is_admin());
create policy "admin insert products" on products
  for insert to authenticated with check (is_admin());
create policy "admin update products" on products
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete products" on products
  for delete to authenticated using (is_admin());

create policy "admin manage categories" on categories
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin manage option groups" on option_groups
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin manage product options" on product_options
  for all to authenticated using (is_admin()) with check (is_admin());

-- ───────────────────── order records: admin visibility ─────────────────────
-- Customers never read orders back (the ref in their WhatsApp message is their
-- receipt). Admins read through RLS, not the service key.
create policy "admin read orders" on orders
  for select to authenticated using (is_admin());
create policy "admin read order items" on order_items
  for select to authenticated using (is_admin());
create policy "admin read order item options" on order_item_options
  for select to authenticated using (is_admin());

-- ───────────────────── status transitions with history ─────────────────────
create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table order_status_history enable row level security;
create policy "admin read status history" on order_status_history
  for select to authenticated using (is_admin());

-- Valid transitions (mirrored + tested client-side in core/admin/orderStatus.ts):
--   pending_confirmation → confirmed | cancelled
--   confirmed  → preparing | cancelled
--   preparing  → ready | completed | cancelled
--   ready      → completed | cancelled
--   completed / cancelled → (terminal)
create or replace function can_transition(from_s text, to_s text)
returns boolean language sql immutable as $$
  select (from_s, to_s) in (values
    ('pending_confirmation','confirmed'), ('pending_confirmation','cancelled'),
    ('confirmed','preparing'),            ('confirmed','cancelled'),
    ('preparing','ready'),                ('preparing','completed'), ('preparing','cancelled'),
    ('ready','completed'),                ('ready','cancelled')
  );
$$;

create or replace function update_order_status(p_order uuid, p_to text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from text; begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select status into v_from from orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order not found');
  end if;
  if not can_transition(v_from, p_to) then
    return jsonb_build_object('ok', false, 'error',
      'invalid transition ' || v_from || ' -> ' || p_to, 'from', v_from);
  end if;
  update orders set status = p_to where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by)
    values (p_order, v_from, p_to, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to);
end $$;
revoke all on function update_order_status(uuid, text) from public;
grant execute on function update_order_status(uuid, text) to authenticated;

-- ─────────── admin dashboard aggregates (genuine records only) ───────────
create or replace view admin_order_metrics as
select
  count(*)                                            as total_orders,
  count(*) filter (where status = 'pending_confirmation') as pending,
  count(*) filter (where status = 'confirmed')        as confirmed,
  count(*) filter (where status = 'preparing')        as preparing,
  count(*) filter (where status = 'ready')            as ready,
  count(*) filter (where status = 'completed')        as completed,
  count(*) filter (where status = 'cancelled')        as cancelled,
  coalesce(sum(subtotal_kobo) filter (where status <> 'cancelled'), 0) as booked_subtotal_kobo
from orders;
grant select on admin_order_metrics to authenticated;

create or replace view admin_popular_products as
select oi.product_id, oi.product_name_snapshot, sum(oi.qty) as units
from order_items oi join orders o on o.id = oi.order_id
where o.status <> 'cancelled'
group by 1, 2 order by units desc limit 10;
grant select on admin_popular_products to authenticated;

-- ─────────────── fix 0001 gap: snapshot chosen options ───────────────
-- validate_checkout v2: identical math, but each line now carries option_ids
-- and option snapshots so create_order can persist order_item_options.
create or replace function validate_checkout(
  p_items jsonb, p_fulfillment text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_product products%rowtype;
  v_group option_groups%rowtype;
  v_opt product_options%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_unit bigint;
  v_qty int;
  v_opt_ids uuid[];
  v_chosen int;
  v_groups uuid[];
  v_oid uuid;
  v_delivery_fee bigint;
  v_opt_snaps jsonb;
begin
  if p_fulfillment not in ('pickup','delivery') then
    return jsonb_build_object('ok', false, 'issues', '["bad fulfillment"]'::jsonb);
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = (item->>'product_id')::uuid;
    if not found then
      v_issues := v_issues || jsonb_build_array('product not found'); continue;
    end if;
    if not v_product.available or v_product.archived then
      v_issues := v_issues || jsonb_build_array(v_product.name || ': unavailable'); continue;
    end if;
    v_qty := least(greatest((item->>'qty')::int, 1), 99);
    v_opt_ids := coalesce((item->'option_ids')::uuid[], '{}');
    v_unit := v_product.price_kobo;
    v_opt_snaps := '[]'::jsonb;

    select array_agg(g.id) into v_groups from option_groups g where g.product_id = v_product.id;
    v_groups := coalesce(v_groups, '{}');
    foreach v_group.id in array v_groups loop
      select count(*) into v_chosen
        from product_options o
        where o.group_id = v_group.id and o.id = any (v_opt_ids) and o.available;
      if v_chosen < v_group.min_selections then
        v_issues := v_issues || jsonb_build_array(v_product.name || ': ' || v_group.name || ' required');
      end if;
      if v_chosen > v_group.max_selections then
        v_issues := v_issues || jsonb_build_array(v_product.name || ': too many ' || v_group.name);
      end if;
    end loop;

    if exists (
      select 1 from product_options o
      where o.id = any (v_opt_ids) and o.group_id <> all (v_groups)
    ) then
      v_issues := v_issues || jsonb_build_array(v_product.name || ': invalid option selection');
    end if;

    foreach v_oid in array v_opt_ids loop
      select * into v_opt from product_options where id = v_oid;
      if found then
        v_unit := v_unit + v_opt.price_kobo;
        v_opt_snaps := v_opt_snaps || jsonb_build_object('id', v_opt.id, 'name', v_opt.name, 'price_kobo', v_opt.price_kobo);
        if exists (select 1 from product_options x
                   where x.id = any (v_opt_ids) and x.id = any (v_opt.incompatible_with)) then
          v_issues := v_issues || jsonb_build_array(v_product.name || ': incompatible options');
        end if;
      end if;
    end loop;

    v_subtotal := v_subtotal + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'key', v_product.id::text || '::' ||
             coalesce((select string_agg(x::text, '+' order by x) from unnest(v_opt_ids) x), ''),
      'product_id', v_product.id,
      'name', v_product.name,
      'qty', v_qty,
      'unit_kobo', v_unit,
      'subtotal_kobo', v_unit * v_qty,
      'option_ids', to_jsonb(v_opt_ids),
      'option_snapshots', v_opt_snaps
    );
  end loop;

  v_delivery_fee := null;
  if p_fulfillment = 'delivery'
     and to_regclass('public.fulfillment_settings') is not null then
    execute 'select setting_value_kobo from fulfillment_settings where key = ''delivery_fee_kobo'' limit 1'
      into v_delivery_fee;
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_issues) = 0,
    'issues', v_issues,
    'lines', v_lines,
    'subtotal_kobo', v_subtotal,
    'delivery_fee_kobo', v_delivery_fee
  );
end $$;

create or replace function create_order(
  p_items jsonb, p_fulfillment text,
  p_customer_name text default null, p_customer_contact text default null,
  p_notes text default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_check jsonb; v_order_id uuid; v_ref text; v_existing uuid;
  v_line jsonb; v_opt jsonb; v_item_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_existing from orders where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object('ok', true, 'order_ref',
        (select ref from orders where id = v_existing), 'duplicate', true);
    end if;
  end if;

  v_check := validate_checkout(p_items, p_fulfillment);
  if (v_check->>'ok') <> 'true' then
    return jsonb_build_object('ok', false, 'issues', v_check->'issues');
  end if;

  v_ref := 'HA-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text), 1, 4);
  insert into orders (ref, fulfillment, subtotal_kobo, delivery_fee_kobo,
                      customer_name, customer_contact, notes, idempotency_key)
  values (v_ref, p_fulfillment, (v_check->>'subtotal_kobo')::bigint,
          (v_check->>'delivery_fee_kobo')::bigint,
          p_customer_name, p_customer_contact, p_notes, p_idempotency_key)
  returning id into v_order_id;

  -- per-line item + option snapshots (names/prices frozen at order time)
  for v_line in select * from jsonb_array_elements(v_check->'lines') loop
    insert into order_items (order_id, product_id, product_name_snapshot, unit_kobo, qty)
    values (v_order_id, (v_line->>'product_id')::uuid, v_line->>'name',
            (v_line->>'unit_kobo')::bigint, (v_line->>'qty')::int)
    returning id into v_item_id;

    for v_opt in select * from jsonb_array_elements(v_line->'option_snapshots') loop
      insert into order_item_options (order_item_id, option_id, option_name_snapshot, price_kobo)
      values (v_item_id, (v_opt->>'id')::uuid, v_opt->>'name', (v_opt->>'price_kobo')::bigint)
      on conflict do nothing;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'order_ref', v_ref, 'order_id', v_order_id, 'duplicate', false);
end $$;

-- ───────────────────── product image storage ─────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict do nothing;

create policy "public read product images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "admin upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and is_admin());
create policy "admin update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and is_admin());
create policy "admin delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and is_admin());
