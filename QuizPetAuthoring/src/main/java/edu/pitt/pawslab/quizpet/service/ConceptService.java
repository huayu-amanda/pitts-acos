package edu.pitt.pawslab.quizpet.service;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

import edu.pitt.pawslab.quizpet.database.WebexDatabase;
import edu.pitt.pawslab.quizpet.instance.ConceptNode;
import edu.pitt.pawslab.quizpet.instance.Quiz;
import edu.pitt.pawslab.quizpet.instance.ServerMessage;
import edu.pitt.pawslab.quizpet.instance.Setting;

import org.json.JSONObject;

@Service
public class ConceptService {
	
	@Autowired
	WebexDatabase webexDatabase;
	@Autowired
	QuizService quizService;
	@Autowired
	ExternalClassService externalClassService;
	
	private final static ObjectMapper objectMapper = new ObjectMapper();
	
	private static StringBuilder parseCode(StringBuilder code) throws Exception{
		URL url = new URL(Setting.PARSERURL);
		HttpURLConnection connection = (HttpURLConnection) url.openConnection();
		connection.setRequestMethod("POST");
		
		String parameters = Setting.PARSERTYPENAME + "=" + Setting.PARSERTYPEVALUE + "&"
				+ Setting.PARSERCODENAME + "=" + UriUtils.encodeQueryParam(code.toString(), "UTF-8");
		
		connection.setDoOutput(true);
		DataOutputStream wr = new DataOutputStream(connection.getOutputStream());
		wr.writeBytes(parameters);
		wr.flush();
		wr.close();

		BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
		String inputLine;
		StringBuilder response = new StringBuilder();
		while((inputLine = in.readLine()) != null){
			response.append(inputLine);
		}
		in.close();
		
		return response;
	}
	
	private static ArrayList<ConceptNode> parseConceptTree(StringBuilder codeTree){
		try{
			ConceptNode root = objectMapper.readValue(codeTree.toString(), ConceptNode.class);
			ArrayList<ConceptNode> conceptList = new ArrayList<ConceptNode>();
			ConceptNode.traverse(conceptList, root);
			return conceptList;
		}catch(Exception e){
			return null;
		}
	}

	public ServerMessage injectConceptForOneQuiz(Integer quizId) throws Exception{
		System.out.println("[injectConcept] ### PYTHON VERSION V3 ### quizId=" + quizId);
		ServerMessage serverMessage = new ServerMessage();
		HashMap<StringBuilder, StringBuilder> codeParts = quizService.getCodePartsByQuizId(quizId);
		// ①：看这一题到底拿到了几段代码
		System.out.println("[injectConcept] quizId=" + quizId +
				", codeParts size=" + (codeParts == null ? -1 : codeParts.size()));
		Quiz quiz = webexDatabase.getQuizById(quizId);
		String quizRdfId = quiz.getRdfIdInDb();
		String title = String.valueOf(quiz.getTitle());  // 假设有这个 getTitle()

		boolean isPython =
				(title != null && title.startsWith("q_py_")) ||
						(quizRdfId != null && quizRdfId.startsWith("q_py_"));
		System.out.println("[injectConcept] title=" + title +
				", rdfId=" + quizRdfId +
				", isPython=" + isPython);

		HashMap<StringBuilder, ArrayList<ConceptNode>> conceptListForOneQuiz = new HashMap<StringBuilder, ArrayList<ConceptNode>>();
		Iterator<StringBuilder> iterator = codeParts.keySet().iterator();
		while(iterator.hasNext()){
			StringBuilder filename = iterator.next();
			StringBuilder code = codeParts.get(filename);

			//
			System.out.println("[injectConcept] processing file=" + filename);
			// 【修改A】统一用一个字符串保存“概念树 JSON”
			String conceptTreeJson;
			if (isPython) {
				// 走 Python 解析路径
				//conceptTreeJson = parsePythonToConceptTree(code);
				// 【修改B1】使用新的 parsePythonToConceptTree(String)，并传入 code.toString()
				conceptTreeJson = parsePythonToConceptTree(code.toString());         // 【修改B1行】
				// 【修改B2】可以保留调试输出
				System.out.println("[injectConcept] pythonParser JSON = " + conceptTreeJson); // 【修改B2行】
			} else {
				// 走原来远程解析器路径
				//conceptTreeJson = parseCode(code);
				conceptTreeJson = parseCode(code).toString();
				System.out.println("[injectConcept] javaParser JSON = " + conceptTreeJson);
			}
			//ArrayList<ConceptNode> nodelist = parseConceptTree(parseCode(code));
			// 【修改D：这里必须改】
			ArrayList<ConceptNode> nodelist = parseConceptTree(new StringBuilder(conceptTreeJson));// ← 用 conceptTreeJson
			System.out.println("[injectConcept] filename=" + filename +
					", nodeList size=" + (nodelist == null ? -1 : nodelist.size()));
			if(nodelist != null){
				conceptListForOneQuiz.put(filename, nodelist);
			}else{
				System.out.println("[injectConcept] nodelist is null or empty for filename=" + filename);
				serverMessage.setSuccess(false);
				serverMessage.setMessage(new StringBuilder(filename + " has errors in its code. Concept injection failed."));
			}
		}
		
		//Quiz quiz = webexDatabase.getQuizById(quizId);
		//String quizRdfId = quiz.getRdfIdInDb();
		if(webexDatabase.checkConcepts(quizRdfId) > 0){
			webexDatabase.removeConcepts(quizRdfId);
		}
		// ②：真正要插入之前，看一下 conceptListForOneQuiz 的大小
		System.out.println("[injectConcept] conceptListForOneQuiz size=" + conceptListForOneQuiz.size());
		// 可选：顺便打一下 quizRdfId
		System.out.println("[injectConcept] quizRdfId=" + quizRdfId);
		// 这里只加一行日志，记录调用 addConceptsByClassFile 前的状态
		System.out.println("[injectConcept] calling addConceptsByClassFile...");
		int classType = isPython ? 2 : 1; // 1=Java, 2=Python
		if(webexDatabase.addConceptsByClassFile(quizRdfId, conceptListForOneQuiz,classType) > 0){
			serverMessage.setSuccess(true);
			serverMessage.setContent(new Object[]{quizRdfId, conceptListForOneQuiz});
		}else{
			serverMessage.setSuccess(false);
			serverMessage.setMessage(new StringBuilder("Concept injection failed."));
		}
		// ③：最终只打一行总结（成功/失败）
		System.out.println("[injectConcept] done, success=" + serverMessage.isSuccess());
		return serverMessage;
	}


	// 加一个方法（和 parseCode 类似，但不走 HTTP，而是本地起一个进程执行 Python）
	private static String parsePythonToConceptTree(String code) throws Exception {
		ProcessBuilder pb = new ProcessBuilder(
				"python3",
				Setting.PYTHON_PARSER_PATH
		);

		// 关键：不要再合并 stderr 到 stdout
		// pb.redirectErrorStream(true);
		Process process = pb.start();

		// 构造 JSON payload：{"code": "...", "params": {...}, "filename": "..."}
		try (OutputStream os = process.getOutputStream()) {
			JSONObject payload = new JSONObject();
			payload.put("code", code);
			// 如果有真实的文件名，可以从别处传进来，这里先写死 Tester.py
			payload.put("filename", "Tester.py");
			// 示例参数；后续你可以改成从 DB 或配置中读取
			JSONObject params = new JSONObject();
			params.put("X", 1);
			params.put("Y", 2);
			params.put("OFFSET", 0);
			payload.put("params", params);

			byte[] bytes = payload.toString().getBytes("UTF-8");

			// 可选：打日志方便调试
			System.out.println("[parsePythonToConceptTree] payload=" + payload.toString());
			os.write(bytes);
			os.flush();
			// try-with-resources 结束会自动 close，给 Python EOF
		}

		// === 单独读取 stdout：只会有 JSON ===
		StringBuilder stdout = new StringBuilder();
		try (BufferedReader reader = new BufferedReader(
				new InputStreamReader(process.getInputStream(), "UTF-8"))) {
			char[] buf = new char[4096];
			int n;
			while ((n = reader.read(buf)) != -1) {
				stdout.append(buf, 0, n);
			}
		}

		// === 单独读取 stderr：只会有 [PY_DEBUG] / [PY_ERROR] ===
		StringBuilder stderr = new StringBuilder();
		try (BufferedReader reader = new BufferedReader(
				new InputStreamReader(process.getErrorStream(), "UTF-8"))) {
			char[] buf = new char[4096];
			int n;
			while ((n = reader.read(buf)) != -1) {
				stderr.append(buf, 0, n);
			}
		}

		int exitCode = process.waitFor();
		System.out.println("[parsePythonToConceptTree] exitCode=" + exitCode);
		if (stderr.length() > 0) {
			System.out.println("[parsePythonToConceptTree] stderr=" + stderr);
		}

		if (exitCode != 0) {
			throw new RuntimeException(
					"Python parser failed, exitCode=" + exitCode +
							", stderr=" + stderr.toString()
			);
		}
		String json = stdout.toString().trim();
		System.out.println("[parsePythonToConceptTree] stdout(JSON)=" + json);
		return json;
	}


	public HashMap<String, ArrayList<ConceptNode>> getConceptsOfOneQuiz(String rdfIdInDb){
		ArrayList<ConceptNode> list = webexDatabase.getAllConceptsOfOneQuiz(rdfIdInDb);
		HashMap<String, ArrayList<ConceptNode>> rs = new HashMap<String, ArrayList<ConceptNode>>();
		
		Iterator<ConceptNode> iterator = list.iterator();
		while(iterator.hasNext()){
			ConceptNode curr = iterator.next();
			String classFile = curr.getClassFile().toString();
			if(rs.containsKey(classFile)){
				ArrayList<ConceptNode> currList = rs.get(classFile);
				currList.add(curr);
			}else{
				ArrayList<ConceptNode> currList = new ArrayList<ConceptNode>();
				currList.add(curr);
				rs.put(classFile, currList);
			}
		}
		
		return rs;
	}
	
	public HashMap<String, Object[]> getConceptsAndCodeOfOneQuiz(Quiz quiz){
		HashMap<String, Object[]> rs = new HashMap<String, Object[]>();
		HashMap<String, ArrayList<ConceptNode>> concepts = getConceptsOfOneQuiz(quiz.getRdfIdInDb());
		
		Iterator<String> iterator = concepts.keySet().iterator();
		while(iterator.hasNext()){
			String classFileName = iterator.next();
			ArrayList<ConceptNode> conceptsForThisClass = concepts.get(classFileName);
			
			if(classFileName.equals("Tester.py")){
				//code from this quiz
				StringBuilder code = quiz.getCode();
				Object[] value = new Object[]{code, conceptsForThisClass};
				rs.put(classFileName, value);
			}else{
				//code from external classes
				Integer externalClassId = webexDatabase.getClassIdByFileName(classFileName);
				ServerMessage classCode = externalClassService.getClassById(externalClassId);
				if(classCode.isSuccess()){
					StringBuilder code = (StringBuilder) classCode.getContent()[0];
					Object[] value = new Object[]{code, conceptsForThisClass};
					rs.put(classFileName, value);
				}
			}
		}
		
		return rs;
	}
	
	public Integer updateConceptsOfOneQuiz(Quiz quiz, ArrayList<ConceptNode> newConcepts){
		String rdfIdInDb = quiz.getRdfIdInDb();
		webexDatabase.removeConcepts(rdfIdInDb);
		
		return webexDatabase.addConcepts(rdfIdInDb, newConcepts);
	}
}
