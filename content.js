function getQuestionAndAnswers() {
  // This is a placeholder - you'll need to adjust selectors based on Blooket's actual DOM
  const question = document.querySelector('.question-text')?.textContent;
  const answers = Array.from(document.querySelectorAll('.answer-option'))
    .map(el => el.textContent);
  
  return { question, answers };
}

function simulateKeypress(key) {
  const event = new KeyboardEvent('keydown', { key });
  document.dispatchEvent(event);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'solve') {
    const { question, answers } = getQuestionAndAnswers();
    if (question && answers.length === 4) {
      chrome.runtime.sendMessage({
        action: 'processQuestion',
        question,
        answers
      });
    }
  } else if (message.action === 'submitAnswer') {
    simulateKeypress(message.key);
  }
});