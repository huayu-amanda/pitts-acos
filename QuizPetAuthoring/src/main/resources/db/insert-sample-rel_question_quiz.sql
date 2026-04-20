-- insert-sample-rel_question_quiz-quizs.sql
-- Purpose: create quiz-topic relations required by QuizService.getQuizById(topicId lookup).
-- Quiz-topic mappings:
--   Quiz 900 -> Topic 900
--   Quiz 901 -> Topic 901
--   Quiz 902 -> Topic 902
--   Quiz 903 -> Topic 901 (if statement)
--   Quiz 903 -> Topic 903 (stack)
-- Run with: docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-rel_question_quiz-quizs.sql

USE quizpet;

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (900, 900)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (901, 901)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (902, 902)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (903, 901)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);

INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (903, 903)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);