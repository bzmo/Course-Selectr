/*
 *  Starter code for University of Waterloo CS349 - Spring 2017 - A3.
 *	Refer to the JS examples shown in lecture for further reference.
 *  Note: this code uses ECMAScript 6.
 */

"use strict";

// Get your own API key from https://uwaterloo.ca/api/register
var apiKey = '3b07c47c9205c7b543754492bcd13167';

(function(exports) {

	/* A Model class */
    class AppModel {
		constructor() {
			this.that = this;
      this.termSubjects = {};        // Track subjects + courses for terms
      this.availableSubjects = [];   // Track subjects that the school offers
		}

    // You can add attributes / functions here to store the data
    constructCoursesEndPointUrl(subject) {
      let coreEndPointUrl = "https://api.uwaterloo.ca/v2/courses";
      if (subject != "") {
        coreEndPointUrl += "/" + subject;
      }
      return coreEndPointUrl + ".json";
    }

    constructTermEndPointUrl(subject, term) {
      let coreEndPointUrl = "https://api.uwaterloo.ca/v2/terms"
      // Compute the term number
      let currentTime = new Date();

      if (term == "NEXT") {
        currentTime.setMonth(currentTime.getMonth() + 4);
      }

      let termNumber = "1" + currentTime.getFullYear() % 100
                           + ((Math.floor(currentTime.getMonth() / 4) * 4) + 1);
      coreEndPointUrl += "/" + termNumber;
      if (subject != "") {
        coreEndPointUrl += "/" + subject + "/schedule";
      } else {
        coreEndPointUrl += "/courses";
      }
      return coreEndPointUrl + ".json";
    }

    storeCoursesInSubject(subjects, data, subject) {
       if (!subjects[subject]) {
         subjects[subject] = {};
       }
       // Iterate through each course that matches our subject, caching each
       //   course's (0, i) substring of its course number for future lookup
        _.forEach(data, (course) => {
          let catalogNum = course["catalog_number"];
          if (subjects[subject][catalogNum]) { return; } // Skip duplicates

          let catalog_len = catalogNum.length;
          for (let i = 0; i <= catalog_len; i++) {
            let course_number = catalogNum.slice(0, i);
            if (!subjects[subject][course_number]) {
              subjects[subject][course_number] = [];
            }
            subjects[subject][course_number].push(course);
          }
        });
    }

    getProcessedData(subjects, subject, course_number) {
      let result = [];
      if (subjects[subject][course_number]) {
        result = subjects[subject][course_number];
      }
      return result;
    }

     loadDateSpecificTerm(subject, course_number, term) {
        if (this.termSubjects[term] && this.termSubjects[term][subject]) {
          this.notify(this.getProcessedData(this.termSubjects[term], subject, course_number));
          return;
        }
        let endPointUrl = this.constructTermEndPointUrl(subject, term);
        if (term == "N/A") {
          endPointUrl = this.constructCoursesEndPointUrl(subject);
        }
        $.getJSON(endPointUrl + "?key=" + apiKey, (data) => {
            if (!this.termSubjects[term]) {
              this.termSubjects[term] = {};
            }
            this.storeCoursesInSubject(this.termSubjects[term], data.data, subject);
            this.notify(this.getProcessedData(this.termSubjects[term], subject, course_number));
        });
     }

     loadSubjects() {
       // This endpoint requires no parameters since it fetches all subjects offered
       $.getJSON("https://api.uwaterloo.ca/v2/codes/subjects.json" + "?key=" + apiKey, (data) => {
         _.forEach(data.data, subjectInfo => {
           this.availableSubjects.push(subjectInfo["subject"]);
         });
         this.notify([]); // Empty Array to signal no courses fetched
       });
     }

		// Add observer functionality to AppModel objects:

		// Add an observer to the list
		addObserver(observer) {
        if (_.isUndefined(this._observers)) {
            this._observers = [];
        }
        this._observers.push(observer);
        observer(this, null);
    }

		// Notify all the observers on the list
		notify(args) {
        if (_.isUndefined(this._observers)) {
            this._observers = [];
        }
        _.forEach(this._observers, (obs) => {
            obs(this, args);
          });
    }
  }

    /*
     * A view class.
     * model:  the model we're observing
     * div:  the HTML div where the content goes
     */
    class AppView {
		constructor(model, div) {
			this.that = this;
			this.model = model;
			this.div = div;
			model.addObserver(this.updateView); // Add this View as an Observer
		}

    // args in array format
    updateView(obs, args) {
        if (args == null) return;

        // Check if we are populating the dropdown for the first time
        if (args.length == 0 && $("#subject option").length == 0){
            let selectedFirst = false;
            _.forEach(obs.availableSubjects, subject => {
              let optionHtml = "<option value='" + subject + "'>" + subject + "</option>";

              // Auto-select the first element
              if (!selectedFirst) {
                optionHtml = "<option value='" + subject + "' selected>" + subject + "</option>"
                selectedFirst = true;
              }
              $("#subject").append(optionHtml);
            });
            return;
        }

        $("#viewContent").empty(); // Clear contents

        // Show to user that no results were found
        if (args.length == 0) {
            $("#viewContent").append("<p>No results matched your query.</p>");
        }

        _.forEach(args, (course) => {
            let subject = course["subject"];
            let catalogNum = course["catalog_number"];
            let courseInfo = subject + catalogNum + ": " + course["title"];
            /*if (courseID.length > 50) {
              courseID = courseID.slice(0, 30) + "..."; // Truncate name
            }*/
            $("#viewContent").append("<div class='course' id='" + subject + "_"
              + catalogNum + "'>" + courseInfo + "</div>");
        });
    };

    addCourseInfo(event) {
      //console.log(event);
      let courseID = event.currentTarget.id;

      $("#" + courseID).removeClass("course")
      $("#" + courseID).addClass("course-clicked")
      let contents = courseID.split("_");
      let url = "https://api.uwaterloo.ca/v2/courses/" + contents[0] + "/" + contents[1] + ".json" + "?key=" + apiKey
      // TODO: Move this logic to the model and update the view in the view
      $.getJSON(url, (data) => {
          let prereqs = (data.data["prerequisites"] == null) ? "No prerequisites listed." : data.data["prerequisites"];
          let description = (data.data["description"] == null) ? "No description available." : data.data["description"];
          $("#" + courseID).append("<p>" + description + "</p>");
          $("#" + courseID).append("<p>Prereqs: " + prereqs + "</p>");
      });
    }

    removeCourseInfo(event) {
      let courseID = event.currentTarget.id;

      $("#" + courseID).removeClass("course-clicked")
      $("#" + courseID).addClass("course")
      let courseInfo = $("#" + courseID).html().split("<p>");
      if ($("#" + courseID + " p").length != 0) {
          $("#" + courseID).empty();
          $("#" + courseID).html(courseInfo[0]); // Get title
          return;
      }
    }
    }

	/*
		Function that will be called to start the app.
		Complete it with any additional initialization.
	*/
    exports.startApp = function() {
        var model = new AppModel();
        var view = new AppView(model, "div#viewContent");

        // The below functions make up my controller---------------------------
        $("#submit").click(() => {
          let subject = ($("#subject").val() === undefined) ? "" : $("#subject").val().toUpperCase();
          let courseNumber = ($("#course_number").val() === undefined) ? "" : $("#course_number").val();
          let term = $("#term").val().toUpperCase();
          model.loadDateSpecificTerm(subject, courseNumber, term);
        });

        $(document).on('click', ".course", (event) => {
          view.addCourseInfo(event);
        })

        $(document).on('click', ".course-clicked", (event) => {
          view.removeCourseInfo(event);
        })

        // Populate 'subjects' input using GET request results
        model.loadSubjects();

        // For spinner UI
        $(document).on({
          ajaxStart: function() { $("body").addClass("loading"); },
          ajaxStop: function() { $("body").removeClass("loading"); }
        });

        // END OF CONTROLLER -------------------------------------------------
    }

})(window);
