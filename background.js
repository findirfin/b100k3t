chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("blooket.com")) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

let isSolving = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSolving') {
    isSolving = message.isSolving;
    if (isSolving) {
      startSolving();
    }
  } else if (message.action === 'processQuestion') {
    processQuestion(message.question, message.answers);
  }
});

function startSolving() {
  if (!isSolving) return;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: () => {
        chrome.runtime.sendMessage({ action: 'solve' });
      }
    });
    setTimeout(startSolving, 1000); // Check every second
  });
}

async function processQuestion(question, answers) {
  // Get API key from storage
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) return;

  // Placeholder for API call - replace with your LLM API endpoint
  try {
    const response = await fetch('YOUR_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        answers
      })
    });
    
    const data = await response.json();
    const answerIndex = data.answerIndex; // Assuming API returns 0-3
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: (index) => {
          chrome.runtime.sendMessage({ 
            action: 'submitAnswer', 
            key: (index + 1).toString() 
          });
        },
        args: [answerIndex]
      });
    });
  } catch (error) {
    console.error('API error:', error);
  }
}