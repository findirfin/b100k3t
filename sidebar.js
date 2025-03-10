let isSolving = false;
let geminiToken = '';

document.addEventListener('DOMContentLoaded', () => {
  const debugLog = document.getElementById('debugLog');
  const questionOutput = document.getElementById('questionOutput');
  const answersOutput = document.getElementById('answersOutput');
  const tokenInput = document.getElementById('geminiToken');
  const saveTokenBtn = document.getElementById('saveToken');
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessage');
  const chatMessages = document.getElementById('chatMessages');

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

  // Send message
  sendMessageBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    if (!geminiToken) {
      addMessageToChat('bot', 'Error: Please enter and save your API token first');
      return;
    }

    // Add user message to chat
    addMessageToChat('user', message);
    messageInput.value = '';

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
    
    try {
      console.log('Sending request:', requestBody); // Debug log

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
      console.log('API Response:', data); // Debug log

      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const responseText = data.candidates[0].content.parts[0].text;
        addMessageToChat('bot', responseText);
      } else {
        throw new Error('Invalid response structure from API');
      }
    } catch (error) {
      console.error('Full error:', error);
      addMessageToChat('bot', `Error: ${error.message}`);
    }
  }

  function addMessageToChat(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.textContent = content;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

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
              const answerNumber = parseInt(responseText.trim().match(/\d+/)?.[0]);
              
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
              } else {
                log(`Error: Could not determine valid answer number from AI response: "${responseText}"`);
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
        } else {
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

  function log(message) {
    debugLog.value += `${new Date().toLocaleTimeString()} - ${message}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
  }
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
