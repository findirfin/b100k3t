let isSolving = false;

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const toggleSolveBtn = document.getElementById('toggleSolve');
  const testKeypressBtn = document.getElementById('testKeypress');
  const debugLog = document.getElementById('debugLog');

  // Load saved API key
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  saveKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    chrome.storage.sync.set({ apiKey }, () => {
      log('API Key saved');
    });
  });

  toggleSolveBtn.addEventListener('click', () => {
    isSolving = !isSolving;
    toggleSolveBtn.textContent = isSolving ? 'Stop Solving' : 'Start Solving';
    chrome.runtime.sendMessage({ action: 'toggleSolving', isSolving });
    log(`Solving ${isSolving ? 'started' : 'stopped'}`);
  });

  testKeypressBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: testKeypress
      });
      log('Testing keypress 1-4');
    });
  });

  function log(message) {
    debugLog.value += `${new Date().toLocaleTimeString()} - ${message}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
  }
});

function testKeypress() {
  [1, 2, 3, 4].forEach(num => {
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: num.toString() }));
    }, num * 1000);
  });
}