# GalvanizeApplication

This is an app I created at my current job to allow our volunteers to view open volunteer assignments with hospice patients. It uses Google Apps Scripts (Google's varient of Javascript) as the server and a Google spreadsheet as the database. Volunteers view a list of assignments grouped by type and click on an assignent to view its details. I load all assignment information using AJAX and layout the page with links and empty for the detail information. When a user clicks a link I display the details in the

below the link (click again and I hide it). The volunteers can Accept an assignment by entering their name and clicking the Accept button. This uses AJAX to call a function on the server to enter thier name as the assigned volunteer in the backing Google spreadsheet database and reloads the page (the page will no longer show the assignment they accepted since it's no longer available). Once accepted volunteers go to another page to view detailed patient information including names and phone numbers, again coming from the Google spreadsheet.
