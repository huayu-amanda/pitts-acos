-- insert-sample-rel_question_quiz-topics.sql
-- Purpose: maintain sample quiz-topic relations used by getQuizById(topicId lookup).
-- Run with:
-- docker exec -i quizpet-mysql mariadb -uroot -prootpassword < insert-sample-rel_question_quiz-topics.sql

USE webex21;

CREATE TABLE IF NOT EXISTS `rel_question_quiz` (
  `QuizID` INT NOT NULL,
  `QuestionID` INT NOT NULL,
  PRIMARY KEY (`QuizID`, `QuestionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing sample quiz: quizId=1 belongs to topicId=1
INSERT INTO `rel_question_quiz` (`QuizID`, `QuestionID`)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE
  `QuestionID` = VALUES(`QuestionID`);
