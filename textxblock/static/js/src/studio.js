function TextXBlock(runtime, element) {
  $(() => {
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
        },
        error: () => {
          console.log("error while retrieving get_Admin_input_data");
        },
      });
    }

    getAdminInputData();

    let selectedLanguage = $(element).find("#select").val();
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

        // Send the question text to the backend
        var handlerUrl = runtime.handlerUrl(element, "save_admin_input_data");
        $.ajax({
          type: "POST",
          url: handlerUrl,
          data: JSON.stringify({
            question_text: questionText,
            explanation: explanationValue,
            ans: answer,
            boilerplate: boilerPlateCode,
            language: selectedLanguage,
            marks: marks,
          }),
          success: saveAdminInputData,
        });
      });

    function saveAdminInputData(result) {
      console.log(result, " from showINputData function");
    }

    $(element)
      .find("#select")
      .on("change", () => {
        selectedLanguage = $(element).find("#select").val();
        console.log(selectedLanguage);
      });
  });
}
