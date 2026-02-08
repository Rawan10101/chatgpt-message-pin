// Background service worker for ChatGPT Pinner
console.log('ChatGPT Pinner: Background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ChatGPT Pinner installed successfully');
    
    // Initialize storage with per-chat structure
    chrome.storage.local.set({ pinnedMessagesByChat: {} });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/pin-icon.png',
      title: 'ChatGPT Pinner Installed!',
      message: 'Use Ctrl+Shift+P to toggle pinned messages panel, or click the PIN button.',
      priority: 2
    });
  } else if (details.reason === 'update') {
    console.log('ChatGPT Pinner updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPins') {
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      sendResponse({ pins: chatPins });
    });
    return true;
  }
  
  if (request.action === 'addPin') {
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      chatPins.push(request.data);
      allChats[request.conversationId] = chatPins;
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (request.action === 'removePin') {
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      const filtered = chatPins.filter(pin => pin.messageNumber !== request.messageNumber);
      allChats[request.conversationId] = filtered;
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if we're on a ChatGPT page
  if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
    // Send message to content script to toggle panel
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } else {
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/pin-icon.png',
      title: 'ChatGPT Pinner',
      message: 'Please navigate to ChatGPT to use this extension.',
      priority: 1
    });
  }
});

// Clean up old pins periodically (keep last 50 pins per chat)
chrome.alarms.create('cleanupPins', { periodInMinutes: 120 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupPins') {
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      let modified = false;
      
      for (const chatId in allChats) {
        const pins = allChats[chatId];
        if (pins.length > 50) {
          // Keep only the 50 most recent pins per chat
          const sorted = pins.sort((a, b) => b.pinnedAt - a.pinnedAt);
          allChats[chatId] = sorted.slice(0, 50);
          modified = true;
        }
      }
      
      if (modified) {
        chrome.storage.local.set({ pinnedMessagesByChat: allChats });
        console.log('Cleaned up old pins');
      }
    });
  }
});
