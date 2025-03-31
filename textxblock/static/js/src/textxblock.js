function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    //meta tag for media queries
    let metaTag = document.createElement("meta");
    metaTag.name = "viewport";
    metaTag.content = "width=device-width, initial-scale=1.0";
    document.getElementsByTagName("head")[0].appendChild(metaTag);
    // $(element)
    //   .find(".answer-container-div")
    //   .css({ "pointer-events": "none", opacity: "0" });

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
      let timeDifference = 0;
      let minutesFromLocalStorage = 1;
      let secondsFromLocalStorage = 0;
      let isNewTimer = false;

      if (
        localStorage.getItem("time") &&
        localStorage.getItem("remainingTime")
      ) {
        let storedDate = new Date(localStorage.getItem("time"));
        timeDifference = currentDateTime - storedDate;

        let remainingTime = parseInt(localStorage.getItem("remainingTime"));
        minutesFromLocalStorage = Math.floor(remainingTime / 60);
        secondsFromLocalStorage = remainingTime % 60;
      } else {
        localStorage.setItem("time", currentDateTime.toISOString());
        localStorage.setItem("remainingTime", minutesFromLocalStorage * 60);
        isNewTimer = true;
      }

      if (isNewTimer || Math.floor(timeDifference / 60000) < 1) {
        startTimer(minutesFromLocalStorage, secondsFromLocalStorage);
      } else {
        isTImerEnd = true;
      }
    }

    function startTimer(min, sec) {
      let zeroBeforeSec = "0";
      let zeroBeforeMin = "0";

      let interval = setInterval(() => {
        sec--;
        if (sec < 0) {
          min--;
          sec = 59;
        }

        let formattedSec = sec < 10 ? zeroBeforeSec + sec : sec;
        let formattedMin = min < 10 ? zeroBeforeMin + min : min;
        let formattedTimer = `${formattedMin}:${formattedSec}`;

        //update the timer on the page
        document.querySelector("#timer").textContent = formattedTimer;

        //save the remaining time to localStorage
        localStorage.setItem("remainingTime", min * 60 + sec);

        if (min === 0 && sec === 0) {
          clearInterval(interval);
          isTImerEnd = true;
        }
      }, 1000);
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
      // console.log(result, " from get task details");
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
            //assigning the user input code to a varibale to use later in the code
            getUserAnswerFromDb = result.user_code;
            isEditorUpdated = true;
          }
        }
        //calling the task result function which will update the UI of code results
        showResults(result);
      } else {
        // console.log("no data receiving from get task details");
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
                theme: "vs-light",
                automaticLayout: true,
                padding: {
                  top: 15,
                  bottom: 10,
                },
                fontSize: 14,
                minimap: {
                  enabled: false,
                },
              }
            );

            monaco.languages.registerCompletionItemProvider("java", {
              provideCompletionItems: function () {
                const suggestions = [
                  {
                    label: "printHello",
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'System.out.println("Hello, World!");',
                    insertTextRules:
                      monaco.languages.CompletionItemInsertTextRule
                        .InsertAsSnippet,
                    documentation: "Inserts a print statement",
                  },
                ];
                console.log("Suggestions:", suggestions);
                return { suggestions };
              },
            });

            editor.onDidChangeModelContent((event) => {
              if (event.changes.length > 0) {
                setTimeout(() => {
                  editor.trigger(
                    "keyboard",
                    "editor.action.triggerSuggest",
                    {}
                  );
                }, 300);
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

    $(document).ready(function () {
      function updateBorders() {
        var contentWidth = $("#content").outerWidth();
        var contentLeft = $("#content").offset().left; // Get left position of #content

        console.log(contentWidth, contentLeft, "content width and left");

        // Apply styles dynamically
        $("<style>")
          .prop("type", "text/css")
          .html(
            `
            .textxblock-container::before,
            .textxblock-container::after {
              width: ${contentWidth}px !important;
              left: ${contentLeft}px !important;
            }
          `
          )
          .appendTo("head");
      }

      // Run on page load
      updateBorders();

      // Run on window resize (to adjust dynamically)
      $(window).resize(updateBorders);
    });

    //on code check box it will show answer editor
    $(element)
      .find(".output-select")
      .on("change", function (e) {
        if (isTImerEnd) {
          toggleAnswer();
        } else {
          $(this).val("Output");
        }
      });

    function toggleAnswer() {
      if (!isCheckBoxChecked && isTImerEnd) {
        $(element).find(".answer-container").text(dataFromInitiaRequest.answer);
        $(element).find(".answer-container").css({
          "pointer-events": "auto",
          opacity: "1",
          transition: "opacity 1s ease-in",
        });
        isCheckBoxChecked = true;
      } else {
        $(element).find(".answer-container").text("");
        // $(element).find(".answer-container").css({
        //   "pointer-events": "none",
        //   opacity: "0",
        //   transition: "opacity 1s ease-out",
        // });
        isCheckBoxChecked = false;
      }
    }

    //for theme changes
    $(element)
      .find(".theme-changer")
      .on("change", () => {
        // toggleTheme();
      });

    function toggleTheme() {
      if (!isThemeUpdated) {
        monaco.editor.setTheme("vs-dark");
        // $(element).find(".textxblock-container").css({
        //   "background-color": "black",
        //   border: "1px solid rgba(255, 255, 255, 0.5)",
        // });

        //code editor menu
        $(element).find(".code-editor-menu").css({
          "background-color": "#333",
          border: "1px solid rgba(255, 255, 255, 0.5)",
        });

        //progress results
        $(element).find(".progress-results").css({
          "background-color": "#0a84ff2e",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          borderTop: "none",
        });
        $(element).find(".editor-container").css({
          border: "1px solid rgba(255, 255, 255, 0.5)",
          borderTop: "none",
          borderBottom: "none",
        });
        $(element).find(".code-svg-div").css("color", "white");
        //answer container div
        $(element).find(".msg-answer-div").css({
          "background-color": "#333",
          border: "1px solid rgba(255, 255, 255, 0.5)",
        });
        //out put div
        $(element).find(".output-div").css({
          "background-color": "#333",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          borderBottom: "none",
        });

        //answer-container
        $(element).find(".answer-container").css({
          "background-color": "#1e1e1e",
          border: "1px solid #333",
          color: "#d4d4d4",
        });

        // .show-question-div
        $(element).find(".show-question-div").css({
          color: "white",
          // "background-color": "#1e1e1e",
        });

        //question mennu
        $(element).find(".question-menu").css({
          "background-color": "#333",
          border: "1px solid #888",
          // color: "#000",
        });

        $(element).find("#show-question").css({
          "background-color": "#1e1e1e",
          border: "1px solid #888",
          borderTop: "none",
          // borderBottom: "none",
        });

        //theme changer
        $(element).find(".theme-changer").css({
          "background-color": "#333",
          color: "white",
          border: "1px solid #888",
        });

        //timer div
        $(element).find(".timer-div").css({
          "background-color": "#333",
          border: "1px solid #888",
          color: "white",
        });

        //timer container
        $(element).find(".timer-container").css({
          // "background-color": "#f5f5f5",
          color: "white",
        });

        $(element).find(".reset").css({ "background-color": "transparent" });

        // //reset svg
        $(".reset svg path:first").attr("fill", "white");

        //language
        $(element).find(".language").css({
          "background-color": "#444",
          color: "#ffffff99",
          border: "1px solid #888",
          borderTop: "none",
          borderRight: "none",
        });

        //output select
        $(element).find(".output-select").css({
          background: "#444",
          color: "#ffffff99",
          border: "1px solid rgba(255, 255, 255, 0.5)",
        });

        //code svg over
        $(".code-svg-div").hover(
          function () {
            $(this).css({
              "background-color": " #444",
              "border-radius": "3px",
              // border: "1px solid #888",
            });
          },
          function () {
            $(this).css({
              "background-color": "",
              "border-radius": "",
              border: "none",
            });
          }
        );

        //results
        $(element).find(".results-marks").css({ color: "white" });
        $(element).find(".results").css({ color: "white" });

        isThemeUpdated = true;
      } else {
        monaco.editor.setTheme("vs-light");
        // $(element).find(".code-editor-menu").css("background-color", "#f5f5f5");
        $(element).find(".code-editor-menu").css({
          "background-color": "#f5f5f5",
          border: "1px solid #ddd",
        });
        $(element).find(".progress-results").css({
          "background-color": "#0a84ff2e",
          border: "1px solid #ddd",
          borderTop: "none",
        });
        $(element).find(".editor-container").css({
          border: "1px solid #ddd",
          borderTop: "none",
          borderBottom: "none",
        });
        $(element).find(".code-svg-div").css("color", "#000");
        // $(element).find(".textxblock-container").css({
        //   "background-color": "#f5f5f5",
        //   border: "1px solid #ddd",
        // });

        //answer container div
        $(element).find(".msg-answer-div").css({
          "background-color": "#f5f5f5",
          border: "1px solid #ddd",
          borderTop: "none",
        });

        //out put div
        $(element).find(".output-div").css({
          "background-color": "#f5f5f5",
          border: "1px solid #ddd",
        });

        //answer-container
        $(element)
          .find(".answer-container")
          .css({ "background-color": "white", border: "none", color: "black" });

        //.show-question-div
        $(element).find(".show-question-div").css({
          // "background-color": "#f5f5f5",
          // borderBottom: "1px solid #ddd",
          color: "#000",
        });
        //question mennu
        $(element).find(".question-menu").css({
          "background-color": "#f5f5f5",
          border: "1px solid #ddd",
          color: "#000",
        });

        $(element).find("#show-question").css({
          "background-color": "white",
          border: "1px solid #ddd",
          borderTop: "none",
          // borderBottom: "none",
        });

        //theme changer
        $(element).find(".theme-changer").css({
          "background-color": "white",
          color: "black",
          border: "1px solid #888",
        });

        //timer div
        $(element)
          .find(".timer-div")
          .css({ "background-color": "white", border: "1px solid #888" });

        //timer container
        $(element).find(".timer-container").css({
          // "background-color": "#f5f5f5",
          color: "#000",
        });

        //reset svg
        $(".reset svg path:first").attr("fill", "black");

        //language
        $(element).find(".language").css({
          "background-color": "#f5f5f5",
          color: "black",
          border: "1px solid #ddd",
          borderTop: "none",
          borderRight: "none",
        });

        //output select
        $(element).find(".output-select").css({
          "background-color": "white",
          color: "black",
          border: "1px solid #888",
        });

        //code svg over
        $(".code-svg-div").hover(
          function () {
            $(this).css({
              "background-color": "#fff",
              "border-radius": "3px",
              // border: "1px solid #888",
            });
          },
          function () {
            $(this).css({
              "background-color": "",
              "border-radius": "",
              border: "none",
            });
          }
        );

        //results
        $(element).find(".results-marks").css({ color: "black" });
        $(element).find(".results").css({ color: "black" });

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
      // calling user input answer function which will get the value during submit
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
            },
          });
        }
      } else {
        console.log("no reset was done");
      }
    }

    function getTaskResult(result) {
      // console.log(result, " from handler task method response");
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
              // console.log(
              //   response,
              //   " this is response from get task result handler"
              // );
              // //based on the celery task status it will updted the resul for progress bar
              if (
                response.status !== "pending" &&
                response.status !== "error"
              ) {
                animateProgress(100);
              } else {
                // console.log("inside else");
                //which ensures the progress bar not to exceed 100%
                let finalProgressLoad = Math.min(progressLoad + 10, 100);
                animateProgress(finalProgressLoad);
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
            },
          });
        }
      }, 5000);
    }

    function animateProgress(targetProgress) {
      let currentProgress = progressLoad;
      function updateProgress() {
        if (currentProgress < targetProgress) {
          currentProgress++;
          $(element)
            .find("#progressBar")
            .css("width", currentProgress + "%");
          $(element)
            .find("#progressBar")
            .text(currentProgress + "%");
          setTimeout(updateProgress, 50);
        } else {
          progressLoad = targetProgress;
        }
      }
      updateProgress();
    }

    //which manages to show results and progress bar
    function showResults(result) {
      // console.log(result, " inside show results");
      if (result.status === "ready") {
        $(element).find(".progressBar-div").hide();
        $(element).find(".results-div").css({ opacity: "1" });
        $(element).find(".results-div").show();
        $(element)
          .find(".results")
          .text(`Solution Correct: ${result.is_correct}`);
        $(element).find(".results-marks").text(`Marks: ${result.score}`);
        $(element).find(".answer-container").text(`${result.message}`);

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
