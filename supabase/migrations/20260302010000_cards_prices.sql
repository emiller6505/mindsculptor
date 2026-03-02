-- Add price columns to cards table
alter table cards
  add column if not exists usd  numeric,
  add column if not exists tix  numeric;
