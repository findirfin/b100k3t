let isSolving = false;
let pplxToken = '';

document.addEventListener('DOMContentLoaded', () => {
  const debugLog = document.getElementById('debugLog');
  const questionOutput = document.getElementById('questionOutput');
  const answersOutput = document.getElementById('answersOutput');
  const tokenInput = document.getElementById('pplxToken');
  const saveTokenBtn = document.getElementById('saveToken');
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessage');
  const chatMessages = document.getElementById('chatMessages');

  // Load saved token
  chrome.storage.local.get(['pplxToken'], (result) => {
    if (result.pplxToken) {
      pplxToken = result.pplxToken;
      tokenInput.value = pplxToken;
    }
  });

  // Save token
  saveTokenBtn.addEventListener('click', () => {
    pplxToken = tokenInput.value;
    chrome.storage.local.set({ pplxToken });
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

    if (!pplxToken) {
      addMessageToChat('bot', 'Error: Please enter and save your API token first');
      return;
    }

    // Add user message to chat
    addMessageToChat('user', message);
    messageInput.value = '';

    const requestBody = {
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "Be precise and concise."
        },
        {
          role: "user",
          content: message
        }
      ]
    };

    try {
      console.log('Sending request:', requestBody); // Debug log

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pplxToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response:', data); // Debug log

      if (data.choices && data.choices[0] && data.choices[0].message) {
        addMessageToChat('bot', data.choices[0].message.content);
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

  const testKeypressBtn = document.getElementById('testKeypress');

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
          answersOutput.innerHTML = answers.map((answer, index) => `Answer ${index + 1}: ${answer}`).join('<br>');
        } else {
          questionOutput.textContent = 'Could not find question or answers';
          answersOutput.innerHTML = '';
        }
      });
    });
  });

  // Modify the individual button click handlers
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`press${i}`).addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: (answerIndex) => {
            function findAnswerButtons() {
              const answerButtons = [];
              for (let i = 0; i < 4; i++) {
                const button = document.getElementById(`answer${i}`);
                if (button) {
                  const rect = button.getBoundingClientRect();
                  answerButtons.push({
                    element: button,
                    index: i + 1,
                    x: rect.left + (rect.width / 2),
                    y: rect.top + (rect.height / 2)
                  });
                }
              }

              if (answerButtons.length === 4) {
                return answerButtons;
              }
              return null;
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

            function clickAnswer(answerIndex) { // answerIndex should be 1-4
              const buttons = findAnswerButtons();
              if (!buttons) {
                console.log('Could not find answer buttons');
                return;
              }

              const button = buttons[answerIndex - 1];
              if (button) {
                simulateClick(button.x, button.y);
                console.log(`Clicked answer ${answerIndex} at coordinates (${button.x}, ${button.y})`);
              }
            }

            clickAnswer(answerIndex);
          },
          args: [i]
        });
        log(`Clicked answer button ${i}`);
      });
    });
  }

  function log(message) {
    debugLog.value += `${new Date().toLocaleTimeString()} - ${message}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
  }
});

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

function getElementCoordinates(selector) {
  const element = document.querySelector(selector);
  if (element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + (rect.width / 2),
      y: rect.top + (rect.height / 2)
    };
  }
  return null;
}

function findAnswerButtons() {
  const answerButtons = [];
  for (let i = 0; i < 4; i++) {
    const button = document.getElementById(`answer${i}`);
    if (button) {
      const rect = button.getBoundingClientRect();
      answerButtons.push({
        element: button,
        index: i + 1,
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2)
      });
    }
  }

  if (answerButtons.length === 4) {
    return answerButtons;
  }
  return null;
}

function clickAnswer(answerIndex) { // answerIndex should be 1-4
  const buttons = findAnswerButtons();
  if (!buttons) {
    console.log('Could not find answer buttons');
    return;
  }

  const button = buttons[answerIndex - 1];
  if (button) {
    simulateClick(button.x, button.y);
    console.log(`Clicked answer ${answerIndex} at coordinates (${button.x}, ${button.y})`);
  }
}