function TextXBlock(runtime, element) {
  function updateQuestion(result) {
    console.log(result.question);
  }

  let selectedLanguage = $(element).find("#select").val();

  $(element)
    .find("#button")
    .on("click", function (event) {
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

      // Send the question text to the backend
      var handlerUrl = runtime.handlerUrl(element, "question_data");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({
          question_text: questionText,
          explanation: explanationValue,
          ans: answer,
          boilerplate: boilerPlateCode,
          language: selectedLanguage,
        }),
        success: updateQuestion,
      });
    });

  $(element)
    .find("#select")
    .on("change", () => {
      selectedLanguage = $(this).val();
    });

  console.log(selectedLanguage);
}
