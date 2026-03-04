CREATE TABLE oracle_queries (
  user_id   uuid    NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date      date    NOT NULL DEFAULT CURRENT_DATE,
  count     integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, date)
);
