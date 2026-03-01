package edu.pitt.pawslab.quizpet.controller;

import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import com.fasterxml.jackson.databind.ObjectMapper;

import edu.pitt.pawslab.quizpet.database.WebexDatabase;
import edu.pitt.pawslab.quizpet.instance.ServerMessage;

@Controller
@RequestMapping(value = "/api/acos")
public class AcosGradeController {

	private static final Logger logger = LoggerFactory.getLogger(AcosGradeController.class);
	private static final ObjectMapper objectMapper = new ObjectMapper();

	@Autowired
	private WebexDatabase webexDatabase;

	/**
	 * Receives grade events forwarded by acos-server (e.g., acos-jstracing content-type).
	 *
	 * Auth is intentionally omitted for now (per current requirement).
	 * The payload typically includes:
	 *  - grade: { points, max_points, attemptId, quizId, ... }
	 *  - protocolData: LMS/LTI identifiers (depending on protocol)
	 */
	@RequestMapping(value = "/grade", method = RequestMethod.POST)
	public @ResponseBody ServerMessage receiveGrade(@RequestBody Map<String, Object> body, HttpServletRequest request) {
		ServerMessage result = new ServerMessage();
		try {
			logger.info("[AcosGradeController] received /api/acos/grade from ip={} keys={}",
					request != null ? request.getRemoteAddr() : "unknown",
					body != null ? body.keySet() : null);

			String rawJson = (body != null) ? objectMapper.writeValueAsString(body) : "{}";
			Object protocolDataObj = (body != null) ? body.get("protocolData") : null;
			String protocolDataJson = (protocolDataObj != null) ? objectMapper.writeValueAsString(protocolDataObj) : "{}";

			Integer updated = webexDatabase.upsertAcosGrade(body, rawJson, protocolDataJson);

			result.setSuccess(true);
			result.setMessage(new StringBuilder("grade received"));
			result.setContent(new Object[] { updated });
			return result;
		} catch (Exception e) {
			logger.error("[AcosGradeController] failed to persist grade", e);
			result.setSuccess(false);
			result.setMessage(new StringBuilder(e.getMessage() != null ? e.getMessage() : "persist failed"));
			return result;
		}
	}
}
