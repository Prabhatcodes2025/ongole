-- PostgreSQL requires a newly added enum value to be committed before dependent SQL uses it.
alter type public.property_status add value if not exists 'expired' after 'published';
