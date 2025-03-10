let isSolving = false;

document.addEventListener('DOMContentLoaded', () => {
  const testKeypressBtn = document.getElementById('testKeypress');
  const debugLog = document.getElementById('debugLog');
  const questionOutput = document.getElementById('questionOutput');
  const answersOutput = document.getElementById('answersOutput');

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

function testKeypress() {
  [1, 2, 3, 4].forEach(num => {
    setTimeout(() => {
      simulateKeyPress(num.toString());
    }, num * 1000);
  });
}

function simulateKeyPress(key) {
  const target = document.activeElement || document.body;
  const keyCode = 48 + parseInt(key);
  const eventInitDict = {
    key: key,
    code: `Digit${key}`,
    location: KeyboardEvent.DOM_KEY_LOCATION_STANDARD,
    keyCode: keyCode,
    which: keyCode,
    charCode: keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
    isTrusted: false,
    view: window,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false
  };

  const events = [
    new KeyboardEvent('keydown', eventInitDict),
    new KeyboardEvent('keypress', eventInitDict),
    new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: key,
      bubbles: true,
      cancelable: true
    }),
    new InputEvent('input', {
      inputType: 'insertText',
      data: key,
      bubbles: true,
      cancelable: true
    }),
    new KeyboardEvent('keyup', eventInitDict)
  ];

  events.forEach(event => {
    target.dispatchEvent(event);
    document.dispatchEvent(event);
  });
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