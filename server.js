"use strict";

var SPREADSHEET_ID     = '1drQkdhUFhlLRakCkQVfnHXOZokdfdiuprv224ZbQpjI';

// sheet names
var SHEET_OPEN   = "Open";
var SHEET_EMAILS = "Emails";

var ROW_OF_COL_HEADINGS = 1;  // 0-based:  0=title row, 1=column headings 2=first row of actual data THIS IS TRUE FOR ALL SHEETS!!

// Sheet 0 and 1 with the assignemnts
var COL_HIDE         = "Hide";
var COL_PATIENT_ID   = "Patient_ID";
var COL_CARE_PLAN    = "Care_Plan";
var COL__ASSIGNED    = "_Assigned";
var COL_REQUEST      = "Request";
var COL_PATIENT_NAME = "Patient_Name";
var COL_TIMESTAMP    = "Timestamp";
var COL_TEAM         = "Team";

// Sheet 2 with the Team email addresses
var COL_EMAIL_TEAM  = "Team";
var COL_EMAIL_EMAIL = "Email";
var EMAIL_ADDRESS_NAME_DEVELOPER  = "Developer";  // must match entry in the spreadsheet's email sheet
var EMAIL_ADDRESS_NAME_VOLUNTEERS = "Volunteers"; // must match entry in the spreadsheet's email sheet
var gaTeamEmailAddresses;  // 2D array of Team names and associated email addresses loaded from spreadsheet

/*=========================================================
*  doGet() return initial index.html
==========================================================*/
function doGet(e) {
  Logger.log("doGet()");
  
  loadEmails(); // need to change this to a self-creating namespace
  
  return HtmlService.createTemplateFromFile('index.html')
      .evaluate()
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/*=========================================================
*  processAssignmentRequest()
*
*  Called by client when volunteer requests an assignment
*  @param(oAssignmentRequest) {
*                                sVolunteer  the name te volunteer entered in making the request
*                                sPatientID  string or number, the assignment's PatientID
*                                sCarePlan   the assignment's Care Plan
*                                sTimestamp  the assignment's timestamp in ISO string format
*                             }
*  @return string:  Confirmation w/ code or error message (if the assignment is no lnoger available)
==========================================================*/
function processAssignmentRequest(oAssignmentRequest) {
  Logger.log("processAssignmentRequest() START");
  Logger.log("oAssignmentRequest="+JSON.stringify(oAssignmentRequest));
  Logger.log("");
  
  // get the data from the sheet as a 2D array
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var rangeAllAssignments = spreadsheet.getSheetByName(SHEET_OPEN).getDataRange();
  var aAllAssignments = rangeAllAssignments.getValues();
  
  // load aColumnHeadings
  var aColumnHeadings = [];
  for (var i=0;i<aAllAssignments[ROW_OF_COL_HEADINGS].length;i++)   
    aColumnHeadings[i]=aAllAssignments[ROW_OF_COL_HEADINGS][i];
  var IDX_HIDE          = aColumnHeadings.indexOf(COL_HIDE);
  var IDX_PATIENT_ID    = aColumnHeadings.indexOf(COL_PATIENT_ID);
  var IDX_CARE_PLAN     = aColumnHeadings.indexOf(COL_CARE_PLAN);
  var IDX__ASSIGNED     = aColumnHeadings.indexOf(COL__ASSIGNED);
  var IDX_REQUEST       = aColumnHeadings.indexOf(COL_REQUEST);
  var IDX_PATIENT_NAME  = aColumnHeadings.indexOf(COL_PATIENT_NAME);
  var IDX_TIMESTAMP     = aColumnHeadings.indexOf(COL_TIMESTAMP);
  
  // SEARCH FOR ASSIGNMENT
  var idxOfAssignment = -1;  // index of matching assignment in aAllAssignments, if found
  for (var i=ROW_OF_COL_HEADINGS+1;i<aAllAssignments.length;i++) {  // index starts at ROW_OF_COL_HEADINGS+1 to skip column headings row
    if (oAssignmentRequest.sPatientID==aAllAssignments[i][IDX_PATIENT_ID]) {  // must be "==" as the PatientIDs jump btw being string and numeric
      if (oAssignmentRequest.sCarePlan===aAllAssignments[i][IDX_CARE_PLAN]) {
        if (new Date(oAssignmentRequest.sTimestamp).toString()==aAllAssignments[i][IDX_TIMESTAMP].toString()) {
          idxOfAssignment = i;
          break;
        }
      }
    }
  }

  // IF ASSIGNMENT FOUND AND STILL AVAILABLE, ASSIGN IT TO VOLUNTEER
  if (idxOfAssignment === -1) 
    sReturnMessage = "ERROR:  This assignment is no longer available.";
    
  else if (aAllAssignments[idxOfAssignment][IDX_HIDE].length!==0) 
    sReturnMessage = "ERROR:  This assignment was just hidden by a volunteer coordinator.";
    
  else if (aAllAssignments[idxOfAssignment][IDX__ASSIGNED].length!==0) 
    sReturnMessage = "ERROR:  Another volunteer has already taken this assignment.";
    
  else {
    // make assignment
    var rangeAssignmentRow = spreadsheet.getSheetByName(SHEET_OPEN).getRange(idxOfAssignment+1,1,1,rangeAllAssignments.getNumColumns());
    var aAssignmentRow = rangeAssignmentRow.getValues()[0]; // turn 2D array into 1D
    
    // sanity check that we have the assignment we think we do
    if (oAssignmentRequest.sPatientID!=aAssignmentRow[IDX_PATIENT_ID] ||  // must be "!=" as the PatientIDs jump btw string and numeric
        oAssignmentRequest.sCarePlan!==aAssignmentRow[IDX_CARE_PLAN]) {
      sReturnMessage = "ERROR:  Let Ed know you got this error, no assignment was made.";
      
    // assign it!
    } else {
      rangeAssignmentRow.offset(0,IDX__ASSIGNED,1,1).setValue(oAssignmentRequest.sVolunteer);
      rangeAssignmentRow.setBackground('#FDEBD0');
      sReturnMessage = "SUCCESS, thank-you for taking this assignment!\n\nYour access code is: << "+getAccessCode(aAssignmentRow[IDX_PATIENT_ID])+" >>";
      emailVolunteerTeam(oAssignmentRequest.sVolunteer,aAssignmentRow);
      }
  }
  
  return sReturnMessage;
}

/*=========================================================
*  getAccessCode()
*  Translate Patient_ID to an access code.
*
*  @param sPatientID can come in as number or string 
*
*  @return string code generated from the Patient_ID
==========================================================*/
function getAccessCode(sPatientID) {

  return String(sPatientID)  
          .split("")          // convert to array
          .reverse()          // reverse the array
          .join("");          // convert to string
}

/*=========================================================
*  Email assignment information to team
==========================================================*/
function emailVolunteerTeam(sVolunteer,aAssignmentRow) {

  var sEmailAddresses = "";

  // TODO:  This is super inefficient since its only being loaded to get the column heading indexes
  // get the data from the sheet as a 2D array
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var rangeAllAssignments = spreadsheet.getSheetByName(SHEET_OPEN).getDataRange();
  var aAllAssignments = rangeAllAssignments.getValues();
  
  // load aColumnHeadings
  var aColumnHeadings = [];
  for (var i=0;i<aAllAssignments[ROW_OF_COL_HEADINGS].length;i++) 
    aColumnHeadings[i]=aAllAssignments[ROW_OF_COL_HEADINGS][i];
  var IDX_PATIENT_ID    = aColumnHeadings.indexOf(COL_PATIENT_ID);
  var IDX_PATIENT_NAME  = aColumnHeadings.indexOf(COL_PATIENT_NAME);
  var IDX_TEAM          = aColumnHeadings.indexOf(COL_TEAM);
  var IDX_CARE_PLAN     = aColumnHeadings.indexOf(COL_CARE_PLAN);
  var IDX_REQUEST       = aColumnHeadings.indexOf(COL_REQUEST);


  // Care Plans that start with "Testing" should not generate team emails, they are used during development
  if (/Testing/.test(aAssignmentRow[IDX_CARE_PLAN])) 
    sEmailAddresses = getTeamEmailAddress(EMAIL_ADDRESS_NAME_DEVELOPER);
  else 
    sEmailAddresses = getTeamEmailAddress(aAssignmentRow[IDX_TEAM])+
                      ", "+getTeamEmailAddress(EMAIL_ADDRESS_NAME_VOLUNTEERS);
    
  Logger.log("** Sending email to: "+sEmailAddresses);

  try {
    MailApp.sendEmail(sEmailAddresses,
  
                    aAssignmentRow[IDX_PATIENT_NAME]+" - "+aAssignmentRow[IDX_PATIENT_ID]+" - volunteer assigned",
                    
                    "\n"+sVolunteer+" has been assigned to:\n\n\t"+
                         aAssignmentRow[IDX_PATIENT_ID]+" "+aAssignmentRow[IDX_PATIENT_NAME]+"\n\t"+
                         aAssignmentRow[IDX_CARE_PLAN]+"\n\n"+
                         aAssignmentRow[IDX_REQUEST]+"\n\n"+
                         "(assignment taken at: "+Date()+")");
  }
  catch (err) {
    Logger.log(err.message);
    MailApp.sendEmail("edphelps1@gmail.com","TRU error while emailing that vol took an assignment",err.message+". email addr: "+sEmailAddresses);
  }
}

/*=========================================================
*  getOpenAssignments()
*
*  Called by client after page loades to get the list of open assignemnts to display.
*  Return is an arryy of objects based on the sheet of open assignments.
*  The object properties are keyed based on column names on the first sheet of the 
*  assignments spreadsheet
*
*  @return aOpenAssignments : [] of Assignmnet objects: {
*                          Patient_ID : "12345",   // this might translate itself to a Number
*                          Patient_Name : "John Doe",
*                          etc.
*                       }
==========================================================*/
function getOpenAssignments() {
  Logger.log("getOpenAssignments()");
  var aOpenAssignments = [];
  var aColumnHeadings = [];

  // get the data from the sheet as a 2D array
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var rangeAllAssignments = spreadsheet.getSheetByName(SHEET_OPEN).getDataRange();
  var aAllAssignments = rangeAllAssignments.getValues();
  
  // load aColumnHeadings
  for (var i=0;i<aAllAssignments[ROW_OF_COL_HEADINGS].length;i++) 
    aColumnHeadings[i]=aAllAssignments[ROW_OF_COL_HEADINGS][i];  
  var IDX_HIDE          = aColumnHeadings.indexOf(COL_HIDE);
  var IDX_PATIENT_ID    = aColumnHeadings.indexOf(COL_PATIENT_ID);
  var IDX_CARE_PLAN     = aColumnHeadings.indexOf(COL_CARE_PLAN);
  var IDX__ASSIGNED     = aColumnHeadings.indexOf(COL__ASSIGNED);
  var IDX_REQUEST       = aColumnHeadings.indexOf(COL_REQUEST);
  var IDX_PATIENT_NAME  = aColumnHeadings.indexOf(COL_PATIENT_NAME);
  var IDX_TIMESTAMP     = aColumnHeadings.indexOf(COL_TIMESTAMP);

  // load aOpenAssignments with assignments that aren't hidden or already assigned
  var idxOpenAssignments = -1;
  for (var i=ROW_OF_COL_HEADINGS+1;i<aAllAssignments.length;i++) {  // index starts at ROW_OF_COL_HEADINGS+1 to skip the row of columns heading
  
    // if not hidden or already assigned
    if (aAllAssignments[i][IDX_HIDE].length===0 && aAllAssignments[i][IDX__ASSIGNED].length===0) {
    
      // add the assignment object
      aOpenAssignments[++idxOpenAssignments] = {};  // create blank object
      for (var j=0;j<aColumnHeadings.length;j++)    // add properties based on the column headings
        aOpenAssignments[idxOpenAssignments][aColumnHeadings[j]] = aAllAssignments[i][j];   
    }
  }
  return JSON.stringify(aOpenAssignments);
}


/*=========================================================
*  dateReviver()
*    Helper for JSON.parse() so the object that parse() builds will
*    create Dates rather than funky Strings for Date objects.
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

/*=========================================================
*  loadEmails()
*
*  Load the "Volunteers" and Team email addresses for notification
*    into global array gaTeamEmailAddresses
*
===========================================================*/
function loadEmails() {
  var aAllEmails = [];
  var aColumnHeadings = [];
  gaTeamEmailAddresses = [];
  
  // get the data from the sheet as a 2D array
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var rangeAllEmails = spreadsheet.getSheetByName(SHEET_EMAILS).getDataRange();
  var aAllEmails = rangeAllEmails.getValues();
  
  // load aColumnHeadings
  for (var i=0;i<aAllEmails[ROW_OF_COL_HEADINGS].length;i++) {  
    Logger.log("col head: "+aAllEmails[ROW_OF_COL_HEADINGS][i]);
    aColumnHeadings[i]=aAllEmails[ROW_OF_COL_HEADINGS][i];  
  }
 
  var IDX_EMAIL_TEAM    = aColumnHeadings.indexOf(COL_EMAIL_TEAM);
  var IDX_EMAIL_EMAIL   = aColumnHeadings.indexOf(COL_EMAIL_EMAIL);
    
  // load gaTeamEmailAddresses
  var idx_gaTeamEmailAddresses = -1;
  for (var i=ROW_OF_COL_HEADINGS+1;i<aAllEmails.length;i++) {  // index starts at ROW_OF_COL_HEADINGS+1 to skip the row of columns heading
    Logger.log("email: "+aAllEmails[i][IDX_EMAIL_TEAM]+" = "+aAllEmails[i][IDX_EMAIL_EMAIL]);
    gaTeamEmailAddresses[++idx_gaTeamEmailAddresses] = [];
    gaTeamEmailAddresses[idx_gaTeamEmailAddresses][0]=aAllEmails[i][IDX_EMAIL_TEAM];
    gaTeamEmailAddresses[idx_gaTeamEmailAddresses][1]=aAllEmails[i][IDX_EMAIL_EMAIL];
  }
  
  for (var i=0;i<gaTeamEmailAddresses.length;i++) {
    Logger.log("arr: "+gaTeamEmailAddresses[i][0]+" : "+gaTeamEmailAddresses[i][1]);
    }
}

/*=========================================================
*  getTeamEmailAddrees()
*
*  Get the email address for Developer, Volunteers, or Team
*
*  @param (string) sTeamName - name of the team, matching the entry in the email list in the spreadsheet
*
*  @return (string) associated email address or "" if sTeam not found
===========================================================*/
function getTeamEmailAddress(sTeamName) {
  Logger.log("getTeamEmailAddress()");
  
  loadEmails();  // figure out object permenance on server side so don't have to reload each call

  var sEmail = "";

  for (var i=0;i<gaTeamEmailAddresses.length;i++) {
    if (gaTeamEmailAddresses[i][0]===sTeamName) {
      sEmail = gaTeamEmailAddresses[i][1];
      break;
    }
  }

  if (0<sEmail.length) {
    Logger.log(sTeamName+" - "+sEmail);
    }
  else {
    Logger.log(sTeamName+" NOT FOUND");
  }
  return sEmail;
}
/*=========================================================
*  test()
*    used during development to launch other functions
==========================================================*/
function test() {
  var s = "Testxing here";
  Logger.log("starts with Testing: "+/Testing/.test(s));
  //sCarePlan.slice(0,7)==="Testing"
  
  
var regex1 = RegExp('foo*');
var regex2 = RegExp('foo*','g');
var str1 = 'table football';

Logger.log(regex1.test(str1));
// expected output: true

Logger.log(regex1.test(str1));
// expected output: true

Logger.log(regex2.test(str1));
// expected output: true

Logger.log(regex2.test(str1));  // WHY???????????
// expected output: false  
}