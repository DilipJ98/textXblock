function TextXBlock(runtime, element) {
  function updateQuestion(result) {
    console.log(result.question);
  }

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

      // Send the question text to the backend
      var handlerUrl = runtime.handlerUrl(element, "question_data");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({
          question_text: questionText,
          explanation: explanationValue,
          ans: answer,
        }),
        success: updateQuestion,
      });
    });
}
