function TextXBlock(runtime, element) {
  $(() => {
    $(element).find("#repo-url").hide().val("");
    function getAdminInputData() {
      var handlerUrl = runtime.handlerUrl(element, "get_admin_input_data");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({}),
        success: (data) => {
          console.log(data, "show admin input data");
          $(element).find("#question-input").val(data.question);
          $(element).find("#Explanation").val(data.explanation);
          $(element).find("#actual-answer").val(data.answer);
          $(element).find("#boilerplate").val(data.boilerplate);
          $(element).find("#file-name").val(data.fileName);
          $(element).find("#repo-url").val(data.solutionRepo);
          // $(element).find("#expected-output").val(data.expectedOutput);
        },
        error: () => {
          console.log("error while retrieving get_Admin_input_data");
        },
      });
    }

    getAdminInputData();

    let selectedLanguage = $(element).find("#select-language").val();
    let executionMode = "direct";
    let repoUrl = null;
    let expectedOutput = 0;
    $(element)
      .find("#form")
      .submit(function (event) {
        event.preventDefault();
        let inputQuestionEle = $(element).find("#question-input");

        let questionText = inputQuestionEle.val();

        //explanation
        let explanationEle = $(element).find("#Explanation");
        let explanationValue = explanationEle.val();

        //actual answer
        let answerEle = $(element).find("#actual-answer");
        let answer = answerEle.val();

        //bolier plate
        let boilerPlateInputEle = $(element).find("#boilerplate");
        let boilerPlateCode = boilerPlateInputEle.val();

        let marks = $(element).find("#marks").val();

        let fileName = $(element).find("#file-name").val();

        expectedOutput =
          executionMode === "direct"
            ? $(element).find("#expected-output").val()
            : 0;
        repoUrl =
          executionMode === "repo" ? $(element).find("#repo-url").val() : null;

        // Send the question text to the backend
        var handlerUrl = runtime.handlerUrl(element, "save_admin_input_data");

        $.ajax({
          type: "POST",
          url: handlerUrl,
          data: JSON.stringify({
            questionText: questionText,
            explanation: explanationValue,
            ans: answer,
            boilerplate: boilerPlateCode,
            language: selectedLanguage,
            marks: marks,
            expectedOutput: expectedOutput,
            fileName: fileName,
            executionMode: executionMode,
            solutionRepo: repoUrl,
          }),
          success: (data) => {
            console.log("instructor data is saved successfully");
          },
        });
      });

    $(element)
      .find("#select-language")
      .on("change", () => {
        selectedLanguage = $(element).find("#select-language").val();
        console.log(selectedLanguage);
      });

    $(element)
      .find("#select-execution")
      .on("change", () => {
        selctedExecution = $(element).find("#select-execution").val();
      });

    $(element)
      .find(".checkBox")
      .on("change", function () {
        if ($(this).is(":checked")) {
          $(element).find("#repo-url").show().val("");
          $(element).find("#expected-output").hide().val(0);
          executionMode = "repo";
        } else {
          $(element).find("#repo-url").hide().val("");
          $(element).find("#expected-output").show().val("");
          executionMode = "direct";
        }
      });
  });
}
