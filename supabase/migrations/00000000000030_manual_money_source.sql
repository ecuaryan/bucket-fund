-- =====================================================================
-- Manual money sources: accounts rows with no Teller link.
-- =====================================================================

alter table public.accounts
  add column source text not null default 'teller'
    check (source in ('teller', 'manual'));

alter table public.accounts
  alter column teller_account_id drop not null;

alter table public.accounts
  drop constraint accounts_family_id_teller_account_id_key;

create unique index accounts_family_teller_account_id_key
  on public.accounts (family_id, teller_account_id)
  where teller_account_id is not null;

create or replace function public.is_cash_account_type(p_type text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_type, '')) in (
    'checking',
    'savings',
    'money_market',
    'certificate_of_deposit',
    'cash_management',
    'treasury',
    'manual'
  );
$$;
