function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    let editor;
    let isEditorUpdated = false;
    let intervalOnPageLoad;
    let intervalOnSubmit;
    let isRequestinProgress = false;
    let pollingCount = 0;
    let isPolling = false;

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
          $(element).find(".loader").text("Error occurred, please try again.");
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
              editor.setValue(dataOfResult[4]);
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
          });
          console.log(data.boilerplate);
          console.log(data.language);
          makeInitialAjaxCall();
          /*
          on clicking submit calling function 
          to get the user code from monaco editor
          */
          console.log(editor.getValue(), "get ediot value");
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

    function showAnswerResult(result) {
      //storing task id in local storage
      //localStorage.setItem("taskid", result.taskid);
      let isRequestInProgress = false;
      $(element).find(".loader").show();
      $(element).find(".loader").text("Your code is compiling....");
      $(element).find("#answer-validation").hide();
      $(element).find(".score").hide();
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
        $(element).find("#answer-validation").text("Correct").show();
        $(element).find(".score").text(result.score).show();
        $(element).find(".loader").hide();
        //clearing interval after getting result
        clearIntervalsFunction();
      } else if (result.status === 400) {
        $(element).find("#answer-validation").text("Wrong").show();
        $(element).find("#show-answer").text(result.answer).show();
        $(element).find("#explaination").text(result.explanation).show();
        $(element).find(".score").text(result.score).show();
        $(element).find(".loader").hide();
        //clearing interval after getting result
        clearIntervalsFunction();
      } else {
        $(element).find(".loader").text("Your code is compiling....");
        $(element).find("#answer-validation").hide();
        $(element).find("#show-answer").hide();
        $(element).find(".score").hide();
        $(element).find("#explaination").hide();
      }
    }
  });
}
