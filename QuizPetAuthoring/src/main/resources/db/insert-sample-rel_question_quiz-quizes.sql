-- insert-sample-rel_question_quiz-quizs.sql
-- Purpose: create quiz-topic relations required by QuizService.getQuizById(topicId lookup).
-- Quiz-topic mappings:
--   Quiz 1 -> Topic 1
--   Quiz 2 -> Topic 2
--   Quiz 3 -> Topic 3
--   Quiz 4 -> Topic 2 (if statement)
--   Quiz 4 -> Topic 4 (stack)
-- Run with: docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-rel_question_quiz-quizs.sql

USE webex21;

-- Ensure topic row exists for QuestionID=1 (minimal fields).
INSERT INTO `ent_jquestion` (`QuestionID`, `AuthorID`, `GroupID`, `Title`, `Description`, `Privacy`, `domain`)
VALUES (1, 1, 1, 'Sample Topic', 'Sample topic for quiz relation', 0, 'py')
ON DUPLICATE KEY UPDATE
  `AuthorID` = VALUES(`AuthorID`),
  `GroupID` = VALUES(`GroupID`),
  `Title` = VALUES(`Title`),
  `Description` = VALUES(`Description`),
  `Privacy` = VALUES(`Privacy`),
  `domain` = VALUES(`domain`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (2, 2)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (3, 3)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (4, 2)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (4, 4)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);