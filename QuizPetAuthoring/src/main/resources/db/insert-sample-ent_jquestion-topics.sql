-- insert-sample-ent_jquestion-topics.sql
-- Purpose: create and seed sample topics for local QuizPetAuthoring testing.
-- Run with:
-- docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-ent_jquestion-topics.sql

USE webex21;

CREATE TABLE IF NOT EXISTS `ent_jquestion` (
  `QuestionID` INT NOT NULL AUTO_INCREMENT,
  `AuthorID` INT,
  `GroupID` INT,
  `Title` TEXT,
  `Description` TEXT,
  `Privacy` TINYINT DEFAULT 0,
  `domain` VARCHAR(100),
  PRIMARY KEY (`QuestionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Topic 1: used by existing sample quiz (quizId=1)
INSERT INTO `ent_jquestion` (`QuestionID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Privacy`, `domain`)
VALUES (
  1,
  1,
  1,
  'q_py_topic_expression_basics',
  'Expression basics topic for sample imported quiz.',
  0,
  'py'
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Privacy` = VALUES(`Privacy`),
  `domain` = VALUES(`domain`);

-- Topic 2: if statement
INSERT INTO `ent_jquestion` (`QuestionID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Privacy`, `domain`)
VALUES (
  2,
  1,
  1,
  'q_py_topic_if_statement',
  'Topic for Python if / else branch reasoning questions.',
  0,
  'py'
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Privacy` = VALUES(`Privacy`),
  `domain` = VALUES(`domain`);

-- Topic 3: loop
INSERT INTO `ent_jquestion` (`QuestionID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Privacy`, `domain`)
VALUES (
  3,
  1,
  1,
  'q_py_topic_loop',
  'Topic for Python loop and iteration questions.',
  0,
  'py'
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Privacy` = VALUES(`Privacy`),
  `domain` = VALUES(`domain`);

-- Topic 4: stack
INSERT INTO `ent_jquestion` (`QuestionID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Privacy`, `domain`)
VALUES (
  4,
  1,
  1,
  'q_py_topic_stack',
  'Topic for stack operations (push/pop/peek) and state tracing.',
  0,
  'py'
)
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Privacy` = VALUES(`Privacy`),
  `domain` = VALUES(`domain`);
