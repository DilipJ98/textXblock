function TextXBlock(runtime, element) {
  $(element).find(".result-div").css("display", "none");
  //loads intially
  $(() => {
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

    let localStorageTaskId = localStorage.getItem("taskid");
    if (localStorageTaskId) {
      console.log(localStorageTaskId);
      let handlerForTaskDetails = runtime.handlerUrl(
        element,
        "get_task_details"
      );
      $.ajax({
        type: "POST",
        url: handlerForTaskDetails,
        data: JSON.stringify({}),
        success: getTaskDetails,
      });
    } else {
      console.log("there is no task id");
    }

    function getTaskDetails(result) {
      console.log(result);
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
          let editor = monaco.editor.create(
            document.getElementById("container"),
            {
              //an options object extra options for monaco
              value:
                "public class Test {\n  public static void main(String[] args){\n \n  } \n}",
              language: "java",
              theme: "vs-dark",
            }
          );
          /*
          on clicking submit calling function 
          to get the user code from monaco editor
          */
          $(element)
            .find("#submit")
            .on("click", () => {
              userInputAnswer(editor.getValue());
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
      //handler to save answer
      // var handlerUrl = runtime.handlerUrl(element, "verify_answer");
      // $.ajax({
      //   type: "POST",
      //   url: handlerUrl,
      //   data: JSON.stringify({ answer_text: userAnswer }),
      //   success: showAnswerResult,
      // });

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
      let interval = setInterval(() => {
        let handlerUrl = runtime.handlerUrl(element, "get_task_result");
        $.ajax({
          type: "POST",
          url: handlerUrl,
          data: JSON.stringify({ id: result.taskid }),
          success: taskResult,
        });
      }, 10000);

      //set timeout
      setTimeout(() => {
        clearInterval(interval);
      }, 60000);

      function taskResult(result) {
        console.log(result.status, " this is status it should true or false");
        $(element).find(".result-div").css("display", "block");
        if (result.status === 200) {
          console.log(result.status, " if");
          $(element).find("#answer-validation").text("Correct");
          $(element).find(".score").text(result.score);
          $(element).find("#show-answer").hide();
          $(element).find("#explaination").hide();
          $(element).find(".loader").hide();
        } else if (result.status === 400) {
          console.log(result.status, " else if");
          $(element).find("#answer-validation").text("Wrong");
          $(element).find("#show-answer").text(result.answer);
          $(element).find("#explaination").text(result.explanation);
          $(element).find(".score").text(result.score);
          $(element).find(".loader").hide();
        } else {
          console.log(result.status, " else");
          $(element).find(".loader").text("Your code is compiling....");
        }
      }
    }
  });
}
