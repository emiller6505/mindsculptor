-- Card name alias table: links non-IP (MTGO) names to canonical (Scryfall) names
-- for Universes Beyond cards where MTGO uses different names than Scryfall.
create table card_name_aliases (
  alias       text primary key,
  canonical   text not null,
  oracle_id   text not null,
  source      text not null default 'scryfall_printed_name'
);

create index idx_card_name_aliases_canonical on card_name_aliases (canonical);

-- Replace lookup_card_prices to add alias fallback for non-IP names
create or replace function lookup_card_prices(p_names text[])
returns table(name text, usd numeric, tix numeric)
language sql stable
as $$
  (
    -- Direct matches
    select distinct on (c.name) c.name, c.usd, c.tix
    from cards c
    where c.name = any(p_names)
    order by c.name,
      (case when c.usd is not null then 0 else 1 end),
      (case when c.tix is not null then 0 else 1 end)
  )

  union all

  (
    -- Alias fallback: resolve non-IP names to their canonical (IP) name
    select distinct on (a.alias) a.alias as name, c.usd, c.tix
    from card_name_aliases a
    join cards c on c.name = a.canonical
    where a.alias = any(p_names)
      and a.alias not in (select c2.name from cards c2 where c2.name = any(p_names))
    order by a.alias,
      (case when c.usd is not null then 0 else 1 end),
      (case when c.tix is not null then 0 else 1 end)
  )
$$;
