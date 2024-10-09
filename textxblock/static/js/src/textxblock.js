function TextXBlock(runtime, element) {
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

    let handleUrlOfDb = runtime.handlerUrl(element, "get_task_details_from_db");
    $.ajax({
      type: "POST",
      url: handleUrlOfDb,
      data: JSON.stringify({}),
      success: getTaskDetails,
    });

    function getTaskDetails(result) {
      let localTaskId = localStorage.getItem("taskid");
      let dataOfResult = result.data;
      let marks = 0;
      if (localTaskId) {
        dataOfResult.forEach((element) => {
          console.log(element[1], " xblock id");
          console.log(element[2], "taskid");
          console.log(element[3], "code");
          console.log(element[4], "result");
          marks = element[4];
        });
        $(element).find("#answer-validation").text("Correct");
        $(element).find(".score").text(marks);
      }
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
          data: JSON.stringify({ id: result.taskid, xblock_id: result.test }),
          success: taskResult,
        });
      }, 10000);

      //set timeout
      setTimeout(() => {
        clearInterval(interval);
      }, 60000);

      function taskResult(result) {
        console.log(result);
        if (result.status === 200) {
          $(element).find("#answer-validation").text("Correct");
          $(element).find(".score").text(result.score);
          $(element).find("#show-answer").hide();
          $(element).find("#explaination").hide();
        } else if (result.status === 400) {
          $(element).find("#answer-validation").text("Wrong");
          $(element).find("#show-answer").text(result.answer);
          $(element).find("#explaination").text(result.explanation);
          $(element).find(".score").text(result.score);
        } else {
          $(element).find(".loader").text("Your code is compiling....");
        }
      }
    }
  });
}
