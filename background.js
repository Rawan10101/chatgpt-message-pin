// Background service worker for ChatGPT Pinner
console.log('[Background] ChatGPT Pinner: Background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] ChatGPT Pinner installed successfully');
    
    // Initialize storage with per-chat structure for pins and notes
    chrome.storage.local.set({ 
      pinnedMessagesByChat: {},
      notesByChat: {}
    }, () => {
      console.log('[Background] Storage initialized');
    });
  } else if (details.reason === 'update') {
    console.log('[Background] ChatGPT Pinner updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action, 'for conversation:', request.conversationId);
  
  if (request.action === 'getPins') {
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      console.log('[Background] Returning', chatPins.length, 'pins for', request.conversationId);
      sendResponse({ pins: chatPins });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'getNotes') {
    chrome.storage.local.get(['notesByChat'], (result) => {
      const allChats = result.notesByChat || {};
      const chatNotes = allChats[request.conversationId] || [];
      console.log('[Background] Returning', chatNotes.length, 'notes for', request.conversationId);
      sendResponse({ notes: chatNotes });
    });
    return true;
  }
  
  if (request.action === 'addPin') {
    console.log('[Background] Adding pin:', request.data);
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      chatPins.push(request.data);
      allChats[request.conversationId] = chatPins;
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        console.log('[Background] Pin added successfully. Total pins:', chatPins.length);
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'addNote') {
    console.log('[Background] Adding note:', request.data);
    chrome.storage.local.get(['notesByChat'], (result) => {
      const allChats = result.notesByChat || {};
      const chatNotes = allChats[request.conversationId] || [];
      chatNotes.push(request.data);
      allChats[request.conversationId] = chatNotes;
      chrome.storage.local.set({ notesByChat: allChats }, () => {
        console.log('[Background] Note added successfully. Total notes:', chatNotes.length);
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (request.action === 'removePin') {
    console.log('[Background] Removing pin for message:', request.messageNumber);
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const chatPins = allChats[request.conversationId] || [];
      const filtered = chatPins.filter(pin => pin.messageNumber !== request.messageNumber);
      allChats[request.conversationId] = filtered;
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        console.log('[Background] Pin removed. Remaining:', filtered.length);
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'removeNote') {
    console.log('[Background] Removing note:', request.noteId);
    chrome.storage.local.get(['notesByChat'], (result) => {
      const allChats = result.notesByChat || {};
      const chatNotes = allChats[request.conversationId] || [];
      const filtered = chatNotes.filter(note => note.id !== request.noteId);
      allChats[request.conversationId] = filtered;
      chrome.storage.local.set({ notesByChat: allChats }, () => {
        console.log('[Background] Note removed. Remaining:', filtered.length);
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'clearChat') {
    console.log('[Background] Clearing all pins for conversation');
    chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      allChats[request.conversationId] = [];
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        console.log('[Background] All pins cleared');
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'clearNotes') {
    console.log('[Background] Clearing all notes for conversation');
    chrome.storage.local.get(['notesByChat'], (result) => {
      const allChats = result.notesByChat || {};
      allChats[request.conversationId] = [];
      chrome.storage.local.set({ notesByChat: allChats }, () => {
        console.log('[Background] All notes cleared');
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'togglePanel') {
    console.log('[Background] Toggle panel request');
    sendResponse({ success: true });
    return true;
  }

  console.warn('[Background] Unknown action:', request.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Extension icon clicked on tab:', tab.url);
  // Check if we're on a ChatGPT page
  if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
    // Send message to content script to toggle panel
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error sending toggle message:', chrome.runtime.lastError);
      } else {
        console.log('[Background] Toggle message sent successfully');
      }
    });
  }
});

// Clean up old pins periodically (keep last 50 pins and notes per chat)
chrome.alarms.create('cleanupPins', { periodInMinutes: 120 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupPins') {
    console.log('[Background] Running cleanup...');
    chrome.storage.local.get(['pinnedMessagesByChat', 'notesByChat'], (result) => {
      const allChats = result.pinnedMessagesByChat || {};
      const allNotes = result.notesByChat || {};
      let modified = false;
      
      for (const chatId in allChats) {
        const pins = allChats[chatId];
        if (pins.length > 50) {
          const sorted = pins.sort((a, b) => b.pinnedAt - a.pinnedAt);
          allChats[chatId] = sorted.slice(0, 50);
          modified = true;
        }
      }

      for (const chatId in allNotes) {
        const notes = allNotes[chatId];
        if (notes.length > 50) {
          const sorted = notes.sort((a, b) => b.createdAt - a.createdAt);
          allNotes[chatId] = sorted.slice(0, 50);
          modified = true;
        }
      }
      
      if (modified) {
        chrome.storage.local.set({ pinnedMessagesByChat: allChats, notesByChat: allNotes }, () => {
          console.log('[Background] Cleaned up old pins and notes');
        });
      } else {
        console.log('[Background] No cleanup needed');
      }
    });
  }
});

console.log('[Background] Background script initialization complete');