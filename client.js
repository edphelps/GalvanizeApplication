<script>

"use strict";

var gaOpenAssignments; // array of open assignment ojects

/*=========================================================
* function getDateOnly(dt)
*   Get date-only string from date or "?" for bad dates
*   TODO: ADD OPTIONAL PARAM TO RETURN JUST THE MONTH AND DAY AND REMOVE THE SLICE CALLS BELOW
==========================================================*/
function getDateOnly(dt) {
  dt = new Date(dt);  // this allows the dt param to be Date or String
  if (isNaN(dt))
    return "?";
  return dt.getMonth()+1 + "/" + dt.getDate() + "/" + dt.getFullYear();
}

/*=========================================================
* window.addEventListener('load', function())
*
* After page loads ask server for open assignemnts and set callback function to layout the page
==========================================================*/
window.addEventListener('load', function() {
  console.log('Page is loaded');
  loadPage();
});

/*=========================================================
* function layoutPageData(oResponse)
*
* Call back after index.html loads with array of open assignments.
*   Create the main page display listing the open assignments.
==========================================================*/
function layoutPageData(oResponse) {
  console.log("layoutPageData()");
  var div = document.getElementById('ListOfAssignments');
  var sOutput = "";
  
  div.innerHTML = "loading...";
  
  gaOpenAssignments = JSON.parse(oResponse,dateReviver);
  
  // Sort assignments for display
  gaOpenAssignments.sort(function(oAssign1,oAssign2) { 
    // sort by Care_Plan
    if (oAssign1.Care_Plan < oAssign2.Care_Plan)
      return -1;
    if (oAssign2.Care_Plan < oAssign1.Care_Plan)
      return 1;
    // Care_Plans are === so sort z-a by timestamp
    if (oAssign1.Timestamp < oAssign2.Timestamp)
      return -1;
    if (oAssign2.Timestamp < oAssign1.Timestamp)
      return 1;
    return 0;  // unlikely to get here as two timestamps are unlikely be the same
  });
  
//  if (oResponse.hasOwnProperty('error')) {
//    sOutput = oResponse.error;
//  }
//  else {
//    gaOpenAssignments = oResponse;

    
    // Display the Care Plan headings and assignment titles
    var sCarePlanHeading="";
    for (var i=0;i<gaOpenAssignments.length;i++) {
    
      // Display Care Plan section heading, if appropriate
      if (sCarePlanHeading!==gaOpenAssignments[i].Care_Plan) {
        sCarePlanHeading = gaOpenAssignments[i].Care_Plan;
        sOutput+="<h2>"+sCarePlanHeading+"</h2>";
      }
      // Display the assignment title and setup to respond to it being clicked on
      sOutput += "<div onclick=showAssignment("+i+")>&nbsp; " +
                getDateOnly(gaOpenAssignments[i].Timestamp).slice(0,-5) + 
        ": <u>"+gaOpenAssignments[i].Post_Location + 
        " - "+   gaOpenAssignments[i].Home_or_Facility + 
        "</u></div>";
      sOutput+="<div id=AssignmentDetail_"+i+"></div>";  // this is where the details will appear if section is expanded
    }
//  }
  div.innerHTML = sOutput;
}

/*=========================================================
* Redact names in a string.  Names are flagged with "~"
*   ex: "His name is ~Steve" -> "His name is ----"
==========================================================*/
function redactNames(sText) {
  return sText.replace(new RegExp(/(~\w+)/gi),"----");  // replace "~" and following word with "----"
}

/*=========================================================
* Replace newlines with <br> so they display correctly in HTML
* ==========================================================*/
function addHtmlBr(sText) {
  return sText.replace("\n", '<br><br>');
}

/*=========================================================
* Wraps an error message with astrisks to display
==========================================================*/
function wrapErrMsgWithAsterix(sMsg) {
  return "\n\n*****************************************************************\n\n" +
         sMsg+"\n\n"+
         "*****************************************************************\n\n"
}

/*=========================================================
* called when user clicks button to request an assignment
*    Validates they've entered their name
*    Calls server function with request to take assignment and sets a callback
==========================================================*/
function handleRequestAssignment(assignmentIndex) {
  console.log("------");
  console.log("** handleRequestAssignment("+assignmentIndex+") START");

  // Validate volunteer entered their name 
  var volunteerNameTextBox = document.getElementById("sVolunteer"+assignmentIndex);
  var sVolunteer = volunteerNameTextBox.value.trim();
  if (sVolunteer.length===0) {
    alert(wrapErrMsgWithAsterix("ERROR:  Please enter your name to the left of the button when requesting an assignment"));
    return;
  }
  
/*  console.log("sVolunteer="+sVolunteer);
  console.log("Patient_ID="+gaOpenAssignments[assignmentIndex].Patient_ID);
  console.log("timestamp="+gaOpenAssignments[assignmentIndex].Timestamp);
  console.log("typeof="+(typeof gaOpenAssignments[assignmentIndex].Timestamp));*/
  
//  var sTimestamp = JSON.stringify(gaOpenAssignments[assignmentIndex].Timestamp);
  var sTimestamp = gaOpenAssignments[assignmentIndex].Timestamp.toString();
  console.log("----- Timestamp: "+gaOpenAssignments[assignmentIndex].Timestamp);
  console.log("-----sTimestamp: "+sTimestamp);
  
  var oRequestAssignment = {
       sVolunteer : sVolunteer,
       sPatientID : gaOpenAssignments[assignmentIndex].Patient_ID,
       sCarePlan  : gaOpenAssignments[assignmentIndex].Care_Plan,
       sTimestamp : sTimestamp  // can't pass Date objects to server
  };

  console.log("abt to call script.run");

  google.script.run
      .withSuccessHandler(updateRequestAssignment)
      .processAssignmentRequest(oRequestAssignment); 

  console.log("** handleRequestAssignment() END");
}

/*=========================================================
*  loadPage()
*
*    Called for intiial page load and reload after a volunteer makes an assignment request
==========================================================*/
function loadPage() {
  google.script.run
    .withSuccessHandler(layoutPageData)
    .getOpenAssignments();
}

/*=========================================================
*  call back when server has processed the request for an assignment
==========================================================*/
function updateRequestAssignment(sResponse) {
  console.log("** updateRequestAssignment("+sResponse+") RESPONSE FROM SERVER");
  if (sResponse.slice(0,5)==="ERROR")
    alert(wrapErrMsgWithAsterix(sResponse));
  else
    alert("\n\n"+sResponse+"\n\nThis page will now refresh\n\n");
  loadPage();
}

/*=========================================================
* Handle click on an assignment by showing assignment details
==========================================================*/
function showAssignment(assignmentIndex) {
//  var div = document.getElementById('AssignmentDetails');
  //hideAllAssignmentDetails();

  var div = document.getElementById('AssignmentDetail_'+assignmentIndex);
  
  var sOutput = "";
  
  if (div.innerHTML.length===0) {  // if not 0 then details are already showing and we should hide them
    var oAssignment = gaOpenAssignments[assignmentIndex];
    sOutput += "<table style=\"margin-left:45px\">";
    sOutput += "<tr><td>Request</td><td>"+     addHtmlBr(redactNames(oAssignment.Request))+"</td></tr>";
    sOutput += "<tr><td>Stats</td><td>"+  oAssignment.Age+" yo "+oAssignment.Gender+" with "+oAssignment.Diagnosis+"</td></tr>";
    sOutput += "<tr><td>Background</td><td>"+addHtmlBr(redactNames(oAssignment.Psychosocial))+"</td></tr>";
    sOutput += "<tr><td>Accept</td><td>" +
                  "Your name: " +
                  "<input type=\"text\" id=\"sVolunteer"+assignmentIndex+"\">" +   // create unique field name, example: sVolunteer3
                  ".... <button type=\"button\" onclick=\"handleRequestAssignment("+assignmentIndex+")\">Accept</button>" +
                  "</td></tr>";                  
    sOutput += "</table><p>";
  }
  div.innerHTML = sOutput;  
}

/*=========================================================
*  dateReviver()
*    Helper for JSON.parse() so the object that parse() builds will
*    create Dates rather than funky ISO Strings for Date objects.
==========================================================*/
function dateReviver(key, value) {
    var a;
    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
        }
    }
    return value;
};

</script>
