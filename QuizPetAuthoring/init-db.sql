-- Initialize databases required by QuizPetAuthoring
CREATE DATABASE IF NOT EXISTS portal_test2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS um2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS aggregate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS webex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS quizpet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user for the application (change password as needed)
CREATE USER IF NOT EXISTS 'quizpet'@'%' IDENTIFIED BY 'quizpet';
GRANT ALL PRIVILEGES ON portal_test2.* TO 'quizpet'@'%';
GRANT ALL PRIVILEGES ON um2.* TO 'quizpet'@'%';
GRANT ALL PRIVILEGES ON aggregate.* TO 'quizpet'@'%';
GRANT ALL PRIVILEGES ON webex.* TO 'quizpet'@'%';
GRANT ALL PRIVILEGES ON quizpet.* TO 'quizpet'@'%';
-- Also create webex21 because some code references `webex21`
CREATE DATABASE IF NOT EXISTS webex21 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON webex21.* TO 'quizpet'@'%';
FLUSH PRIVILEGES;

-- Minimal CREATE TABLE statements for required tables in each database
-- Databases: portal_test2, um2, aggregate, webex21, quizpet

-- ent_user
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_user` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`login` VARCHAR(100) DEFAULT NULL,
	`password` VARCHAR(255),
	`name` VARCHAR(255),
	`email` VARCHAR(255) DEFAULT NULL,
	`role` VARCHAR(50),
	PRIMARY KEY (`id`),
	UNIQUE KEY `uk_login` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_user` LIKE `portal_test2`.`ent_user`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_user` LIKE `portal_test2`.`ent_user`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_user` LIKE `portal_test2`.`ent_user`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_user` LIKE `portal_test2`.`ent_user`;
ALTER TABLE `portal_test2`.`ent_user` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `um2`.`ent_user` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `aggregate`.`ent_user` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `webex21`.`ent_user` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `quizpet`.`ent_user` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;

-- ent_jquestion
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_jquestion` (
	`QuestionID` INT NOT NULL AUTO_INCREMENT,
	`AuthorID` INT,
	`GroupID` INT,
	`Title` TEXT,
	`Description` TEXT,
	`Privacy` TINYINT DEFAULT 0,
	`domain` VARCHAR(100),
	PRIMARY KEY (`QuestionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_jquestion` LIKE `portal_test2`.`ent_jquestion`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_jquestion` LIKE `portal_test2`.`ent_jquestion`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_jquestion` LIKE `portal_test2`.`ent_jquestion`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_jquestion` LIKE `portal_test2`.`ent_jquestion`;

-- ent_jquiz
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_jquiz` (
	`QuizID` INT NOT NULL AUTO_INCREMENT,
	`AuthorID` INT,
	`GroupID` INT,
	`Title` VARCHAR(255),
	`Description` TEXT,
	`Code` LONGBLOB,
	`MinVar` INT,
	`MaxVar` INT,
	`AnsType` INT,
	`Privacy` TINYINT DEFAULT 0,
	`rdfID` VARCHAR(255),
	`QuesType` INT,
	`timestamp` INT,
	`rdfIdDisplay` VARCHAR(255),
	`version` INT,
	PRIMARY KEY (`QuizID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_jquiz` LIKE `portal_test2`.`ent_jquiz`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_jquiz` LIKE `portal_test2`.`ent_jquiz`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_jquiz` LIKE `portal_test2`.`ent_jquiz`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_jquiz` LIKE `portal_test2`.`ent_jquiz`;

-- rel_question_quiz
CREATE TABLE IF NOT EXISTS `portal_test2`.`rel_question_quiz` (
	`QuizID` INT NOT NULL,
	`QuestionID` INT NOT NULL DEFAULT 0,
	PRIMARY KEY (`QuizID`,`QuestionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`rel_question_quiz` LIKE `portal_test2`.`rel_question_quiz`;
CREATE TABLE IF NOT EXISTS `aggregate`.`rel_question_quiz` LIKE `portal_test2`.`rel_question_quiz`;
CREATE TABLE IF NOT EXISTS `webex21`.`rel_question_quiz` LIKE `portal_test2`.`rel_question_quiz`;
CREATE TABLE IF NOT EXISTS `quizpet`.`rel_question_quiz` LIKE `portal_test2`.`rel_question_quiz`;

-- rel_quiz_class
CREATE TABLE IF NOT EXISTS `portal_test2`.`rel_quiz_class` (
	`QuizID` INT NOT NULL,
	`ClassID` INT NOT NULL,
	PRIMARY KEY (`QuizID`,`ClassID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`rel_quiz_class` LIKE `portal_test2`.`rel_quiz_class`;
CREATE TABLE IF NOT EXISTS `aggregate`.`rel_quiz_class` LIKE `portal_test2`.`rel_quiz_class`;
CREATE TABLE IF NOT EXISTS `webex21`.`rel_quiz_class` LIKE `portal_test2`.`rel_quiz_class`;
CREATE TABLE IF NOT EXISTS `quizpet`.`rel_quiz_class` LIKE `portal_test2`.`rel_quiz_class`;

-- ent_class
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_class` (
	`ClassID` INT NOT NULL AUTO_INCREMENT,
	`ClassName` VARCHAR(255),
	`ClassType` VARCHAR(10),
	PRIMARY KEY (`ClassID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_class` LIKE `portal_test2`.`ent_class`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_class` LIKE `portal_test2`.`ent_class`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_class` LIKE `portal_test2`.`ent_class`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_class` LIKE `portal_test2`.`ent_class`;

-- ent_jquiz_concept
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_jquiz_concept` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`title` VARCHAR(255),
	`concept` TEXT,
	`class` INT,
	`sline` INT,
	`eline` INT,
	`weight` DOUBLE,
	`direction` VARCHAR(10),
	PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_jquiz_concept` LIKE `portal_test2`.`ent_jquiz_concept`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_jquiz_concept` LIKE `portal_test2`.`ent_jquiz_concept`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_jquiz_concept` LIKE `portal_test2`.`ent_jquiz_concept`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_jquiz_concept` LIKE `portal_test2`.`ent_jquiz_concept`;

-- ent_acos_grade (ingested grade events forwarded by acos-server)
CREATE TABLE IF NOT EXISTS `portal_test2`.`ent_acos_grade` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`attemptId` VARCHAR(128) NOT NULL,
	`quizId` INT NULL,
	`topicId` INT NULL,
	`rdfId` VARCHAR(255) NULL,
	`points` INT NULL,
	`maxPoints` INT NULL,
	`verdict` VARCHAR(32) NULL,
	`submittedAt` VARCHAR(64) NULL,
	`protocolUserId` VARCHAR(255) NULL,
	`protocolDataJson` LONGTEXT NULL,
	`rawJson` LONGTEXT NULL,
	`receivedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	UNIQUE KEY `uk_attemptId` (`attemptId`),
	KEY `idx_quizId` (`quizId`),
	KEY `idx_receivedAt` (`receivedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `um2`.`ent_acos_grade` LIKE `portal_test2`.`ent_acos_grade`;
CREATE TABLE IF NOT EXISTS `aggregate`.`ent_acos_grade` LIKE `portal_test2`.`ent_acos_grade`;
CREATE TABLE IF NOT EXISTS `webex21`.`ent_acos_grade` LIKE `portal_test2`.`ent_acos_grade`;
CREATE TABLE IF NOT EXISTS `quizpet`.`ent_acos_grade` LIKE `portal_test2`.`ent_acos_grade`;
FLUSH PRIVILEGES;
