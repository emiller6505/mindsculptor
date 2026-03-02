-- Remediation: remove non-competitive Topdeck events (prerelease, sealed, draft, 2HG, commander)
-- that were scraped before the isCompetitiveConstructed() filter was added.
--
-- Cascade chain (all ON DELETE CASCADE):
--   tournaments → decks → deck_cards
--                       → deck_archetypes
--
-- scrape_jobs rows are intentionally preserved: their source_url=TID entries prevent
-- the scraper from re-fetching these events on future runs.

-- Step 1: preview — inspect what will be deleted before committing
select id, name, format, date, source
from tournaments
where source = 'topdeck'
  and (
       name ilike '%prerelease%'
    or name ilike '%2 headed%'
    or name ilike '%2-headed%'
    or name ilike '%2hg%'
    or name ilike '%sealed%'
    or name ilike '%draft%'
    or name ilike '%commander%'
  )
order by name;

-- Step 2: delete (cascades to decks, deck_cards, deck_archetypes)
delete from tournaments
where source = 'topdeck'
  and (
       name ilike '%prerelease%'
    or name ilike '%2 headed%'
    or name ilike '%2-headed%'
    or name ilike '%2hg%'
    or name ilike '%sealed%'
    or name ilike '%draft%'
    or name ilike '%commander%'
  );
