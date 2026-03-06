-- Fix lookup_card_prices statement timeout on large name lists.
-- The previous UNION ALL with NOT IN subquery caused Postgres to re-scan
-- the cards table redundantly. Rewrite with a CTE so the direct-match scan
-- happens once and the alias branch uses NOT EXISTS against it.

create or replace function lookup_card_prices(p_names text[])
returns table(name text, usd numeric, tix numeric)
language sql stable
as $$
  with direct as (
    select distinct on (c.name) c.name, c.usd, c.tix
    from cards c
    where c.name = any(p_names)
    order by c.name,
      (case when c.usd is not null then 0 else 1 end),
      (case when c.tix is not null then 0 else 1 end)
  ),
  via_alias as (
    select distinct on (a.alias) a.alias as name, c.usd, c.tix
    from card_name_aliases a
    join cards c on c.name = a.canonical
    where a.alias = any(p_names)
      and not exists (select 1 from direct d where d.name = a.alias)
    order by a.alias,
      (case when c.usd is not null then 0 else 1 end),
      (case when c.tix is not null then 0 else 1 end)
  )
  select * from direct
  union all
  select * from via_alias
$$;
