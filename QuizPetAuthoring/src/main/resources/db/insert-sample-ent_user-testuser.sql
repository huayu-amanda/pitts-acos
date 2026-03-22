-- insert-sample-ent_user-testuser.sql
-- Purpose: insert/update local test account used by QuizPet login.
-- Notes:
-- 1) QuizPet validates password using PBKDF2 format: iterations:salt:hash
-- 2) The hash below corresponds to password: testpass
-- 3) Run with: docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-ent_user-testuser.sql

USE webex21;

INSERT INTO `ent_user` (`id`, `login`, `password`, `name`, `role`)
VALUES (
  1,
  'testuser',
  '1000:2785596d1d8e73c8b05fbf106958c9bea0c087db2c6e04f8:bdd900be49a927bd3bda0cbf2a99670a7c072721c3b4bb403',
  'Test User',
  'student'
)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `name` = VALUES(`name`),
  `role` = VALUES(`role`);
