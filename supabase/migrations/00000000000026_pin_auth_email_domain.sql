-- Bucket My Money: rename PIN-only auth.users emails to the new internal domain.
-- Safe to re-run: only rows still on the legacy suffix are updated.

UPDATE auth.users
SET
  email = replace(email, '@pin.bucketfund.internal', '@pin.bucketmymoney.internal'),
  updated_at = now()
WHERE email LIKE '%@pin.bucketfund.internal';
