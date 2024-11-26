function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    let metaTag = document.createElement("meta");
    metaTag.name = "viewport";
    metaTag.content = "width=device-width, initial-scale=1.0";
    document.getElementsByTagName("head")[0].appendChild(metaTag);

    $(element).find(".textxblock-container").css({ opacity: "0" });
    //whcih unchecks checkbox on page loads
    $(element).find(".show-ans-check").prop("checked", false);
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

    function clearIntervalsFunction() {
      clearInterval(intervalOnPageLoad);
      clearInterval(intervalOnSubmit);
      isPolling = false;
    }

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
          monacoEditor(data); //calling monaco editor
        },
        error: () => {
          $(element)
            .find("#show-question")
            .text("Error occured, please try again");
        },
      });
    }

    getAdminInputData();

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
          if (!isPolling && result.status === "pending") {
            startPollingFun();
          }
        },
        error: () => {
          isRequestinProgress = false;
          $(element)
            .find(".loader")
            .text("Error occurred, please try again..........");
        },
      });
    }

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
        clearIntervalsFunction();
      }
    }

    function getTaskDetails(result) {
      console.log("task started");
      if (result.data && Object.keys(result.data).length > 0) {
        console.log(result, " this is status of task");
        let dataOfResult = result.data;
        console.log(dataOfResult, " this is data of result ");
        if (dataOfResult && Array.isArray(dataOfResult)) {
          console.log("before assigning");
          if (!isEditorUpdated) {
            if (editor) {
              editor.setValue("");
              editor.setValue(dataOfResult[4]);
              getUserAnswerFromDb = dataOfResult[4];
              isEditorUpdated = true;
            }
          }
          console.log("after assigning");
        }
        taskResult(result);
      } else {
        console.log("no data receiving from get task details");
        clearIntervalsFunction();
      }
      console.log("task completed");
    }

    function monacoEditor(data) {
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
          editor = monaco.editor.create(document.getElementById("container"), {
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
          });
          $(element).find(".textxblock-container").css({ opacity: "1" });
          $(element)
            .find(".theme")
            .on("click", () => {
              if (!isThemeUpdated) {
                monaco.editor.setTheme("vs-light");
                //$(element).find(".code-editor-sub-menu").css({})
                $(element).find(".light-theme").hide();
                $(element).find(".dark-theme").show();
                $(element)
                  .find(".code-editor-menu")
                  .css({ "background-color": "white" });
                $(element).find(".lable-checkbox").css({ color: "black" });

                isThemeUpdated = true;
              } else {
                monaco.editor.setTheme("vs-dark");
                $(element).find(".dark-theme").hide();
                $(element).find(".light-theme").show();
                $(element)
                  .find(".code-editor-menu")
                  .css({ "background-color": "rgb(62, 62, 68)" });
                $(element).find(".lable-checkbox").css({ color: "white" });

                isThemeUpdated = false;
              }
            });

          $(element)
            .find(".answer-container")
            .css({ "pointer-events": "none", opacity: "0" });

          //editor to show answer
          monaco.editor.create(document.getElementById("answer-editor"), {
            value: data.answer,
            language: data.language,
            readOnly: true,
            padding: {
              top: 15,
              bottom: 10,
            },
            minimap: {
              enabled: false,
            },
          });

          $(element)
            .find(".show-ans-check")
            .on("change", () => {
              if (!isCheckBoxChecked) {
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
                isCheckBoxChecked = false;
              }
            });

          console.log(data.boilerplate);
          console.log(data.language);
          makeInitialAjaxCall();
          console.log(editor.getValue(), " get editor value");

          /*
          on clicking submit calling function 
          to get the user code from monaco editor
          */
          $(element)
            .find("#submit")
            .on("click", () => {
              userInputAnswer(editor.getValue());
              clearIntervalsFunction();
            });
        }, (err) => {
          console.error("failed to load monaco editor", err);
        });
      };
      //adding script in html head
      document.head.appendChild(requiredScript);
      console.log("monaco cmpleted");
    }

    //this function have the user input answer and which invokes after user clicks on code submit button
    function userInputAnswer(userAnswer) {
      let handlerUrl = runtime.handlerUrl(element, "handle_task_method");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({ user_input: userAnswer }),
        success: showAnswerResult,
      });
    }

    $(element).find(".reset").on("click", resetFunction);

    function resetFunction() {
      let resetHandleUrl = runtime.handlerUrl(element, "delete_task");
      if (!isResetRequestInProgress) {
        isResetRequestInProgress = true;
        $.ajax({
          type: "POST",
          url: resetHandleUrl,
          data: JSON.stringify({}),
          success: (data) => {
            console.log(data);
            editor.setValue("");
            console.log("monaco editor reset done successfully");
            isResetRequestInProgress = false;
          },
          error: () => {
            console.log("error while resetting state of editor");
            isResetRequestInProgress = false;
          },
        });
      }
    }

    function showAnswerResult(result) {
      //storing task id in local storage
      //localStorage.setItem("taskid", result.taskid);
      let isRequestInProgress = false;
      // $(element).find(".loader").show();
      // $(element).find(".loader").text("Your code is compiling....");
      // $(element).find("#answer-validation").hide();
      // $(element).find(".score").hide();
      intervalOnSubmit = setInterval(() => {
        let handlerUrl = runtime.handlerUrl(element, "get_task_result");
        if (!isRequestInProgress) {
          isRequestInProgress = true;
          $.ajax({
            type: "POST",
            url: handlerUrl,
            data: JSON.stringify({ id: result.taskid, xblock_id: result.test }),
            success: (result) => {
              taskResult(result);
              isRequestInProgress = false;
            },
            error: () => {
              isRequestInProgress = false;
              $(element)
                .find(".loader")
                .text("Error occurred, please try again.");
            },
          });
        }
      }, 5000);
    }

    function taskResult(result) {
      console.log(result);
      if (result.status === 200) {
        // $(element).find("#answer-validation").text("Correct").show();
        // $(element).find(".score").text(result.score).show();
        // $(element).find(".loader").hide();
        $(element).find("#submit").text("success");
        //clearing interval after getting result
        clearIntervalsFunction();
      } else if (result.status === 400) {
        // $(element).find("#answer-validation").text("Wrong").show();
        // $(element).find("#show-answer").text(result.answer).show();
        // $(element).find("#explaination").text(result.explanation).show();
        // $(element).find(".score").text(result.score).show();
        // $(element).find(".loader").hide();
        $(element).find("#submit").text("fail");
        //clearing interval after getting result
        clearIntervalsFunction();
      } else {
        $(element).find("#submit").text("processing");
        // $(element).find(".loader").text("Your code is compiling....");
        // $(element).find("#answer-validation").hide();
        // $(element).find("#show-answer").hide();
        // $(element).find(".score").hide();
        // $(element).find("#explaination").hide();
      }
    }
  });
}
