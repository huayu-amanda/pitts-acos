-- insert-sample-ent_jquizes.sql
-- Purpose: insert/update sample quiz rows (QuizID=1,2,3) for local integration testing.
-- Quiz 1: expression basics (existing sample)
-- Quiz 2: if-statement topic sample
-- Quiz 3: loop topic sample
-- Quiz 4: stack + if/else topic sample
-- Run with: docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-ent_jquizes.sql

USE quizpet;

INSERT INTO `ent_jquiz` (
  `QuizID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Code`, `MinVar`, `MaxVar`, `AnsType`, `Privacy`, `rdfID`, `QuesType`, `timestamp`, `rdfIdDisplay`, `version`
) VALUES (
  900,
  1,
  1,
  'q_py_sample',
  'Expression basics practice with random parameters. Task: Write exactly what this program prints.',
  '# tester.py\ndef compute(a, b):\n    # placeholders: ${X}, ${Y}, ${OFFSET}\n    return a * b + ${OFFSET}\n\nprint(compute(${X}, ${Y}))\n',
  1,
  5,
  1,
  0,
  'q_py_sample_',
  1,
  1769487109,
  'q_py_sample',
  1
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Code` = VALUES(`Code`),
  `MinVar` = VALUES(`MinVar`),
  `MaxVar` = VALUES(`MaxVar`),
  `AnsType` = VALUES(`AnsType`),
  `Privacy` = VALUES(`Privacy`),
  `rdfID` = VALUES(`rdfID`),
  `QuesType` = VALUES(`QuesType`),
  `timestamp` = VALUES(`timestamp`),
  `rdfIdDisplay` = VALUES(`rdfIdDisplay`),
  `version` = VALUES(`version`);

INSERT INTO `ent_jquiz` (
  `QuizID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Code`, `MinVar`, `MaxVar`, `AnsType`, `Privacy`, `rdfID`, `QuesType`, `timestamp`, `rdfIdDisplay`, `version`
) VALUES (
  901,
  1,
  1,
  'q_py_if_branch',
  'If statement practice with random parameters. Task: Write exactly what this program prints (including uppercase words and spaces).',
  '# if_statement.py\nscore = ${SCORE}\nbonus = ${BONUS}\nthreshold = ${THRESHOLD}\n\ntotal = score + bonus\nif total >= threshold:\n    print("PASS", total)\nelse:\n    print("RETRY", total)\n',
  1,
  9,
  1,
  0,
  'q_py_if_branch_',
  1,
  1769487110,
  'q_py_if_branch',
  1
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Code` = VALUES(`Code`),
  `MinVar` = VALUES(`MinVar`),
  `MaxVar` = VALUES(`MaxVar`),
  `AnsType` = VALUES(`AnsType`),
  `Privacy` = VALUES(`Privacy`),
  `rdfID` = VALUES(`rdfID`),
  `QuesType` = VALUES(`QuesType`),
  `timestamp` = VALUES(`timestamp`),
  `rdfIdDisplay` = VALUES(`rdfIdDisplay`),
  `version` = VALUES(`version`);

INSERT INTO `ent_jquiz` (
  `QuizID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Code`, `MinVar`, `MaxVar`, `AnsType`, `Privacy`, `rdfID`, `QuesType`, `timestamp`, `rdfIdDisplay`, `version`
) VALUES (
  902,
  1,
  1,
  'q_py_loop_sum',
  'Loop practice with controlled parameters. Task: Write the final printed value after the loop (loop always runs at least once).',
  '# loop_sum.py\nstart = ${START}\nstep = ${STEP}\ncount = ${COUNT}\nend = start + step * count\ntotal = 0\n\nfor i in range(start, end, step):\n    total += i\n\nprint(total)\n',
  1,
  10,
  1,
  0,
  'q_py_loop_sum_',
  1,
  1769487111,
  'q_py_loop_sum',
  1
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Code` = VALUES(`Code`),
  `MinVar` = VALUES(`MinVar`),
  `MaxVar` = VALUES(`MaxVar`),
  `AnsType` = VALUES(`AnsType`),
  `Privacy` = VALUES(`Privacy`),
  `rdfID` = VALUES(`rdfID`),
  `QuesType` = VALUES(`QuesType`),
  `timestamp` = VALUES(`timestamp`),
  `rdfIdDisplay` = VALUES(`rdfIdDisplay`),
  `version` = VALUES(`version`);

INSERT INTO `ent_jquiz` (
  `QuizID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Code`, `MinVar`, `MaxVar`, `AnsType`, `Privacy`, `rdfID`, `QuesType`, `timestamp`, `rdfIdDisplay`, `version`
) VALUES (
  903,
  1,
  1,
  'q_py_stack_if_result',
  'Stack + if/else practice with random threshold. Task: Write the final value of result.',
  '# stack_if_result.py\nfrom stack import Stack\ns = Stack()\ns.push(10)\ns.push(20)\ns.push(30)\n\nif s.peek() > ${THRESHOLD}:\n    s.pop()\nelse:\n    s.push(99)\n\nresult = s.peek()\nprint(result)\n',
  25,
  55,
  1,
  0,
  'q_py_stack_if_result_',
  1,
  1769487112,
  'q_py_stack_if_result',
  1
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Code` = VALUES(`Code`),
  `MinVar` = VALUES(`MinVar`),
  `MaxVar` = VALUES(`MaxVar`),
  `AnsType` = VALUES(`AnsType`),
  `Privacy` = VALUES(`Privacy`),
  `rdfID` = VALUES(`rdfID`),
  `QuesType` = VALUES(`QuesType`),
  `timestamp` = VALUES(`timestamp`),
  `rdfIdDisplay` = VALUES(`rdfIdDisplay`),
  `version` = VALUES(`version`);
