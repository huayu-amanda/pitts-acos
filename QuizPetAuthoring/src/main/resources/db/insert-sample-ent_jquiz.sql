-- insert-sample-ent_jquiz.sql
-- Creates a sample ent_jquiz row in `webex21.ent_jquiz` for local testing.
-- Run with: mysql -u quizpet -p < insert-sample-ent_jquiz.sql

USE webex21;

INSERT INTO `ent_jquiz` (
  `AuthorID`, `GroupID`, `Title`, `Description`, `Code`, `MinVar`, `MaxVar`, `AnsType`, `Privacy`, `rdfID`, `QuesType`, `timestamp`, `rdfIdDisplay`, `version`
) VALUES (
  1,
  1,
  'q_py_sample',
  'Sample quiz with placeholders for testing parser and editor',
  -- multi-line Python code stored as string literal
  '"""\n# Tester.py - sample quiz code with placeholders\nimport random\n\n\ndef compute(a, b):\n    # placeholders: ${X}, ${Y}, ${OFFSET}  (example syntax)\n    return ${X} * ${Y} + ${OFFSET}\n\nif __name__ == "__main__":\n    # Example invocation with placeholders that should be replaced by the engine\n    print(compute(${X}, ${Y}))\n""',
  1,
  5,
  1,
  0,
  'sample_rdf',
  1,
  UNIX_TIMESTAMP(),
  'q_py_sample',
  1
);

-- Note:
-- - This script assumes a `webex21.ent_jquiz` table exists (see init-db.sql).
-- - The `Code` column is stored here as a text literal; adjust quoting/escaping
--   if your MySQL client or server requires different handling.
-- - Placeholder syntax used here is "${...}" as an illustrative example; adapt
--   to the actual placeholder conventions used by your editor/parser if needed.
