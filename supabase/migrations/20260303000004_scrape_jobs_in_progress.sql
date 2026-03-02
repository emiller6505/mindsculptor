-- Add 'in_progress' to scrape_jobs status constraint.
-- Required by the atomic claim step in parsers:
--   UPDATE scrape_jobs SET status='in_progress' WHERE status='pending'
-- This prevents two concurrent workers from double-processing the same job.
alter table scrape_jobs drop constraint chk_scrape_jobs_status;
alter table scrape_jobs add constraint chk_scrape_jobs_status
  check (status in ('pending', 'in_progress', 'parsed', 'failed', 'skipped'));
