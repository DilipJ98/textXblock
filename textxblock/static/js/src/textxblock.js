function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    let editor;
    let dbCode;
    let isEditorUpdated = false;
    let intervalOnPageLoad;
    let intervalOnSubmit;

    function clearIntervalsFunction() {
      clearInterval(intervalOnPageLoad);
      clearInterval(intervalOnSubmit);
    }

    //for initial question
    function questionUpdate(result) {
      $(element).find("#show-question").text(result.question);
    }
    //handler to get question data
    var handlerUrls = runtime.handlerUrl(element, "get_question_data");

    $.ajax({
      //ajax to manage question data
      type: "POST",
      url: handlerUrls,
      data: JSON.stringify({}),
      success: questionUpdate,
    });

    let localTaskId = localStorage.getItem("taskid");

    if (localTaskId) {
      $(element).find(".loader").show();
      $(element).find(".loader").text("we are fecthing your results....");
      $(element).find("#answer-validation").hide();
      $(element).find(".score").hide();
    }
    let isRequestinProgress = false;
    intervalOnPageLoad = setInterval(() => {
      if (!isRequestinProgress) {
        let handleUrlOfDb = runtime.handlerUrl(element, "get_task_result");

        if (localTaskId) {
          isRequestinProgress = true;
          $.ajax({
            type: "POST",
            url: handleUrlOfDb,
            data: JSON.stringify({ id: localTaskId }),
            success: (result) => {
              getTaskDetails(result);
              isRequestinProgress = false;
            },
            error: () => {
              isRequestinProgress = false;
              $(element)
                .find(".loader")
                .text("Error occurred, please try again.");
            },
          });
        }
      }
    }, 4000);

    function getTaskDetails(result) {
      console.log(result, " this is status of task");
      let dataOfResult = result.data;
      console.log(dataOfResult, " this is data of result ");
      if (dataOfResult && Array.isArray(dataOfResult)) {
        console.log("before assigning");
        if (!isEditorUpdated) {
          dbCode = dataOfResult[3];
          if (editor) {
            editor.setValue(dbCode);
          }
          isEditorUpdated = true;
        }
        console.log("after assigning");
      }
      taskResult(result);
    }

    function monacoEditor() {
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
          let initialValue =
            dbCode ||
            "public class Test {\n  public static void main(String[] args){\n \n  } \n}";

          editor = monaco.editor.create(document.getElementById("container"), {
            //an options object extra options for monaco
            value: initialValue,
            language: "java",
            theme: "vs-dark",
          });
          /*
          on clicking submit calling function 
          to get the user code from monaco editor
          */
          $(element)
            .find("#submit")
            .on("click", () => {
              userInputAnswer(editor.getValue());
              clearInterval(intervalOnPageLoad);
            });
        }, (err) => {
          console.error("failed to load monaco editor", err);
        });
      };
      //adding script in html head
      document.head.appendChild(requiredScript);
    }
    //calling monaco editor
    monacoEditor();

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
      localStorage.setItem("taskid", result.taskid);
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

    //for form data stuff
    $(element)
      .find("#form-submit")
      .on("click", (event) => {
        event.preventDefault();
        let name = $(element).find("#name").val();
        let role = $(element).find("role").val();

        formFunction(name, role);
      });
    function formFunction(name, role) {
      console.log(name, " name from js form");
      console.log(role, " role from js form");
      let formHandlerUrl = runtime.handlerUrl(element, "manage_form");
      $.ajax({
        type: "POST",
        url: formHandlerUrl,
        data: JSON.stringify({ name: name, role: role }),
        success: function (response) {
          console.log(response, " this is response from back end database");
        },
        error: function (err) {
          console.error("error subitting form", err);
        },
      });
    }
  });
}
