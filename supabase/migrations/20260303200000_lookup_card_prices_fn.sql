-- Returns one row per card name with the best available price.
-- Prioritizes printings that have non-null usd/tix prices.
-- Accepts up to thousands of names safely (no row-limit issues).
create or replace function lookup_card_prices(p_names text[])
returns table(name text, usd numeric, tix numeric)
language sql stable
as $$
  select distinct on (c.name)
    c.name,
    c.usd,
    c.tix
  from cards c
  where c.name = any(p_names)
  order by c.name,
    -- prefer rows that have prices over those that don't
    (case when c.usd is not null then 0 else 1 end),
    (case when c.tix is not null then 0 else 1 end)
$$;
