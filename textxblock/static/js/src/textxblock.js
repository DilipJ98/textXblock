function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    //meta tag for media queries
    let metaTag = document.createElement("meta");
    metaTag.name = "viewport";
    metaTag.content = "width=device-width, initial-scale=1.0";
    document.getElementsByTagName("head")[0].appendChild(metaTag);
    //whcih unchecks checkbox on page loads
    $(element).find(".show-ans-check").prop("checked", false);
    $(element)
      .find(".answer-container-div")
      .css({ "pointer-events": "none", opacity: "0" });

    let editor;
    let isEditorUpdated = false;
    let intervalOnPageLoad;
    let intervalOnSubmit;
    let isRequestinProgress = false;
    let pollingCount = 0;
    let isPolling = false;
    let isCheckBoxChecked = false;
    let getUserAnswerFromDb;
    let isThemeUpdated = false;
    let isResetRequestInProgress = false;
    let dataFromInitiaRequest;
    let progressLoad = 0;
    let isTImerEnd = false;

    //for clearing polling intervals
    function clearIntervalsFunction() {
      clearInterval(intervalOnPageLoad);
      clearInterval(intervalOnSubmit);
      isPolling = false;
    }

    function timerFun() {
      let currentDateTime = new Date();
      let timeDifference;
      let minutesFromLocalStorage = 0;
      let secondsFromLocalStorage = 0;

      // Check if the time data is stored in localStorage
      if (
        localStorage.getItem("time") &&
        localStorage.getItem("remainingTime")
      ) {
        let storedDate = new Date(localStorage.getItem("time"));
        timeDifference = currentDateTime - storedDate;
        console.log(
          Math.floor(timeDifference / 60000),
          " this is time difference"
        );
        // Calculate the remaining time based on the stored time
        let remainingTime = parseInt(localStorage.getItem("remainingTime"));
        minutesFromLocalStorage = Math.floor(remainingTime / 60);
        secondsFromLocalStorage = remainingTime % 60;
      } else {
        // if no time is stored, initialize the timer and save the start time
        minutesFromLocalStorage = 2; // intiallly set to 5 min
        secondsFromLocalStorage = 0;
        localStorage.setItem("time", currentDateTime.toISOString());
        localStorage.setItem(
          "remainingTime",
          minutesFromLocalStorage * 60 + secondsFromLocalStorage
        );
      }

      let count = secondsFromLocalStorage;
      let min = minutesFromLocalStorage;
      let zeroBeforeSec = "0";
      let zeroBeforeMin = "0";

      if (Math.floor(timeDifference / 60000) < 2) {
        let interval = setInterval(() => {
          count--;
          if (count < 0) {
            min--;
            count = 59;
          }

          let formattedCount = count < 10 ? zeroBeforeSec + count : count;
          let formattedMin = min < 10 ? zeroBeforeMin + min : min;
          let formattedTimer = `${formattedMin}:${formattedCount}`;

          // Update the timer on the page
          $(element).find("#timer").text(formattedTimer);

          // Save the remaining time to localStorage each second
          localStorage.setItem("remainingTime", min * 60 + count);

          if (min === 0 && count === 0) {
            clearInterval(interval);
            isTImerEnd = true;
            // localStorage.removeItem("time");
            // localStorage.removeItem("remainingTime");
          }
        }, 1000);
      } else {
        isTImerEnd = true;
      }
    }

    timerFun();

    /*
    which will used to get the admin input data that is comes from studio or editor admin input Fileds
    like question, ans, boilerplate code, explanation, language
    */
    function getAdminInputData() {
      var handlerUrls = runtime.handlerUrl(element, "get_admin_input_data");
      $.ajax({
        type: "POST",
        url: handlerUrls,
        data: JSON.stringify({}),
        success: (data) => {
          $(element).find("#show-question").text(data.question); //which will update UI with question
          $(element).find(".lang").text(data.language);
          dataFromInitiaRequest = data;
          monacoEditor(data); //calling monaco editor
        },
        error: (xhr) => {
          console.error("error occured", xhr.statusText);
          $(element)
            .find("#show-question")
            .text("Error occured, please try again");
        },
      });
    }

    //calling function to execute
    getAdminInputData();

    //polling function
    function startPollingFun() {
      if (pollingCount < 5 && !isPolling) {
        isPolling = true;
        intervalOnPageLoad = setInterval(() => {
          if (!isRequestinProgress) {
            pollingCount++;
            makeInitialAjaxCall();
          }
          if (pollingCount >= 5) {
            clearIntervalsFunction();
            isPolling = false;
          }
        }, 10000);
      } else {
        //clearing plooing interval on count more than 5
        clearIntervalsFunction();
      }
    }

    //this function will be called after monaco editor is initialized
    //because this function gets the data from the database and updates UI that previous code inputs and results
    function makeInitialAjaxCall() {
      let handleUrlOfDb = runtime.handlerUrl(element, "on_intial_load");
      isRequestinProgress = true;
      $.ajax({
        type: "POST",
        url: handleUrlOfDb,
        data: JSON.stringify({}),
        success: (result) => {
          getTaskDetails(result);
          isRequestinProgress = false;
          //checks the status of celery task is pending or not
          //incase the celery task is pening it will start polling to get the result
          if (!isPolling && result.status === "pending") {
            startPollingFun();
          }
        },
        error: (xhr) => {
          isRequestinProgress = false;
          console.error("error occures", xhr.statusText);
          $(element).find(".progressBar-div").hide();
          $(element).find(".results-div").show();
          $(element)
            .find(".results-div")
            .text("Error occurred, please try again..........");
        },
      });
    }

    //this will be called on successfull ajax request of initail load call
    function getTaskDetails(result) {
      console.log(result, " from get task details");
      //checks if there is any data is available
      if (result.user_code !== "") {
        //checks if the monaco editor updated with code
        if (!isEditorUpdated) {
          if (editor) {
            editor.setValue("");
            //showing the input data code on the editor
            editor.setValue(result.user_code);
            //if the data is exist it it will show fetching results on page realods
            $(element).find(".results-div").show();
            $(element).find(".results").text("We are fetching your results...");
            $(element).find(".results-marks").text("");
            $(element).find(".msg").text("");
            //assigning the user input code to a varibale to use later in the code
            getUserAnswerFromDb = result.user_code;
            isEditorUpdated = true;
          }
        }
        //calling the task result function which will update the UI of code results
        showResults(result);
      } else {
        console.log("no data receiving from get task details");
        //clearing interval if there is no data avaialbale on the intial load
        //this will effectively stop polling if there is no data available in db
        clearIntervalsFunction();
      }
    }

    function monacoEditor(data) {
      try {
        //monaco editor shows initailly
        var requiredScript = document.createElement("script");
        /*
      initialize  script src with the url of requireJs hosted in
      the cdn which tells the browser to load requireJS from this url
      */
        requiredScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js";

        //on loading the url
        requiredScript.onload = () => {
          //after loading url configure requireJS by defining path for modules
          //vs points to the url where monaco edior files are located
          //this allow us to load the monaco editor
          require.config({
            paths: {
              vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs",
            },
          });
          //load the monaco editor
          //this tells the requireJs to load the vs/editor/ediot.main module which is main entry

          require(["vs/editor/editor.main"], () => {
            //this is call back that runs once module load is successful
            //creating editor instance
            editor = monaco.editor.create(
              document.getElementById("container"),
              {
                //an options object extra options for monaco
                value: data.boilerplate,
                language: data.language,
                theme: "vs-dark",
                padding: {
                  top: 15,
                  bottom: 10,
                },
                minimap: {
                  enabled: false,
                },
              }
            );

            //this is will resizes the monaco editor on screen size changes
            window.addEventListener("resize", () => {
              if (editor) {
                editor.layout();
              }
            });

            //which is baiscally called on initial page relaod
            makeInitialAjaxCall();

            //showing text xblock container
            $(".loader-overlay").fadeOut(500);
          }, (err) => {
            console.error("failed to load monaco editor", err);
          });
        };
        //adding script in html head
        document.head.appendChild(requiredScript);
      } catch (error) {
        console.error("Erro in monaco editor", error);
      }
    }

    //on code check box it will show answer editor
    $(element)
      .find(".show-ans-check")
      .on("change", () => {
        toggleAnswer();
      });

    function toggleAnswer() {
      if (!isCheckBoxChecked && isTImerEnd) {
        $(element).find(".answer-container-div").css({
          "pointer-events": "none",
          opacity: "1",
          transition: "opacity 1s ease-in",
        });
        $(element).find(".answer-container").text(dataFromInitiaRequest.answer);
        $(element).find(".answer-container").css({
          "pointer-events": "auto",
          opacity: "1",
          transition: "opacity 1s ease-in",
        });
        isCheckBoxChecked = true;
      } else {
        $(element).find(".answer-container").css({
          "pointer-events": "none",
          opacity: "0",
          transition: "opacity 1s ease-out",
        });

        $(element).find(".answer-container-div").css({
          "pointer-events": "none",
          opacity: "0",
          transition: "opacity 1s ease-out",
        });
        isCheckBoxChecked = false;
      }
    }

    //for theme changes
    $(element)
      .find(".theme-changer")
      .on("change", () => {
        toggleTheme();
      });

    function toggleTheme() {
      if (!isThemeUpdated) {
        monaco.editor.setTheme("vs-light");
        isThemeUpdated = true;
      } else {
        monaco.editor.setTheme("vs-dark");
        isThemeUpdated = false;
      }
    }

    //on clicking submit code button or run button
    $(element)
      .find("#submit")
      .on("click", () => {
        onCodeSubmit();
      });

    function onCodeSubmit() {
      $(element).find(".reset").css({ "pointer-events": "none" });
      progressLoad = 10;
      $(element).find(".results-div").hide();
      $(element)
        .find("#progressBar")
        .css("width", 0 + "%"); //on click initially it sets width to zero
      $(element).find(".progressBar-div").show();
      $(element)
        .find("#submit")
        .css({ "pointer-events": "none", opacity: "0.5" });
      //calling user input answer function which will get the value duing submit
      userInputAnswer(editor.getValue());
      clearIntervalsFunction();
    }

    //this function have the user input answer and which invokes after user clicks on code submit button
    function userInputAnswer(userAnswer) {
      let handlerUrl = runtime.handlerUrl(element, "handle_task_method");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({ user_input: userAnswer }),
        success: getTaskResult,
        error: (xhr) => {
          console.error("Error occurred:", xhr.statusText);
          $(element).find(".progressBar-div").hide();
          $(element).find(".results-div").show();
          $(element)
            .find(".results-div")
            .text("Error occurred, please try again.");
          $(element).find(".results").hide();
          $(element).find(".results-marks").hide();
          $(element).find(".msg").hide();
        },
      });
    }

    //for reset code to initail state
    //which will delete the previous stored data of the user input
    $(element).find(".reset").on("click", resetFunction);

    function resetFunction() {
      if (
        confirm(
          "Your current code will be discarded and reset to the default code!"
        )
      ) {
        let resetHandleUrl = runtime.handlerUrl(element, "delete_task");
        if (!isResetRequestInProgress) {
          isResetRequestInProgress = true;
          $.ajax({
            type: "POST",
            url: resetHandleUrl,
            data: JSON.stringify({}),
            success: (data) => {
              if (editor) {
                editor.setValue(dataFromInitiaRequest.boilerplate);
              }
              $(element).find(".results-div").hide();
              $(element).find(".progressBar-div").hide();
              isResetRequestInProgress = false;
            },
            error: (xhr) => {
              isResetRequestInProgress = false;
              console.error("Error occurred:", xhr.statusText);
              $(element).find(".progressBar-div").hide();
              $(element).find(".results-div").show();
              $(element)
                .find(".results-div")
                .text("Error occurred, please try again.");
              $(element).find(".results").hide();
              $(element).find(".results-marks").hide();
              $(element).find(".msg").hide();
            },
          });
        }
      } else {
        console.log("no reset was done");
      }
    }

    function getTaskResult(result) {
      console.log(result, " from handler task method response");
      //which manages progress bar
      $(element)
        .find("#progressBar")
        .css("width", progressLoad + "%");
      $(element)
        .find("#progressBar")
        .text(progressLoad + "%");
      let isRequestInProgress = false;
      //polls till celery return results
      intervalOnSubmit = setInterval(() => {
        let handlerUrl = runtime.handlerUrl(element, "get_task_result");
        if (!isRequestInProgress) {
          isRequestInProgress = true;
          $.ajax({
            type: "POST",
            url: handlerUrl,
            data: JSON.stringify({}),
            success: (response) => {
              console.log(
                response,
                " this is response from get task result handler"
              );
              //based on the celery task status it will updted the resul for progress bar
              if (
                response.status !== "pending" &&
                response.status !== "error"
              ) {
                console.log("inside if");
                progressLoad = 100; //if the celery results are ready it will show bar 100%
                $(element)
                  .find("#progressBar")
                  .css("width", progressLoad + "%");
                $(element)
                  .find("#progressBar")
                  .text(progressLoad + "%");
              } else {
                console.log("inside else");
                //which ensures the progree bar not to exceed 100%
                progressLoad = Math.min(progressLoad + 10, 100);
                $(element)
                  .find("#progressBar")
                  .css("width", progressLoad + "%");
                $(element)
                  .find("#progressBar")
                  .text(progressLoad + "%");
              }
              showResults(response);
              isRequestInProgress = false;
            },
            error: (xhr) => {
              isRequestInProgress = false;
              console.error("error occured ", xhr.statusText);
              $(element).find(".progressBar-div").hide();
              $(element).find(".results-div").show();
              $(element)
                .find(".results-div")
                .text("Error occurred, please try again.");
              $(element).find(".results").hide();
              $(element).find(".results-marks").hide();
              $(element).find(".msg").hide();
            },
          });
        }
      }, 5000);
    }

    //which manages to show results and progress bar
    function showResults(result) {
      console.log(result, " inside show results");
      if (result.status === "ready") {
        $(element).find(".progressBar-div").hide();
        $(element).find(".results-div").show();
        $(element)
          .find(".results")
          .text(`Solution Correct: ${result.is_correct}`);
        $(element).find(".results-marks").text(`Marks: ${result.score}`);
        $(element).find(".msg").text(`Message: ${result.message}`);

        $(element)
          .find("#submit")
          .css({ "pointer-events": "auto", opacity: "1" });
        $(element).find(".reset").css({ "pointer-events": "auto" });

        //clearing interval after getting result
        clearIntervalsFunction();
      } else {
        console.log(result.status, " from else ......");
      }
    }
  });
}
