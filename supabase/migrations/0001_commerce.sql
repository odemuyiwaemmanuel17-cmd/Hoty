-- SUPERSEDED (Firebase migration): this project now uses Firestore + Cloud
-- Functions (firestore.rules, functions/index.js). Kept as the design record.
-- Hot & Appetizing — commerce schema (Phase 4)
-- UUID PKs/FKs, integer kobo money, RLS, public-read vs privileged writes,
-- server-authoritative checkout validation and idempotent order creation.
-- Apply with `supabase db push` / the dashboard SQL editor against YOUR project.
-- (Not applied here: no Supabase project is connected to this workspace.)

create extension if not exists "pgcrypto";

-- ─────────────────────────── tables ───────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  unique (name)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price_kobo bigint not null check (price_kobo >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  available boolean not null default true,
  image_url text,
  model_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index products_category_idx on products (category_id, position);
create index products_available_idx on products (available) where available;

-- option groups: required/min/max constraints per product
create table option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  min_selections int not null default 0 check (min_selections >= 0),
  max_selections int not null default 1 check (max_selections >= min_selections),
  position int not null default 0
);
create index option_groups_product_idx on option_groups (product_id, position);

create table product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references option_groups(id) on delete cascade,
  name text not null,
  price_kobo bigint not null default 0 check (price_kobo >= 0),
  asset_key text,
  incompatible_with uuid[] not null default '{}',
  available boolean not null default true,
  unique (group_id, name)
);

-- orders / items / chosen options (immutable snapshots for auditability)
create table orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,               -- human-friendly, e.g. HA-20261011-0007
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','confirmed','preparing','ready','completed','cancelled')),
  fulfillment text not null check (fulfillment in ('pickup','delivery')),
  delivery_fee_kobo bigint check (delivery_fee_kobo is null or delivery_fee_kobo >= 0),
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  customer_name text,
  customer_contact text,
  notes text,
  idempotency_key text unique,            -- replay/duplicate protection
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name_snapshot text not null,
  unit_kobo bigint not null check (unit_kobo >= 0),
  qty int not null check (qty between 1 and 99)
);
create index order_items_order_idx on order_items (order_id);

create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  option_id uuid not null references product_options(id),
  option_name_snapshot text not null,
  price_kobo bigint not null check (price_kobo >= 0),
  unique (order_item_id, option_id)
);

-- ─────────────────────── RLS + least privilege ───────────────────────
alter table categories enable row level security;
alter table products enable row level security;
alter table option_groups enable row level security;
alter table product_options enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_options enable row level security;

-- public menu reads (anon)
create policy "public read categories" on categories for select using (true);
create policy "public read products" on products for select using (true);
create policy "public read option groups" on option_groups for select using (true);
create policy "public read product options" on product_options for select using (true);

-- NO insert/update/delete policies for anon on any table:
-- menu management and order management go through privileged roles
-- (service_role or a dashboard-authenticated role), never the browser key.

-- ─────────────── server-authoritative checkout validation ───────────────
-- Returns validated lines + authoritative totals. Never trusts client prices.
create or replace function validate_checkout(
  p_items jsonb,           -- [{product_id, qty, option_ids:[...]}]
  p_fulfillment text       -- 'pickup' | 'delivery'
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
begin
  if p_fulfillment not in ('pickup','delivery') then
    return jsonb_build_object('ok', false, 'issues', '["bad fulfillment"]'::jsonb);
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = (item->>'product_id')::uuid;
    if not found then
      v_issues := v_issues || jsonb_build_array('product not found'); continue;
    end if;
    if not v_product.available then
      v_issues := v_issues || jsonb_build_array(v_product.name || ': unavailable'); continue;
    end if;
    v_qty := least(greatest((item->>'qty')::int, 1), 99);
    v_opt_ids := coalesce((item->'option_ids')::uuid[], '{}');
    v_unit := v_product.price_kobo;

    -- validate every selectable group of this product
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

    -- reject options not belonging to this product
    if exists (
      select 1 from product_options o
      where o.id = any (v_opt_ids)
        and o.group_id <> all (v_groups)
    ) then
      v_issues := v_issues || jsonb_build_array(v_product.name || ': invalid option selection');
    end if;

    -- incompatibility + price sum from server data
    foreach v_oid in array v_opt_ids loop
      select * into v_opt from product_options where id = v_oid;
      if found then
        v_unit := v_unit + v_opt.price_kobo;
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
      'subtotal_kobo', v_unit * v_qty
    );
  end loop;

  -- configured fulfillment charges (null until the restaurant configures one)
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

revoke all on function validate_checkout(jsonb, text) from public;
grant execute on function validate_checkout(jsonb, text) to anon, authenticated;

-- ─────────────── intentional, idempotent order creation ───────────────
-- Creating an order record is a deliberate action (NOT opening WhatsApp).
create or replace function create_order(
  p_items jsonb,
  p_fulfillment text,
  p_customer_name text default null,
  p_customer_contact text default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_check jsonb;
  v_order_id uuid;
  v_ref text;
  v_existing uuid;
begin
  if p_idempotency_key is not null then
    select id into v_existing from orders where idempotency_key = p_idempotency_key;
    if v_existing found then
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

  insert into order_items (order_id, product_id, product_name_snapshot, unit_kobo, qty)
  select v_order_id, (l->>'product_id')::uuid, l->>'name',
         (l->>'unit_kobo')::bigint, (l->>'qty')::int
  from jsonb_array_elements(v_check->'lines') l;

  return jsonb_build_object('ok', true, 'order_ref', v_ref, 'order_id', v_order_id, 'duplicate', false);
end $$;

revoke all on function create_order(jsonb, text, text, text, text, text) from public;
-- Browser may create 'pending_confirmation' drafts only; management stays privileged.
grant execute on function create_order(jsonb, text, text, text, text, text) to anon, authenticated;

-- NOTE: `fulfillment_settings` is optional. Without it, remove that block and
-- delivery_fee_kobo stays NULL → UI must show "pending confirmation".
-- Order management (status changes, price edits): service_role only via
-- service keys held server-side — never in frontend code.
