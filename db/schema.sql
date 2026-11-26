-- Yeewu Radar — schéma Postgres (Neon compatible). Idempotent.

create table if not exists clients (
  id          serial primary key,
  name        text not null,
  token       text not null unique,          -- lien d'accès privé du client : /c/<token>
  created_at  timestamptz not null default now()
);

create table if not exists brands (
  id          serial primary key,
  client_id   integer not null references clients(id) on delete cascade,
  name        text not null,
  is_own      boolean not null default false, -- true = la marque du client, false = concurrent
  color       text not null default '#1f6feb',
  keywords    text[] not null default '{}',   -- expressions recherchées (insensible aux accents/majuscules)
  excludes    text[] not null default '{}',   -- expressions qui disqualifient un article
  created_at  timestamptz not null default now()
);
create index if not exists brands_client_idx on brands(client_id);

create table if not exists mentions (
  id               bigserial primary key,
  client_id        integer not null references clients(id) on delete cascade,
  brand_id         integer not null references brands(id) on delete cascade,
  url              text not null,
  title            text not null,
  snippet          text not null default '',
  source           text not null default '',
  published_at     timestamptz not null,
  sentiment        smallint not null default 0,  -- -1 négatif, 0 neutre, 1 positif
  sentiment_method text not null default 'lexique',
  matched          text not null default '',
  created_at       timestamptz not null default now(),
  unique (brand_id, url)
);
create index if not exists mentions_client_date_idx on mentions(client_id, published_at desc);
create index if not exists mentions_brand_date_idx on mentions(brand_id, published_at desc);

create table if not exists leads (
  id          serial primary key,
  name        text not null,
  email       text not null,
  phone       text not null default '',
  company     text not null default '',
  message     text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists collect_runs (
  id              serial primary key,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  items_seen      integer not null default 0,
  mentions_added  integer not null default 0,
  errors          text not null default ''
);
