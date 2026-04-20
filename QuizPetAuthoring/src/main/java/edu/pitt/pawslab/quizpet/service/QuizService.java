package edu.pitt.pawslab.quizpet.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.pitt.pawslab.quizpet.database.WebexDatabase;
import edu.pitt.pawslab.quizpet.instance.Quiz;
import edu.pitt.pawslab.quizpet.instance.QuizCollection;
import edu.pitt.pawslab.quizpet.instance.ServerMessage;
import edu.pitt.pawslab.quizpet.instance.SiteUser;

@Service
public class QuizService {
	
	@Autowired
	private WebexDatabase webexDatabase;
	@Autowired
	private ExternalClassService externalClassService;
	@Autowired
	private UserService userService;
	
	/*
	 * this method returns if this rdfid is available
	 */
	public ServerMessage isRdfIdAvailable(StringBuilder rdfId){
		ServerMessage result = new ServerMessage();
		Integer idCount = webexDatabase.rdfIdCount(rdfId);
		if(idCount == 0){
			result.setSuccess(true);
			result.setMessage(new StringBuilder("This rdfid is usable"));
		}else{
			result.setSuccess(false);
			result.setMessage(new StringBuilder("This rdfid is already used."));
		}
		return result;
	}
	
	/*
	 * this method returns python questions search result
	 */
	public ArrayList<Quiz> titleBlurSearch(StringBuilder keyword){
		SiteUser cUser = userService.getCurrentUser();		
		//QuizCollection quizCollection = new QuizCollection(webexDatabase.blurSearch(keyword, cUser.getId()));
		QuizCollection quizCollection = new QuizCollection(webexDatabase.blurSearch(keyword, cUser.getId()));
		return new ArrayList<Quiz>(quizCollection.getUniqueCollection().values());
	}
	
	/*
	 * this method returns one python question according to its id
	 */
	public ServerMessage getQuizById(Integer quizId) {
		System.out.println("[QuizService.getQuizById] ENTER, quizId = " + quizId);
		ServerMessage serverMessage = new ServerMessage();
		try {
			if (webexDatabase.ifQuizIdExists(quizId) > 0) {
				System.out.println("[QuizService.getQuizById] quizId exists: " + quizId);

				Quiz rs = webexDatabase.getQuizById(quizId);
				System.out.println("[QuizService.getQuizById] getQuizById returned: " + rs);

				// 原来的逻辑：直接使用 rs，不做 null 检查
				rs.setTopicId(webexDatabase.getTopicIdByQuiz(quizId));
				// Also expose domain from ent_jquestion so downstream load-quiz consumers can
				// choose the correct language package (java vs python) without guessing.
				rs.setDomain(webexDatabase.getQuestionDomainByQuiz(quizId));
				System.out.println("[QuizService.getQuizById] topic info loaded.");

				serverMessage.setSuccess(true);
				serverMessage.setContent(new Object[]{rs});
			} else {
				System.out.println("[QuizService.getQuizById] quizId does NOT exist: " + quizId);

				serverMessage.setSuccess(false);
				serverMessage.setMessage(new StringBuilder("No such quiz id."));
			}

			System.out.println("[QuizService.getQuizById] EXIT, success = " + serverMessage.isSuccess());
			return serverMessage;

		} catch (Exception e) {
			System.out.println("[QuizService.getQuizById] EXCEPTION for quizId = " + quizId);
			e.printStackTrace();   // 把真正的异常栈打到 stdout，docker logs 能看到

			serverMessage.setSuccess(false);
			serverMessage.setMessage(new StringBuilder(
					"Exception in getQuizById: " + e.getClass().getSimpleName() + " - " + e.getMessage()
			));
			System.out.println("[QuizService.getQuizById] EXIT WITH EXCEPTION, success = " + serverMessage.isSuccess());
			return serverMessage;
		}
	}
	
	/*
	 * this method adds a new quiz to the database
	 */
	public ServerMessage newQuiz(Quiz quiz){
		ServerMessage serverMessage = new ServerMessage();
		ServerMessage isRdfidAvailable = this.isRdfIdAvailable(quiz.getRdfId());
		if(isRdfidAvailable.isSuccess()){
			userService.addAuthorInfoToQuiz(quiz);
			//the rdfid is usable
			Quiz quizInDb = webexDatabase.newQuiz(quiz);
			serverMessage.setSuccess(true);
			serverMessage.setMessage(new StringBuilder("Quiz Created."));
			serverMessage.setContent(new Object[]{quizInDb});
			return serverMessage;
		}
		return isRdfidAvailable;
	}
	
	/*
	 * this method updates one quiz's related classes
	 */
	public ServerMessage updateQuizClassRel(Integer quizId, HashSet<Integer> classIds){
		ServerMessage serverMessage = new ServerMessage();
		if(webexDatabase.ifQuizHasClasses(quizId) > 0){
			//remove
			webexDatabase.removeClassesUnderQuiz(quizId);
		}
		if(classIds.size() > 0){
			if(webexDatabase.addClassesToQuiz(quizId, classIds) > 0){
				serverMessage.setSuccess(true);
				serverMessage.setMessage(new StringBuilder("External classes linked."));
			}else{
				serverMessage.setSuccess(false);
				serverMessage.setMessage(new StringBuilder("No external classes linked."));
			}
		}else{
			serverMessage.setSuccess(true);
			serverMessage.setMessage(new StringBuilder("External classes linked."));
		}
		return serverMessage;
	}
	
	/*
	 * this method updates one quiz
	 */
	public ServerMessage updateQuiz(Quiz quiz){
		ServerMessage serverMessage = new ServerMessage();
		Quiz originalQuiz = (Quiz) this.getQuizById(quiz.getQuizId()).getContent()[0];
		if(originalQuiz.needNewVersion(quiz)){
			//this quiz's core parts are changed, a new version is needed
			quiz.setVersion(originalQuiz.getVersion() + 1);
			userService.addAuthorInfoToQuiz(quiz);		
			
			Quiz quizInDb = webexDatabase.newQuiz(quiz);
			serverMessage.setSuccess(true); 
			serverMessage.setMessage(new StringBuilder("Quiz updated with new version."));
			serverMessage.setContent(new Object[]{quizInDb});
		}else{
			//this quiz just needs to be updated
			
			if(webexDatabase.updateQuiz(quiz) > 0){
				serverMessage.setSuccess(true);
				serverMessage.setMessage(new StringBuilder("Quiz updated."));
			}else{
				serverMessage.setSuccess(false);
				serverMessage.setMessage(new StringBuilder("Quiz update failed."));
			}
		}
		return serverMessage;
	}
	
	/*
	 * this method returns all the code parts for one quiz
	 */
	public HashMap<StringBuilder, StringBuilder> getCodePartsByQuizId(Integer quizId){
		HashMap<StringBuilder, StringBuilder> codeParts = new HashMap<StringBuilder, StringBuilder>();
		Quiz quiz = webexDatabase.getQuizById(quizId);
		codeParts.put(new StringBuilder("Tester.py"), quiz.getCode());
		
		HashSet<Integer> classSet = webexDatabase.getClassListByQuizId(quizId);
		if(classSet.size() > 0){
			Iterator<Integer> iterator = classSet.iterator();
			while(iterator.hasNext()){
				Integer classId = iterator.next();
				StringBuilder codePart = (StringBuilder) externalClassService.getClassById(classId).getContent()[0];
				codeParts.put(webexDatabase.getClassFileNameById(classId), codePart);
			}
		}
		
		return codeParts;
	}
}
