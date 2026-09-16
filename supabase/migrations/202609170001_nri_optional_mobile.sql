-- NRI enquiries may be submitted without a phone number; both Indian and
-- international numbers remain validated when present. Structured NRI phone
-- details and consent are retained in the existing attribution JSONB column.
alter table public.enquiries alter column mobile drop not null;
alter table public.enquiries drop constraint if exists enquiries_mobile_check;
alter table public.enquiries add constraint enquiries_mobile_check check (
  mobile is null or mobile ~ '^[6-9][0-9]{9}$' or mobile ~ '^\+[1-9][0-9]{6,14}$'
);
