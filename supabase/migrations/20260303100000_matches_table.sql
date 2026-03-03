create table matches (
  id              bigint generated always as identity primary key,
  tournament_id   text not null references tournaments (id) on delete cascade,
  round           int not null,
  player_a        text not null,
  player_b        text,
  winner          text,
  deck_a_id       text references decks (id) on delete set null,
  deck_b_id       text references decks (id) on delete set null,
  is_bye          boolean not null default false,
  is_draw         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_matches_tournament on matches (tournament_id);
create index idx_matches_deck_a on matches (deck_a_id) where deck_a_id is not null;
create index idx_matches_deck_b on matches (deck_b_id) where deck_b_id is not null;

-- Prevent duplicate match records
create unique index idx_matches_dedup on matches (tournament_id, round, player_a);
