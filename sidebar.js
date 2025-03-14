let isSolving = false;
let geminiToken = '';
let autoAnswerEnabled = false;  // Explicitly set default to false
let lastQuestionText = '';
let checkInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const debugLog = document.getElementById('debugLog');
  const questionOutput = document.getElementById('questionOutput');
  const answersOutput = document.getElementById('answersOutput');
  const tokenInput = document.getElementById('geminiToken');
  const saveTokenBtn = document.getElementById('saveToken');
  const autoAnswerToggle = document.getElementById('autoAnswerToggle');
  const autoAnswerStatus = document.getElementById('autoAnswerStatus');

  // Load saved token
  chrome.storage.local.get(['geminiToken'], (result) => {
    if (result.geminiToken) {
      geminiToken = result.geminiToken;
      tokenInput.value = geminiToken;
    }
  });

  // Save token
  saveTokenBtn.addEventListener('click', () => {
    geminiToken = tokenInput.value;
    chrome.storage.local.set({ geminiToken });
    log('API token saved');
  });

  // Auto-answer functionality
  document.getElementById('answer').addEventListener('click', async () => {
    if (!geminiToken) {
      log('Error: Please enter and save your API token first');
      return;
    }

    log('Starting auto-answer process...');
    
    // First grab the question and answers
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => {
          const question = document.querySelector('._questionText_1brbq_14').innerText;
          const answers = Array.from(document.querySelectorAll('._answersHolder_1brbq_62 > div')).map(div => div.innerText);
          return { question, answers };
        }
      }, async (results) => {
        if (results && results[0].result) {
          const { question, answers } = results[0].result;
          
          // Update UI
          questionOutput.textContent = `Question: ${question}`;
          answersOutput.innerHTML = '';
          answers.forEach((answer, index) => {
            answersOutput.innerHTML += `Answer ${index + 1}: ${answer}<br>`;
          });
          
          log(`Found question: "${question.substring(0, 30)}..."`);
          log(`Found ${answers.length} possible answers`);
          
          // Prepare message for AI
          const message = `Question: ${question}\n\n` + 
                          answers.map((answer, i) => `${i+1}. ${answer}`).join('\n');
          
          try {
            // Send to AI
            log('Sending to AI for analysis...');
            
            const requestBody = {
              contents: [
                {
                  parts: [
                    { text: message }
                  ]
                }
              ],
              system_instruction: {
                parts: [
                  { text: "Given a multiple-choice question, output only the number of the correct answer (e.g., 2) with no additional text; if you are unsure, use Google Search to verify your answer. Here is the question:" }
                ]
              },
              tools: [ { google_search: {} } ],
            };
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiToken}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
              const responseText = data.candidates[0].content.parts[0].text;
              log(`AI suggests answer: ${responseText}`);
              
              // Extract the number from the response
              let answerNumber = parseInt(responseText.trim().match(/\d+/)?.[0]);
              
              // If we couldn't determine a valid answer number, try one more time
              if (!answerNumber || answerNumber < 1 || answerNumber > answers.length) {
                log(`Could not determine valid answer number from first response. Trying again...`);
                
                // Try again with a more explicit prompt
                const retryRequestBody = {
                  contents: [
                    {
                      parts: [
                        { text: message + "\n\nPlease respond with ONLY a single number between 1 and " + answers.length }
                      ]
                    }
                  ],
                  system_instruction: {
                    parts: [
                      { text: "You must output ONLY a single digit number representing the correct answer (e.g., '2'). No explanations or other text. Just the number." }
                    ]
                  },
                  tools: [ { google_search: {} } ],
                };
                
                const retryResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiToken}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(retryRequestBody)
                });
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  if (retryData.candidates && retryData.candidates[0] && retryData.candidates[0].content && retryData.candidates[0].content.parts) {
                    const retryResponseText = retryData.candidates[0].content.parts[0].text;
                    log(`Second attempt AI response: ${retryResponseText}`);
                    answerNumber = parseInt(retryResponseText.trim().match(/\d+/)?.[0]);
                  }
                }
              }
              
              if (answerNumber && answerNumber >= 1 && answerNumber <= answers.length) {
                log(`Clicking answer ${answerNumber}...`);
                
                // Click the answer
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  function: (answerIndex) => {
                    function findAnswerButtons() {
                      const answerElements = document.querySelectorAll('._answersHolder_1brbq_62 > div');
                      if (!answerElements || answerElements.length === 0) {
                        return null;
                      }
                      
                      const answerButtons = [];
                      for (let i = 0; i < answerElements.length; i++) {
                        const element = answerElements[i];
                        if (element) {
                          const rect = element.getBoundingClientRect();
                          answerButtons.push({
                            element: element,
                            index: i + 1,
                            x: rect.left + (rect.width / 2),
                            y: rect.top + (rect.height / 2)
                          });
                        }
                      }
                      return answerButtons.length > 0 ? answerButtons : null;
                    }
                    
                    function simulateClick(x, y) {
                      const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: x,
                        clientY: y,
                        screenX: x,
                        screenY: y
                      });
                      
                      const element = document.elementFromPoint(x, y);
                      if (element) {
                        element.dispatchEvent(clickEvent);
                      }
                    }
                    
                    function clickAnswer(answerIndex) {
                      const buttons = findAnswerButtons();
                      if (!buttons) {
                        console.log('Could not find answer buttons');
                        return;
                      }
                      
                      if (answerIndex <= buttons.length) {
                        const button = buttons[answerIndex - 1];
                        simulateClick(button.x, button.y);
                        console.log(`Clicked answer ${answerIndex} at coordinates (${button.x}, ${button.y})`);
                      } else {
                        console.log(`Answer ${answerIndex} does not exist (only ${buttons.length} answers available)`);
                      }
                    }
                    
                    clickAnswer(answerIndex);
                  },
                  args: [answerNumber]
                });

                // Check result after clicking the answer
                if (autoAnswerEnabled) {
                  let attempts = 0;
                  const maxAttempts = 20; // Maximum number of attempts (10 seconds total)
                  
                  const checkResult = () => {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      function: () => {
                        const result = document.querySelector('._header_190yt_1')?.innerText;
                        return result;
                      }
                    }, (resultResults) => {
                      const resultOutput = document.getElementById('resultOutput');
                      if (resultResults && resultResults[0].result) {
                        const result = resultResults[0].result;
                        log(`Result found: ${result}`);
                        if (result.toLowerCase() === 'correct') {
                          resultOutput.textContent = 'Last Question: Correct';
                          resultOutput.style.color = 'green';
                        } else if (result.toLowerCase() === 'incorrect') {
                          resultOutput.textContent = 'Last Question: Incorrect';
                          resultOutput.style.color = 'red';
                        } else {
                          // If result is not yet "correct" or "incorrect", continue checking
                          if (attempts < maxAttempts) {
                            attempts++;
                            setTimeout(checkResult, 500); // Check every 500ms
                          } else {
                            resultOutput.textContent = 'Last Question: Timeout';
                            resultOutput.style.color = 'gray';
                            log('Timeout waiting for result');
                          }
                          return;
                        }
                      } else {
                        if (attempts < maxAttempts) {
                          attempts++;
                          setTimeout(checkResult, 500); // Check every 500ms
                        } else {
                          log('No result found after timeout');
                          resultOutput.textContent = 'Last Question: No result found';
                          resultOutput.style.color = 'gray';
                        }
                      }
                    });
                  };

                  checkResult(); // Start checking

                  // Check for "Click Anywhere to Go Next" text
                  const checkForNextText = () => {
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id },
                      function: () => {
                        const nextTextEl = document.querySelector('._nextText_4nfdm_76');
                        return nextTextEl ? nextTextEl.innerText : null;
                      }
                    }, (nextTextResults) => {
                      if (nextTextResults && nextTextResults[0].result) {
                        const nextText = nextTextResults[0].result;
                        if (nextText && nextText.toLowerCase().includes('click anywhere to go next')) {
                          log('Detected "Click Anywhere to Go Next" text');
                          setTimeout(() => {
                            chrome.scripting.executeScript({
                              target: { tabId: tabs[0].id },
                              function: () => {
                                const x = Math.floor(Math.random() * window.innerWidth);
                                const y = Math.floor(Math.random() * window.innerHeight);
                                
                                const clickEvent = new MouseEvent('click', {
                                  bubbles: true,
                                  cancelable: true,
                                  view: window,
                                  clientX: x,
                                  clientY: y
                                });
                                
                                document.elementFromPoint(x, y)?.dispatchEvent(clickEvent);
                                return `Clicked at coordinates (${x}, ${y})`;
                              }
                            }, (results) => {
                              if (results && results[0].result) {
                                log(results[0].result);
                              }
                            });
                          }, 100); // 0.1 second delay
                        } else {
                          setTimeout(checkForNextText, 500);
                        }
                      } else {
                        setTimeout(checkForNextText, 500);
                      }
                    });
                  };

                  checkForNextText(); // Start checking for "Click Anywhere to Go Next" text
                }
              } else {
                log(`Error: Could not determine valid answer number from AI responses after two attempts`);
              }
            } else {
              throw new Error('Invalid response structure from API');
            }
          } catch (error) {
            log(`Error: ${error.message}`);
            console.error('Full error:', error);
          }
        } else {
          log('Error: Could not find question or answers on the page');
        }
      });
    });
  });

  document.getElementById('grabQuestion').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => {
          const question = document.querySelector('._questionText_1brbq_14').innerText;
          const answers = Array.from(document.querySelectorAll('._answersHolder_1brbq_62 > div')).map(div => div.innerText);
          return { question, answers };
        }
      }, (results) => {
        if (results && results[0].result) {
          const { question, answers } = results[0].result;
          questionOutput.textContent = `Question: ${question}`;
          answersOutput.innerHTML = '';
          
          // Display answers and dynamically show/hide answer buttons
          answers.forEach((answer, index) => {
            answersOutput.innerHTML += `Answer ${index + 1}: ${answer}<br>`;
            
            // Show only the buttons for available answers
            const buttonElement = document.getElementById(`press${index + 1}`);
            if (buttonElement) {
              buttonElement.style.display = index < answers.length ? 'inline-block' : 'none';
            }
          });
          
          // Hide any remaining buttons that don't have corresponding answers
          for (let i = answers.length + 1; i <= 4; i++) {
            const buttonElement = document.getElementById(`press${i}`);
            if (buttonElement) {
              buttonElement.style.display = 'none';
            }
          }

          // Add a delay before checking the result
          setTimeout(() => {
            log('Checking result after delay...');
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              function: () => {
                const result = document.querySelector('._header_190yt_1')?.innerText;
                return result;
              }
            }, (resultResults) => {
              const resultOutput = document.getElementById('resultOutput');
              if (resultResults && resultResults[0].result) {
                const result = resultResults[0].result;
                log(`Result found: ${result}`);
                if (result.toLowerCase() === 'correct!') {  // Check for exact match
                  resultOutput.textContent = 'Last Question: Correct';
                  resultOutput.style.color = 'green';
                } else if (result.toLowerCase() === 'incorrect!') {  // Check for exact match
                  resultOutput.textContent = 'Last Question: Incorrect';
                  resultOutput.style.color = 'red';
                } else {
                  resultOutput.textContent = 'Last Question: Unknown';
                  resultOutput.style.color = 'gray';
                }
              } else {
                log('No result found');
                resultOutput.textContent = 'Last Question: No result found';
                resultOutput.style.color = 'gray';
              }
            });
          }, 5000); // Adjust the delay as needed
        } else {
          log('Could not find question or answers');
          questionOutput.textContent = 'Could not find question or answers';
          answersOutput.innerHTML = '';
          
          // Hide all buttons if no answers were found
          for (let i = 1; i <= 4; i++) {
            const buttonElement = document.getElementById(`press${i}`);
            if (buttonElement) {
              buttonElement.style.display = 'none';
            }
          }
        }
      });
    });
  });

  // Setup button click handlers for all possible buttons (1-4)
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`press${i}`).addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: (answerIndex) => {
            function findAnswerButtons() {
              const answerElements = document.querySelectorAll('._answersHolder_1brbq_62 > div');
              if (!answerElements || answerElements.length === 0) {
                return null;
              }
              
              const answerButtons = [];
              for (let i = 0; i < answerElements.length; i++) {
                const element = answerElements[i];
                if (element) {
                  const rect = element.getBoundingClientRect();
                  answerButtons.push({
                    element: element,
                    index: i + 1,
                    x: rect.left + (rect.width / 2),
                    y: rect.top + (rect.height / 2)
                  });
                }
              }

              return answerButtons.length > 0 ? answerButtons : null;
            }

            function simulateClick(x, y) {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y,
                screenX: x,
                screenY: y
              });

              const element = document.elementFromPoint(x, y);
              if (element) {
                element.dispatchEvent(clickEvent);
              }
            }

            function clickAnswer(answerIndex) { // answerIndex should be 1-based
              const buttons = findAnswerButtons();
              if (!buttons) {
                console.log('Could not find answer buttons');
                return;
              }

              // Check if the requested answer index exists
              if (answerIndex <= buttons.length) {
                const button = buttons[answerIndex - 1];
                simulateClick(button.x, button.y);
                console.log(`Clicked answer ${answerIndex} at coordinates (${button.x}, ${button.y})`);
              } else {
                console.log(`Answer ${answerIndex} does not exist (only ${buttons.length} answers available)`);
              }
            }

            clickAnswer(answerIndex);
          },
          args: [i]
        });
        log(`Attempted to click answer button ${i}`);
      });
    });
  }

  // Load saved auto-answer state (modified to default to false)
  chrome.storage.local.get(['autoAnswerEnabled'], (result) => {
    autoAnswerEnabled = false; // Force default to false when extension opens
    autoAnswerToggle.checked = false; // Ensure toggle starts unchecked
    chrome.storage.local.set({ autoAnswerEnabled: false }); // Save the off state
    updateAutoAnswerStatus();
  });

  autoAnswerToggle.addEventListener('change', () => {
    autoAnswerEnabled = autoAnswerToggle.checked;
    chrome.storage.local.set({ autoAnswerEnabled });
    updateAutoAnswerStatus();
    
    if (autoAnswerEnabled) {
      startAutoAnswerMode();
    } else {
      stopAutoAnswerMode();
    }
  });

  function updateAutoAnswerStatus() {
    autoAnswerStatus.textContent = autoAnswerEnabled ? '(Active)' : '(Idle)';
    autoAnswerStatus.style.color = autoAnswerEnabled ? 'green' : 'gray';
  }

  function startAutoAnswerMode() {
    log('Auto-answer mode activated');
    if (checkInterval) clearInterval(checkInterval);
    
    async function checkForNewQuestion() {
      if (!autoAnswerEnabled || isSolving) return;
      
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) return;
        
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            const questionEl = document.querySelector('._questionText_1brbq_14');
            return questionEl ? questionEl.innerText : null;
          }
        }, async (results) => {
          if (!results || !results[0].result) return;
          
          const currentQuestion = results[0].result;
          if (currentQuestion && currentQuestion !== lastQuestionText) {
            lastQuestionText = currentQuestion;
            log('New question detected!');
            isSolving = true;
            
            // Use the existing answer function
            const answerBtn = document.getElementById('answer');
            answerBtn.click();
            
            // Reset solving state after a delay
            setTimeout(() => {
              isSolving = false;
            }, 3000);
          }
        });
      });
    }
    
    // Check every 1 second
    checkInterval = setInterval(checkForNewQuestion, 500);
  }

  function stopAutoAnswerMode() {
    log('Auto-answer mode deactivated');
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    isSolving = false;
  }

  function log(message) {
    debugLog.value += `${new Date().toLocaleTimeString()} - ${message}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
  }

  const collapsibles = document.querySelectorAll('.collapsible');
  collapsibles.forEach((collapsible) => {
    collapsible.addEventListener('click', function() {
      this.classList.toggle('active');
      const content = this.nextElementSibling;
      if (content.style.display === 'block') {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }
    });
  });
});

// Global helper functions
function simulateClick(x, y) {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y
  });

  const element = document.elementFromPoint(x, y);
  if (element) {
    element.dispatchEvent(clickEvent);
  }
}

function findAnswerButtons() {
  const answerElements = document.querySelectorAll('._answersHolder_1brbq_62 > div');
  if (!answerElements || answerElements.length === 0) {
    return null;
  }
  
  const answerButtons = [];
  for (let i = 0; i < answerElements.length; i++) {
    const element = answerElements[i];
    if (element) {
      const rect = element.getBoundingClientRect();
      answerButtons.push({
        element: element,
        index: i + 1,
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2)
      });
    }
  }

  return answerButtons.length > 0 ? answerButtons : null;
}

function clickAnswer(answerIndex) { // answerIndex should be 1-based
  const buttons = findAnswerButtons();
  if (!buttons) {
    console.log('Could not find answer buttons');
    return;
  }

  // Check if the requested answer index exists
  if (answerIndex <= buttons.length) {
    const button = buttons[answerIndex - 1];
    simulateClick(button.x, button.y);
    console.log(`Clicked answer ${answerIndex} at coordinates (${button.x}, ${button.y})`);
  } else {
    console.log(`Answer ${answerIndex} does not exist (only ${buttons.length} answers available)`);
  }
}
