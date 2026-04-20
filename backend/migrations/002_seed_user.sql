-- Seed one local user (no signup API). Edit email/password_hash if you need different credentials.
-- Default login: email you@local.dev  password changeme
-- Regenerate hash from backend: node -e "import('bcrypt').then(m=>m.default.hash('yourpassword',11).then(console.log))"

INSERT INTO users (id, email, password_hash)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  'you@local.dev',
  '$2b$11$28lQKpJd4PJm4VyMPvvK9uyDb9fgx3LywR/Kibny6/Uxrsha3jJ1K'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE id = '00000000-0000-4000-8000-000000000001'::uuid
);

INSERT INTO user_profiles (user_id)
SELECT '00000000-0000-4000-8000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = '00000000-0000-4000-8000-000000000001'::uuid
);
