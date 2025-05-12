function TextXBlock(runtime, element) {
  //loads intially
  $(() => {
    //meta tag for media queries
    let metaTag = document.createElement("meta");
    metaTag.name = "viewport";
    metaTag.content = "width=device-width, initial-scale=1.0";
    document.getElementsByTagName("head")[0].appendChild(metaTag);

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
    let selectedEditorLanguage;
    let isEditorLanguageUpdate = false;
    // let userInputCode;
    let ws;
    let language;
    let isThemeIconUpdated = false;
    let progressBarInterval;
    let isSubmitting = false;
    let resultsMessage = "";

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
          $(element).find(".text-left").text(data.fileName);
          // $(element).find(".lang").text(data.language);
          dataFromInitiaRequest = data;
          //monacoEditor();
          //calling monaco editor
          initializeMonacoEditor();
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
      console.log("inside make initial ajax call function");
      let handleUrlOfDb = runtime.handlerUrl(element, "on_intial_load");
      isRequestinProgress = true;
      $.ajax({
        type: "POST",
        url: handleUrlOfDb,
        data: JSON.stringify({}),
        success: (result) => {
          isRequestinProgress = false;
          if (result.status === "ready") {
            //calling the task result function which will update the UI of code results
            getInitialTaskDetails(result);
            showResults(result);
            clearIntervalsFunction();
          } else if (result.status === "pending") {
            //checks the status of celery task is pending or not
            //incase the celery task is pening it will start polling to get the result
            getInitialTaskDetails(result);
            if (!isPolling) {
              $(element).find(".results-div").show();
              $(element)
                .find(".results-div")
                .text("Please wait while we are grading...");
              startPollingFun();
            }
          } else if (result.status === "not_submitted") {
            clearIntervalsFunction();
          } else if (result.status === "error") {
            $(element)
              .find(".results-div")
              .show()
              .text("Error during grading...");
            clearIntervalsFunction();
          }
        },
        error: (xhr) => {
          isRequestinProgress = false;
          console.error("error occures", xhr.statusText);
          $(element).find(".progressBar-div").hide();
          $(element).find(".results-div").show();
          $(element).find(".results-div").text(xhr.statusText);
        },
      });
    }

    $(element)
      .find(".tabs-btn")
      .on("click", function () {
        toggleTabs.call(this);
      });

    function toggleTabs() {
      $(element).find(".tabs-btn").removeClass("active");
      $(this).addClass("active");
      const tab = $(this).data("tab");
      switch (tab) {
        case "code":
          $(element).find(".editors-div").show();
          $(element).find(".show-question-div").hide();
          $(element).find(".container-div").css({ display: "block" });
          $(element).find(".answer-container-div").css({ display: "none" });
          break;
        case "output":
          $(element).find(".editors-div").hide();
          // $(element).find(".language").hide();
          $(element).find(".show-question-div").hide();
          $(element).find(".code-editor-menu").hide();
          $(element).find(".container-div").css({ display: "block" });
          $(element).find(".answer-container-div").css({ display: "block" });
          break;

        case "question":
          $(element).find(".editors-div").hide();
          // $(element).find(".language").hide();
          $(element).find(".show-question-div").show();
          $(element).find(".code-editor-menu").hide();
          $(element).find(".container-div").css({ display: "none" });
          $(element).find(".answer-container-div").css({ display: "none" });
          break;
      }
    }

    $(window).resize(function () {
      if (window.innerWidth > 799) {
        $(element).find(".editors-div").removeAttr("style");
        $(element).find(".answer-container-div").removeAttr("style");
        $(element).find(".container-div").removeAttr("style");
        $(element).find(".show-question-div").removeAttr("style");
        // $(element).find(".language").removeAttr("style");
        $(element).find(".code-editor-menu").removeAttr("style");
        const selectedValue = !isThemeUpdated ? "dark" : "light";
        const themeSelect = $(element).find(".theme-changer");
        themeSelect.empty();

        themeSelect.append(`
          <option value="dark" ${
            selectedValue === "light" ? "selected" : ""
          }>Dark Mode</option>
          <option value="light" ${
            selectedValue === "dark" ? "selected" : ""
          }>Light Mode</option>
        `);
        //showing the default correct resize svg based on  chnaged screen size
        $(element).find("#resize-svg").show();
        $(element).find("#resize-svg-two").hide();
      } else {
        const codeTab = $(element).find('.tabs-btn[data-tab="code"]');
        $(element).find(".tabs-btn").removeClass("active");
        codeTab.addClass("active");
        toggleTabs.call(codeTab[0]);
        $(element).find(".answer-container-div").css({
          position: "",
          right: "",
          bottom: "",
          height: "",
          width: "",
          "z-index": "",
          border: "",
        });
        $(element).find(".output-div").css({ "border-top": "" });
      }
    });

    //this will be called on successfull ajax request of initail load call
    function getInitialTaskDetails(result) {
      console.log(result, "result from get initial task details function");
      // userInputCode = result.user_code;
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
            $(element)
              .find(".results-div")
              .text("We are fetching your results...");
            // $(element).find(".results-marks").text("");
            //assigning the user input code to a varibale to use later in the code
            getUserAnswerFromDb = result.user_code;
            isEditorUpdated = true;
          }
        }
      }
    }

    function updateEditorLanguage() {
      isEditorLanguageUpdate = true;

      if (dataFromInitiaRequest.user_submit_language) {
        if (dataFromInitiaRequest.user_submit_language === "java") {
          $(element)
            .find(".language")
            .append(
              `<option value="${dataFromInitiaRequest.user_submit_language}">${dataFromInitiaRequest.user_submit_language}</option>`
            );
          return {
            lang: "java",
            webSocketUri: "ws://host.docker.internal:3080/java",
            fileUri:
              "file:///C:/Users/Dilip/IdeaProjects/Java-intellisense/src/main/java/Test.java",
          };
        } else if (dataFromInitiaRequest.user_submit_language === "python") {
          $(element)
            .find(".language")
            .append(
              `<option value="${dataFromInitiaRequest.user_submit_language}">${dataFromInitiaRequest.user_submit_language}</option>`
            );
          return {
            lang: "python",
            webSocketUri: "ws://host.docker.internal:3080/python",
            fileUri: "file:///C:/Users/Dilip/work/example.py",
          };
        }
      } else if (!dataFromInitiaRequest.language) {
        let langs = ["java", "python"];
        langs.forEach((lang) => {
          $(element)
            .find(".language")
            .append(`<option value="${lang}">${lang}</option>`);
        });
        return {
          lang: "java",
          webSocketUri: "ws://host.docker.internal:3080/java",
          fileUri:
            "file:///C:/Users/Dilip/IdeaProjects/Java-intellisense/src/main/java/Test.java",
        };
      } else if (dataFromInitiaRequest.language === "python") {
        $(element)
          .find(".language")
          .append(
            `<option value="${dataFromInitiaRequest.language}">${dataFromInitiaRequest.language}</option>`
          );
        return {
          lang: "python",
          webSocketUri: "ws://host.docker.internal:3080/python",
          fileUri: "file:///C:/Users/Dilip/work/example.py",
        };
      } else if (dataFromInitiaRequest.language === "java") {
        $(element)
          .find(".language")
          .append(
            `<option value="${dataFromInitiaRequest.language}">${dataFromInitiaRequest.language}</option>`
          );
        return {
          lang: "java",
          webSocketUri: "ws://host.docker.internal:3080/java",
          fileUri:
            "file:///C:/Users/Dilip/IdeaProjects/Java-intellisense/src/main/java/Test.java",
        };
      }
    }

    function userSelectedEditorLanguage() {
      if (selectedEditorLanguage === "java") {
        return {
          lang: "java",
          webSocketUri: "ws://host.docker.internal:3080/java",
          fileUri:
            "file:///C:/Users/Dilip/IdeaProjects/Java-intellisense/src/main/java/Test.java",
        };
      } else if (selectedEditorLanguage === "python") {
        return {
          lang: "python",
          webSocketUri: "ws://host.docker.internal:3080/python",
          fileUri: "file:///C:/Users/Dilip/work/example.py",
        };
      }
    }

    function monacoEditor() {
      //which gets data from initial request and show the code in the editor basically contains boilerplate code and etc
      let data = dataFromInitiaRequest;
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
              vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
            },
          });
          //load the monaco editor
          //this tells the requireJs to load the vs/editor/ediot.main module which is main entry

          let updateLangueageStuff = !isEditorLanguageUpdate
            ? updateEditorLanguage()
            : userSelectedEditorLanguage();
          let editorLang = updateLangueageStuff.lang;
          language = editorLang;
          let webSocketUri = updateLangueageStuff.webSocketUri;
          let fileUri = updateLangueageStuff.fileUri;

          require(["vs/editor/editor.main"], () => {
            //this is call back that runs once module load is successful
            //creating editor instance
            let uri = monaco.Uri.parse(fileUri);

            let existingModel = monaco.editor.getModel(uri);

            if (existingModel) {
              //clearing exisitng model if any
              existingModel.dispose();
            }

            if (editor) {
              //clearing existing editor instance if any
              editor.dispose();
            }

            let model = monaco.editor.createModel(
              editorLang === "java"
                ? "class Main {\n\tpublic static void main(String args[]) {\n\n\t}\n}"
                : "def main():\n",
              editorLang,
              uri
            );

            //for white theme of monaco editor
            monaco.editor.defineTheme("monaco-white-theme", {
              base: "vs",
              inherit: true,
              rules: [
                {
                  token: "keyword",
                  foreground: "ff007f",
                  // fontStyle: "bold",
                },
                { token: "string", foreground: "008000" },
                { token: "identifier", foreground: "0000ff" },
                { token: "comment", foreground: "888888", fontStyle: "italic" },
                { token: "number", foreground: "ff4500" },
              ],

              colors: {
                "editor.background": "#ffffff",
                "editorLineNumber.foreground": "#999999",
              },
            });

            //for dark theme of monaco editor
            monaco.editor.defineTheme("monaco-dark-theme", {
              base: "vs-dark",
              inherit: true,
              rules: [
                { token: "keyword", foreground: "ff007f" },
                { token: "string", foreground: "7CFC00" },
                { token: "identifier", foreground: "00bfff" },
                { token: "comment", foreground: "aaaaaa", fontStyle: "italic" },
                { token: "number", foreground: "ffa500" },
              ],
              colors: {
                "editor.background": "#1e1e1e",
                "editorLineNumber.foreground": "#858585",
              },
            });

            editor = monaco.editor.create(
              document.getElementById("container"),
              {
                //an options object extra options for monaco
                model: model,
                theme: !isThemeUpdated
                  ? "monaco-white-theme"
                  : "monaco-dark-theme",
                automaticLayout: true,
                padding: {
                  top: 15,
                  bottom: 10,
                },
                fontSize: 14,
                minimap: {
                  enabled: false,
                },
                scrollbar: {
                  // vertical: "hidden",
                  horizontal: "hidden",
                  verticalScrollbarSize: 4,
                  horizontalScrollbarSize: 4,
                },
                guides: {
                  indentation: false,
                },
                renderLineHighlight: "none",
                overviewRulerBorder: false,
                renderOverviewRuler: false,
              }
            );

            ws = new WebSocket(webSocketUri);

            //websocket stuff to get the real time sugestions from node js and JDTLS server

            // ws.close();

            ws.onclose = () => console.log("websocket connection closed");

            ws.onopen = () => {
              console.log("websocket connect opened");
              ws.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  method: "initialize",
                  id: 1,
                  params: {
                    processId: null,
                    capabilities: {},
                    rootUri: fileUri,
                  },
                })
              );
            };

            let initializedSent = false;
            let isDidOpenSent = false;

            ws.onmessage = (event) => {
              const message = JSON.parse(event.data);

              if (message.id === 1 && message.result && !initializedSent) {
                // console.log("initialized notification sent");
                initializedSent = true;
                ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "initialized",
                    params: {},
                  })
                );

                //sending did open notification to server
                ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "textDocument/didOpen",
                    params: {
                      textDocument: {
                        uri: fileUri,
                        languageId: editorLang,
                        version: 1,
                        text: editor.getValue(),
                      },
                    },
                  })
                );
                isDidOpenSent = true;
              }

              if (message.method === "textDocument/publishDiagnostics") {
                const diagnostics = message.params.diagnostics.map((diag) => ({
                  severity: mapSeverity(diag.severity),
                  message: diag.message,
                  startLineNumber: diag.range.start.line + 1,
                  startColumn: diag.range.start.character + 1,
                  endLineNumber: diag.range.end.line + 1,
                  endColumn: diag.range.end.character + 1,
                }));

                monaco.editor.setModelMarkers(
                  editor.getModel(),
                  editorLang,
                  diagnostics
                );
              } else if (message.id && message.result && ws.resolveHover) {
                const contents = message.result.contents;

                const markdown = Array.isArray(contents)
                  ? contents.map((c) =>
                      typeof c === "string" ? { value: c } : c
                    )
                  : typeof contents === "string"
                  ? [{ value: contents }]
                  : [contents];

                ws.resolveHover({
                  contents: markdown,
                  range: message.result.range
                    ? {
                        startLineNumber: message.result.range.start.line + 1,
                        startColumn: message.result.range.start.character + 1,
                        endLineNumber: message.result.range.end.line + 1,
                        endColumn: message.result.range.end.character + 1,
                      }
                    : undefined,
                });

                ws.resolveHover = null;
              } else if (message.result && message.result.items) {
                if (ws.resolveCompletion) {
                  try {
                    ws.resolveCompletion({
                      suggestions: message.result.items
                        .map((item) => ({
                          label: item.label,
                          kind: mapCompletionKind(item.kind),
                          insertText: item.insertText,
                          details: item.detail
                            ? { description: item.detail }
                            : undefined,
                        }))
                        .filter(
                          (suggestion) =>
                            suggestion &&
                            suggestion.label &&
                            suggestion.kind !== undefined &&
                            suggestion.insertText &&
                            suggestion.insertText.length > 0
                        ),
                    });
                  } catch (e) {
                    console.error("Error mapping completion items", e);
                  }
                  ws.resolveCompletion = null;
                } else {
                  console.warn("No completion items found in response");
                  if (ws.resolveCompletion) {
                    ws.resolveCompletion({ suggestions: [] });
                    ws.resolveCompletion = null;
                  }
                }
              }
            };

            let version = 2;
            let sendDidChange = debounce(() => {
              if (!isDidOpenSent) return;

              try {
                ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "textDocument/didChange",
                    params: {
                      textDocument: {
                        uri: fileUri,
                        version: version++,
                      },
                      contentChanges: [{ text: editor.getValue() }],
                    },
                  })
                );
              } catch (error) {
                console.error("Error", error);
              }
            }, 10);

            editor.onDidChangeModelContent(sendDidChange);

            function debounce(func, delay) {
              let timeoutId;
              return function (...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
              };
            }

            let requestIdOfRegister = 2;
            monaco.languages.registerCompletionItemProvider(editorLang, {
              provideCompletionItems: (model, position) => {
                try {
                  return new Promise((resolve) => {
                    ws.resolveCompletion = resolve;
                    const lspRequest = {
                      jsonrpc: "2.0",
                      id: requestIdOfRegister++,
                      method: "textDocument/completion",
                      params: {
                        textDocument: {
                          uri: fileUri,
                        },
                        position: {
                          line: position.lineNumber - 1,
                          character: position.column - 1,
                        },
                      },
                    };
                    console.log("Sending to WebSocket:", lspRequest);
                    console.log("WebSocket readyState:", ws.readyState);
                    ws.send(JSON.stringify(lspRequest));
                  });
                } catch (error) {
                  console.error("Error in provideCompletionItems", error);
                }
              },
            });

            let requestIdOfHover = 2;
            monaco.languages.registerHoverProvider(editorLang, {
              provideHover: function (model, position) {
                return new Promise((resolve) => {
                  const lspRequest = {
                    jsonrpc: "2.0",
                    id: requestIdOfHover++,
                    method: "textDocument/hover",
                    params: {
                      textDocument: {
                        uri: model.uri.toString(),
                      },
                      position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                      },
                    },
                  };

                  ws.resolveHover = resolve;
                  ws.send(JSON.stringify(lspRequest));
                });
              },
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
        $(".loader-overlay").fadeOut(500);
      } catch (error) {
        console.error("Erro in monaco editor", error);
      }
    }

    //for toggle languages
    $(element)
      .find(".language")
      .on("change", (e) => {
        selectedEditorLanguage = e.target.value;
        initializeMonacoEditor();
      });

    function initializeMonacoEditor() {
      $(".second-overlay").fadeIn(200);
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.onclose = () => {
            ws = null;
            monacoEditor();
          };
          ws.close();
        } else {
          ws = null;
          monacoEditor();
        }
      } catch (error) {
        console.error("Error initializing Monaco Editor:", error);
      } finally {
        $(".second-overlay").fadeOut(800);
      }
    }

    function mapSeverity(severity) {
      switch (severity) {
        case 1:
          return monaco.MarkerSeverity.Error;
        case 2:
          return monaco.MarkerSeverity.Warning;
        case 3:
          return monaco.MarkerSeverity.Info;
        case 4:
          return monaco.MarkerSeverity.Hint;
        default:
          return monaco.MarkerSeverity.Warning;
      }
    }

    function mapCompletionKind(lspKind) {
      const monacoKindMap = {
        1: monaco.languages.CompletionItemKind.Text,
        2: monaco.languages.CompletionItemKind.Method,
        3: monaco.languages.CompletionItemKind.Function,
        4: monaco.languages.CompletionItemKind.Constructor,
        5: monaco.languages.CompletionItemKind.Field,
        6: monaco.languages.CompletionItemKind.Variable,
        7: monaco.languages.CompletionItemKind.Class,
        8: monaco.languages.CompletionItemKind.Interface,
        9: monaco.languages.CompletionItemKind.Module,
        10: monaco.languages.CompletionItemKind.Property,
        11: monaco.languages.CompletionItemKind.Unit,
        12: monaco.languages.CompletionItemKind.Value,
        13: monaco.languages.CompletionItemKind.Enum,
        14: monaco.languages.CompletionItemKind.Keyword,
        15: monaco.languages.CompletionItemKind.Snippet,
        16: monaco.languages.CompletionItemKind.Color,
        17: monaco.languages.CompletionItemKind.File,
        18: monaco.languages.CompletionItemKind.Reference,
        19: monaco.languages.CompletionItemKind.Folder,
        20: monaco.languages.CompletionItemKind.EnumMember,
        21: monaco.languages.CompletionItemKind.Constant,
        22: monaco.languages.CompletionItemKind.Struct,
        23: monaco.languages.CompletionItemKind.Event,
        24: monaco.languages.CompletionItemKind.Operator,
        25: monaco.languages.CompletionItemKind.TypeParameter,
      };

      return monacoKindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
    }

    //for extra  border on the text xblock container inside edx environment
    // $(document).ready(function () {
    //   function updateBorders() {
    //     var contentWidth = $(".ltr").outerWidth();
    //     if (window.innerWidth > 799) {
    //       $("<style>")
    //         .prop("type", "text/css")
    //         .html(
    //           `
    //         .textxblock-container::before,
    //         .textxblock-container::after {
    //           width: ${contentWidth}px !important;
    //         }
    //       `
    //         )
    //         .appendTo("head");
    //     }
    //   }

    //   updateBorders();

    //   $(window).resize(() => {
    //     updateBorders;
    //   });
    // });

    //on code check box it will show answer editor
    $(element)
      .find(".output-select")
      .on("change", function (e) {
        if (isTImerEnd) {
          toggleAnswer();
          $(this).val(e.target.value);
        } else {
          const timerText = $(element).find(".timer-text");
          timerText.show();

          setTimeout(() => {
            timerText.fadeOut();
          }, 4000);
          $(this).val("output");
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
        $(element).find(".answer-container").text(resultsMessage);
        isCheckBoxChecked = false;
      }
    }

    //for theme changes
    $(element)
      .find(".theme-changer")
      .on("change", () => {
        $("body").toggleClass("dark-mode");
        toggleTheme();
      });

    function toggleTheme() {
      if (!isThemeUpdated) {
        monaco.editor.setTheme("monaco-dark-theme");
        isThemeUpdated = true;
      } else {
        monaco.editor.setTheme("monaco-white-theme");
        isThemeUpdated = false;
      }
    }

    $(element)
      .find(".theme-icon-div")
      .on("click", () => {
        $("body").toggleClass("dark-mode");
        toggleTheme();
      });

    let isResizeClicked = false;
    $(element)
      .find(".resize")
      .on("click", () => {
        resizeFunction();
      });

    function resizeFunction() {
      if (!isResizeClicked) {
        $(element).find("#resize-svg").css({ display: "none" });
        $(element).find("#resize-svg-two").css({ display: "block" });
        $(element).find(".container-div").css({
          width: "100%",
          position: "absolute",
          // border: "1px solid blue",
        });
        $(element).find(".editors-div").css({
          position: "absolute",
          height: "100%",
          "z-index": "999",
          // border: "1px solid red",
          // "border-radius": "5px",
        });
        // $(element).find(".answer-container-div").css({ display: "none" });
        isResizeClicked = true;
      } else {
        $(element).find(".answer-container-div").css({
          position: "",
          right: "",
          bottom: "",
          height: "",
          width: "",
          "z-index": "",
          border: "",
        });
        $(element).find(".output-div").css({ "border-top": "" });
        $(element).find("#resize-svg").css({ display: "block" });
        $(element).find("#resize-svg-two").css({ display: "none" });
        $(element).find(".container-div").css({ width: "", position: "" });
        $(element).find(".editors-div").css({ position: "", height: "" });
        // $(element).find(".answer-container-div").css({ display: "" });
        isResizeClicked = false;
      }
    }

    //on clicking submit code button or run button
    $(element)
      .find("#submit, #submit-small")
      .on("click", () => {
        onCodeSubmit();
      });

    function onCodeSubmit() {
      isSubmitting = true;

      if (progressBarInterval) {
        clearTimeout(progressBarInterval);
      }
      clearIntervalsFunction();
      progressLoad = 0;

      if (isResizeClicked && window.innerWidth > 799) {
        setTimeout(() => {
          $(element).find(".editors-div").css({
            position: "",
            height: "100%",
            "z-index": "",
          });

          $(element).find(".answer-container-div").css({
            position: "absolute",
            right: "10px",
            bottom: "40px",
            height: "50%",
            width: "50%",

            "z-index": "999",
            border: "none",
          });
          // $("body").toggleClass("dark-mode-large-screen");
          $(element)
            .find(".output-div")
            .css({ "border-top": "1px solid #ddd" });
        }, 2000);
      }

      if (window.innerWidth < 799) {
        const outputTab = $(element).find('.tabs-btn[data-tab="output"]');
        $(element).find(".tabs-btn").removeClass("active");
        outputTab.addClass("active");
        outputTab.click();
      }

      $(element).find(".reset, .reset-small").css({ "pointer-events": "none" });
      $(element).find("#submit-small").css({ "pointer-events": "none" });
      $(element).find(".arrow-small").hide();
      $(element).find(".run-text").hide();
      $(element).find(".small-loader-run").show();

      progressLoad = 10;
      $(element).find(".results-div").hide();
      $(element)
        .find("#progressBar")
        .css("width", 0 + "%"); //on click initially it sets width to zero
      $(element).find(".progressBar-div").show();
      $(element)
        .find("#submit")
        .css({ "pointer-events": "none", opacity: "0.5" });
      $(element)
        .find(".language")
        .css({ "pointer-events": "none", opacity: "0.5" });

      //setting answer to empty string on submit button click
      resultsMessage = "";
      manageOutputAnswer(resultsMessage);

      // calling user input answer function which will get the value during submit
      userInputAnswer(editor.getValue());
    }

    //this function have the user input answer and which invokes after user clicks on code submit button
    function userInputAnswer(userAnswer) {
      let handlerUrl = runtime.handlerUrl(element, "handle_task_method");
      $.ajax({
        type: "POST",
        url: handlerUrl,
        data: JSON.stringify({
          user_input: userAnswer,
          language: language,
        }),
        success: (result) => {
          console.log(result, " from handle task method response");
          isSubmitting = false;
          if (result.is_accepted) {
            getTaskResult(result);
          } else {
            console.log(result, " from else of handle task method response");
          }
        },
        error: (xhr) => {
          isSubmitting = false;
          setTimeout(() => {
            $(element)
              .find("#submit")
              .css({ "pointer-events": "auto", opacity: "1" });
            $(element)
              .find(".reset, .reset-small")
              .css({ "pointer-events": "auto" });
            $(element).find("#submit-small").css({ "pointer-events": "auto" });
            $(element).find(".small-loader-run").hide();
            $(element).find(".arrow-small").show();
            $(element).find(".run-text").show();
            $(element)
              .find(".results-div")
              .text("Error occurred, please try again.");
          }, 3000);
          $(element).find(".progressBar-div").hide();
          $(element).find(".results-div").show();
          $(element).find(".results-div").css({ opacity: "1" });
          // $(element).find(".results").hide();
          // $(element).find(".results-marks").hide();
          console.error("Error occurred:", xhr.statusText, xhr);
        },
      });
    }

    //for reset code to initail state
    //which will delete the previous stored data of the user input
    $(element).find(".reset, .reset-small").on("click", resetFunction);

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
              resultsMessage = "";
              manageOutputAnswer(resultsMessage);
              // isEditorLanguageUpdate = true;
              //clearing all drop down language options before reset
              $(element).find(".language").empty();
              isEditorLanguageUpdate = false;
              getAdminInputData();
              $(element)
                .find(".language")
                .css({ "pointer-events": "auto", opacity: "1" });
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
              // $(element).find(".results").hide();
              // $(element).find(".results-marks").hide();
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
        if (!isRequestInProgress && !isSubmitting) {
          isRequestInProgress = true;
          $.ajax({
            type: "POST",
            url: handlerUrl,
            data: JSON.stringify({}),
            success: (response) => {
              isRequestInProgress = false;
              try {
                // //based on the celery task status it will updted the resul for progress bar
                if (response.status === "ready") {
                  animateProgress(100, () => {
                    showResults(response);
                  });
                } else if (response.status === "error") {
                  clearIntervalsFunction(); //clear interval if error occurs
                  //managing progress bar and showing error message
                  $(element).find(".progressBar-div").hide();
                  $(element).find(".results-div").show();
                  $(element)
                    .find(".results-div")
                    .text(
                      response.error || "Error occurred, please try again."
                    );
                  // $(element).find(".results").hide();
                  // $(element).find(".results-marks").hide();
                } else if (response.status === "pending") {
                  //which ensures the progress bar not to exceed while polling 100%
                  let finalProgressLoad = Math.min(progressLoad + 10, 100);
                  if (finalProgressLoad > progressLoad) {
                    animateProgress(finalProgressLoad);
                  }
                }
              } catch (error) {
                console.error("Error updating DOM ", error);
                clearIntervalsFunction();
              }
            },
            error: (xhr) => {
              isRequestInProgress = false;
              clearIntervalsFunction();
              console.error("error occured ", xhr.statusText);
              $(element).find(".progressBar-div").hide();
              $(element).find(".results-div").show();
              $(element)
                .find(".results-div")
                .text("Error occurred, please try again.");
              // $(element).find(".results").hide();
              // $(element).find(".results-marks").hide();
            },
          });
        }
      }, 5000);
    }

    function animateProgress(targetProgress, onComplete) {
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
          progressBarInterval = setTimeout(updateProgress, 50);
        } else {
          progressLoad = targetProgress;
          //calling callback function to show results
          if (typeof onComplete === "function") {
            onComplete();
          }
          progressBarInterval = null;
        }
      }
      updateProgress();
    }

    //which manages to show results and progress bar
    function showResults(result) {
      progressLoad = 0;
      // console.log(result, " inside show results");
      //clearing interval after getting result
      clearIntervalsFunction();

      $(element).find(".progressBar-div").hide();
      $(element).find(".results-div").css({ opacity: "1" });
      $(element).find(".results-div").show();
      $(element).find(".results-div").text("");
      // $(element)
      //   .find(".results")
      //   .text(`Solution Correct: ${result.is_correct}`);
      // $(element).find(".results-marks").text(`Marks: ${result.score}`);

      resultsMessage = result.message;
      manageOutputAnswer(resultsMessage);

      $(element)
        .find("#submit")
        .css({ "pointer-events": "auto", opacity: "1" });
      $(element).find(".reset").css({ "pointer-events": "auto" });

      //for small screen run button
      $(element).find("#submit-small").css({ "pointer-events": "auto" });
      $(element).find(".arrow-small").show();
      $(element).find(".small-loader-run").hide();
      $(element).find(".run-text").show();

      //showing the language option but user not interact with it
      $(element)
        .find(".language")
        .css({ "pointer-events": "none", opacity: "1" });
    }

    function manageOutputAnswer(resultsMessage) {
      isCheckBoxChecked = false;
      //show ouput option in the drop down
      $(".output-select").val("output");
      //assigning the result message to the global results message variable and showing it in the answer container
      $(element).find(".answer-container").text(resultsMessage);
    }
  });
}
