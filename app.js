"use strict";

const apiKey = '3b07c47c9205c7b543754492bcd13167';

(function(exports) {
  class AppModel {
    constructor() {
      this.that = this;
      this.termSubjects = {};        // Track subjects + courses for terms
      this.availableSubjects = [];   // Track subjects that the school offers
    }

    // Constructs the URL for fetching courses under 'subject'
    constructCoursesEndPointUrl(subject) {
      let coreEndPointUrl = "https://api.uwaterloo.ca/v2/courses";
      if (subject != "") {
        coreEndPointUrl += "/" + subject;
      }
      return coreEndPointUrl + ".json";
    }

    // Contructs the URL for fetching courses under 'subject' and in 'term'
    constructTermEndPointUrl(subject, term) {
      let coreEndPointUrl = "https://api.uwaterloo.ca/v2/terms"
      let currentTime = new Date();
      if (term == "NEXT") {
        currentTime.setMonth(currentTime.getMonth() + 4);
      }

      // Compute the term number based on currentTime
      let termNumber = "1" + currentTime.getFullYear() % 100
                           + ((Math.floor(currentTime.getMonth() / 4) * 4) + 1);
      coreEndPointUrl += "/" + termNumber;

      // Target either the schedule or courses endpoint
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
       // For each course object, we cache in subjects[subject] every
       //    (0, i) substring of its course number for future lookup
        _.forEach(data, (course) => {
          let catalogNum = course["catalog_number"];
          if (subjects[subject][catalogNum]) { return; } // Skip duplicates
          for (let i = 0; i <= catalogNum.length; i++) {
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

    // Returns an array of course objects that are under 'subject', with prefix
    //  'course_number' and are offered during 'term'
    loadDateSpecificTerm(subject, course_number, term) {
      // If cached data exists, return that immediately
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

      // Check and show message if no results were found
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
        $("#viewContent").append("<div class='course' id='" + subject + "_" +
          catalogNum + "'>" + courseInfo + "</div>");
      });
    };

    addCourseInfo(event) {
      let courseID = event.currentTarget.id;
      $("#" + courseID).removeClass("course");
      $("#" + courseID).addClass("course-clicked");
      let contents = courseID.split("_");
      let url = "https://api.uwaterloo.ca/v2/courses/" + contents[0] + "/"
        + contents[1] + ".json" + "?key=" + apiKey;
      $.getJSON(url, (data) => {
        let prereqs = (data.data["prerequisites"] == null) ?
          "No prerequisites listed." : data.data["prerequisites"];
        let description = (data.data["description"] == null) ?
          "No description available." : data.data["description"];
        $("#" + courseID).append("<p>" + description + "</p>");
        $("#" + courseID).append("<p>Prereqs: " + prereqs + "</p>");
      });
    }

    removeCourseInfo(event) {
      const courseID = event.currentTarget.id;
      $("#" + courseID).removeClass("course-clicked")
      $("#" + courseID).addClass("course")
      const courseInfo = $("#" + courseID).html().split("<p>");
      if ($("#" + courseID + " p").length != 0) {
        $("#" + courseID).empty();
        $("#" + courseID).html(courseInfo[0]); // Get title
        return;
      }
    }
  }

  // Initializes the application
  exports.startApp = function() {
    var model = new AppModel();
    var view = new AppView(model, "div#viewContent");

    // The below functions make up the Controller---------------
    $("#submit").click(() => {
      let subject = ($("#subject").val() === undefined) ? "" : $("#subject").val().toUpperCase();
      let courseNumber = ($("#course_number").val() === undefined) ? "" : $("#course_number").val();
      let term = $("#term").val().toUpperCase();
      model.loadDateSpecificTerm(subject, courseNumber, term);
    });

    // Toggle course description on
    $(document).on('click', ".course", (event) => {
      view.addCourseInfo(event);
    });
    // Toggle course description off
    $(document).on('click', ".course-clicked", (event) => {
      view.removeCourseInfo(event);
    });

    // Populate 'subjects' input using GET request results
    model.loadSubjects();

    // Toggles spinner modal UI for app responsiveness
    $(document).on({
      ajaxStart: function() { $("body").addClass("loading"); },
      ajaxStop: function() { $("body").removeClass("loading"); }
    });
    // END OF CONTROLLER -------------------------------------------------
  }
})(window);
