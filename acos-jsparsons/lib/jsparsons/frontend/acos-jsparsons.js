/* global ACOS, alert, $, parson */
/* exported initial, unittest, displayErrors, parsonsGrade, attachParsonsPedagogicalLogging */
/* jshint globalstrict: true */

"use strict";
var initial;
var unittest;
var __parsonsEventCounter = 0;
var __lastParsonsSnapshot = "";

var EVENT_SCHEMA_VERSION = "1.0";
var __currentDragContext = {
  sourceContainer: null,
  fromIndex: null
};

function getContainerLines(selector) {
  var lines = [];
  $(selector).children().each(function() {
    var text = ($(this).text() || "").trim();
    if (text.length > 0) {
      lines.push(text);
    }
  });
  return lines;
}

function snapshotParsonsState() {
  return JSON.stringify({
    source: getContainerLines("#sortableTrash"),
    answer: getContainerLines("#sortable")
  });
}

function getParsonsStateObject() {
  return {
    answerLines: getContainerLines("#sortable"),
    sourceLines: getContainerLines("#sortableTrash")
  };
}

function getProblemDescriptor() {
  var meta = window.JSPARSONS_META || {};
  return {
    contentType: "jsparsons",
    contentPackage: meta.contentPackage || null,
    exerciseName: meta.exerciseName || $("#js-parsons-id").val() || null
  };
}

function nextEventId(index) {
  return "jsparsons-" + Date.now() + "-" + index;
}

function buildPedagogicalPayload(actionType, details) {
  __parsonsEventCounter += 1;

  var state = getParsonsStateObject();
  var payload = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventType: actionType,
    eventId: nextEventId(__parsonsEventCounter),
    eventIndex: __parsonsEventCounter,
    timestamp: new Date().toISOString(),
    problem: getProblemDescriptor(),
    interaction: details || {},
    state: state,
    userActions: parson && parson.user_actions ? parson.user_actions : []
  };

  // Backward compatibility for consumers still reading legacy keys.
  payload.problemName = payload.problem.exerciseName;
  payload.log = payload.userActions;

  return payload;
}

function sendPedagogicalLog(actionType, details) {
  ACOS.sendEvent("log", buildPedagogicalPayload(actionType, details));
}

function attachParsonsPedagogicalLogging() {
  __lastParsonsSnapshot = snapshotParsonsState();

  $("#sortable, #sortableTrash")
    .off("sortstart.jsparsonsLogger")
    .on("sortstart.jsparsonsLogger", function(event, ui) {
      var item = ui && ui.item ? ui.item : null;
      __currentDragContext = {
        sourceContainer: item && item.parent ? item.parent().attr("id") : $(event.target).attr("id"),
        fromIndex: item && typeof item.index === "function" ? item.index() : null
      };
    })
    .off("sortupdate.jsparsonsLogger")
    .on("sortupdate.jsparsonsLogger", function(event, ui) {
      // Let sortable finish DOM updates before capturing state.
      setTimeout(function() {
        var nextSnapshot = snapshotParsonsState();
        if (nextSnapshot === __lastParsonsSnapshot) {
          return;
        }

        __lastParsonsSnapshot = nextSnapshot;
        var item = ui && ui.item ? ui.item : null;
        var toContainer = item && item.parent ? item.parent().attr("id") : $(event.target).attr("id");

        sendPedagogicalLog("parsons_drag", {
          sourceContainer: __currentDragContext.sourceContainer,
          targetContainer: toContainer,
          fromIndex: __currentDragContext.fromIndex,
          toIndex: item && typeof item.index === "function" ? item.index() : null,
          movedTitle: item ? (item.text() || "").trim() : null,
          answerSize: getContainerLines("#sortable").length,
          sourceSize: getContainerLines("#sortableTrash").length
        });

        __currentDragContext = {
          sourceContainer: null,
          fromIndex: null
        };
      }, 0);
    });
}

function displayErrors(feedback) { 
  if(feedback.length > 0) { 
    alert(feedback[0]); 
  } 
}

function parsonsGrade(feedback) {
  // For acos-jsparsons-gamey-pseudo contentPackage:
  if( $("#gamified-parsons").val() === "true" ) {
    parson.user_actions.push({gamified:true});
  }
    parson.user_actions.push( { problemName: $("#js-parsons-id").val() } );
  //feedback.length for line-based graders and feedback.success for unit test graders
  if(feedback.length === 0 || feedback.success === true) {
    ACOS.sendEvent('grade', {'points': 1, 'max_points': 1, 'status': 'graded', 'feedback': 'Problem solved successfully.'}); 
    ACOS.sendEvent('log', buildPedagogicalPayload('parsons_feedback', {
      result: 'success',
      feedbackMessage: 'Problem solved successfully.'
    }));
  } else {
    ACOS.sendEvent('grade', {'points': 0, 'max_points': 1, 'status': 'graded', 'feedback': feedback[0]});
    ACOS.sendEvent('log', buildPedagogicalPayload('parsons_feedback', {
      result: 'failure',
      feedbackMessage: feedback[0] || ''
    }));
  } 
}
