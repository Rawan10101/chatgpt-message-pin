console.log = (function(oldLog) {
  return function(...args) {
    oldLog.apply(console, ['[VERBOSE]', ...args]);
  };
})(console.log);

console.log('ChatGPT Pinner: Content script loaded');

let panelOpen = false;
let panelElement = null;
let currentConversationId = null;
let currentTab = 'pins'; // 'pins' or 'notes'
let messageObserver = null;

// Extract conversation ID from URL
function extractConversationId() {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  const id = match ? match[1] : 'default';
  console.log('Extracted conversation ID:', id);
  return id;
}

// Update current conversation ID when URL changes
function updateConversationId() {
  const newId = extractConversationId();
  if (newId !== currentConversationId) {
    currentConversationId = newId;
    console.log('Changed to conversation:', currentConversationId);
    assignAllMessageNumbers();
    if (panelOpen) {
      updatePanel();
    }
  }
}

// Find all message elements using multiple strategies
function getAllMessages() {
  // Strategy 1: Look for data-testid attribute
  let messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
  
  // Strategy 2: Look for ChatGPT's typical message structure
  if (messages.length === 0) {
    messages = document.querySelectorAll('div[class*="group"]');
    // Filter to only keep actual message elements
    messages = Array.from(messages).filter(el => {
      return el.querySelector('[data-message-author-role]') || 
             el.textContent.length > 20; // Arbitrary minimum length
    });
  }
  
  // Strategy 3: Look in main content area
  if (messages.length === 0) {
    const main = document.querySelector('main');
    if (main) {
      const allDivs = main.querySelectorAll('div');
      messages = Array.from(allDivs).filter(div => {
        // Look for divs that seem like messages
        return div.querySelector('[data-message-author-role]') !== null;
      });
    }
  }
  
  console.log(`Found ${messages.length} messages using detection strategies`);
  return Array.from(messages);
}

// Assign message numbers to all messages based on DOM order
function assignAllMessageNumbers() {
  const messages = getAllMessages();
  
  messages.forEach((msg, index) => {
    msg.dataset.messageNumber = index + 1;
  });
  
  console.log(`Assigned message numbers to ${messages.length} messages`);
  return messages.length;
}

// Add pin button to a message element
function addPinButton(messageElement) {
  // Don't add if already has button
  if (messageElement.querySelector('.pin-button')) {
    return;
  }

  // Only add to assistant messages
  const authorRole = messageElement.querySelector('[data-message-author-role="assistant"]');
  if (!authorRole) {
    return;
  }

  // Ensure message has a number
  if (!messageElement.dataset.messageNumber) {
    assignAllMessageNumbers();
  }
  
  const messageNumber = parseInt(messageElement.dataset.messageNumber);
  if (!messageNumber) {
    console.warn('Could not get message number for element');
    return;
  }

  const pinButton = document.createElement('button');
  pinButton.className = 'pin-button';
  pinButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 1C9.5 0.723858 9.27614 0.5 9 0.5H7C6.72386 0.5 6.5 0.723858 6.5 1V2H4.5C4.22386 2 4 2.22386 4 2.5V6C4 6.27614 4.22386 6.5 4.5 6.5H6.5V15C6.5 15.2761 6.72386 15.5 7 15.5H9C9.27614 15.5 9.5 15.2761 9.5 15V6.5H11.5C11.7761 6.5 12 6.27614 12 6V2.5C12 2.22386 11.7761 2 11.5 2H9.5V1Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
    </svg>
  `;
  pinButton.title = 'Pin this message';
  
  // Check if already pinned
  if (typeof PinStorage !== 'undefined') {
    PinStorage.isPinned(currentConversationId, messageNumber).then(isPinned => {
      if (isPinned) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Unpin this message';
      }
    }).catch(err => {
      console.error('Error checking pin status:', err);
    });
  }

  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await handlePinClick(messageElement, pinButton);
  });

  // Find best place to attach button
  const messageContent = messageElement.querySelector('[data-message-author-role]') || messageElement;
  messageContent.style.position = 'relative';
  messageContent.appendChild(pinButton);
  
  console.log('Added pin button to message', messageNumber);
}

// Handle pin/unpin action
async function handlePinClick(messageElement, button) {
  try {
    const messageNumber = parseInt(messageElement.dataset.messageNumber);
    if (!messageNumber) {
      console.error('No message number found');
      showNotification('Error: Could not identify message');
      return;
    }

    const isPinned = button.classList.contains('pinned');

    if (isPinned) {
      // Unpin
      console.log('Unpinning message', messageNumber);
      await PinStorage.removePin(currentConversationId, messageNumber);
      button.classList.remove('pinned');
      button.title = 'Pin this message';
      showNotification('Message unpinned');
    } else {
      // Pin
      console.log('Pinning message', messageNumber);
      
      // Get message text
      let messageText = messageElement.innerText || messageElement.textContent;
      messageText = messageText.substring(0, 500); // Limit length
      
      const messageData = {
        messageNumber: messageNumber,
        text: messageText,
        pinnedAt: Date.now(),
        url: window.location.href,
        conversationId: currentConversationId
      };

      const result = await PinStorage.addPin(currentConversationId, messageData);
      
      if (result && result.success) {
        button.classList.add('pinned');
        button.title = 'Unpin this message';
        showNotification('Message pinned!');
        console.log('Successfully pinned message', messageNumber);
      } else {
        showNotification('Error pinning message');
        console.error('Pin failed:', result);
      }
    }

    if (panelOpen) {
      updatePanel();
    }
  } catch (error) {
    console.error('Error in handlePinClick:', error);
    showNotification('Error: ' + error.message);
  }
}

// ==== TEXT SELECTION FEATURE ====
let selectionPopup = null;

document.addEventListener('mouseup', (e) => {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Remove existing popup
    if (selectionPopup) {
      selectionPopup.remove();
      selectionPopup = null;
    }

    if (selectedText.length > 0) {
      try {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const messageElement = container.nodeType === 3 
          ? container.parentElement.closest('[data-message-number]')
          : container.closest('[data-message-number]');

        // Only show popup if selection is in a ChatGPT message
        if (messageElement) {
          const isAssistant = messageElement.querySelector('[data-message-author-role="assistant"]');
          if (isAssistant) {
            showSelectionPopup(range, selectedText, messageElement);
          }
        }
      } catch (error) {
        console.error('Error showing selection popup:', error);
      }
    }
  }, 50);
});

function showSelectionPopup(range, selectedText, messageElement) {
  try {
    const rect = range.getBoundingClientRect();
    
    selectionPopup = document.createElement('div');
    selectionPopup.className = 'selection-popup';
    selectionPopup.innerHTML = `
      <button class="add-to-notes-btn">Add to Notes</button>
    `;

    // Position popup below the selection
    selectionPopup.style.position = 'fixed';
    selectionPopup.style.left = `${rect.left + rect.width / 2}px`;
    selectionPopup.style.top = `${rect.bottom + 8}px`;
    selectionPopup.style.transform = 'translateX(-50%)';
    selectionPopup.style.zIndex = '10000';

    document.body.appendChild(selectionPopup);

    // Add click handler
    selectionPopup.querySelector('.add-to-notes-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await saveSelectedTextAsNote(selectedText, messageElement);
      window.getSelection().removeAllRanges();
      if (selectionPopup) {
        selectionPopup.remove();
        selectionPopup = null;
      }
    });
    
    console.log('Showed selection popup for text:', selectedText.substring(0, 50));
  } catch (error) {
    console.error('Error in showSelectionPopup:', error);
  }
}

// Remove popup when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (selectionPopup && !selectionPopup.contains(e.target)) {
    selectionPopup.remove();
    selectionPopup = null;
  }
});

async function saveSelectedTextAsNote(selectedText, messageElement) {
  try {
    const messageNumber = parseInt(messageElement.dataset.messageNumber);
    
    if (!messageNumber) {
      showNotification('Error: Could not identify message');
      return;
    }
    
    console.log('Saving note from message', messageNumber);
    
    const noteData = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: selectedText,
      messageNumber: messageNumber,
      createdAt: Date.now(),
      url: window.location.href,
      conversationId: currentConversationId
    };

    const result = await PinStorage.addNote(currentConversationId, noteData);
    
    if (result && result.success) {
      showNotification('Added to Notes!');
      console.log('Successfully saved note');
      if (panelOpen) {
        updatePanel();
      }
    } else {
      showNotification('Error saving note');
      console.error('Note save failed:', result);
    }
  } catch (error) {
    console.error('Error in saveSelectedTextAsNote:', error);
    showNotification('Error: ' + error.message);
  }
}
// ==== END TEXT SELECTION FEATURE ====

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'pin-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Observe DOM for new messages
function observeMessages() {
  // Stop existing observer if any
  if (messageObserver) {
    messageObserver.disconnect();
  }

  messageObserver = new MutationObserver((mutations) => {
    updateConversationId();
    const messages = getAllMessages();
    messages.forEach(msg => addPinButton(msg));
  });

  messageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial setup
  updateConversationId();
  const messages = getAllMessages();
  messages.forEach(msg => addPinButton(msg));
  
  console.log('Message observer started');
}

// Create and inject the panel
function createPanel() {
  if (panelElement) return;

  const panel = document.createElement('div');
  panel.id = 'pinned-messages-panel';
  panel.className = 'pinned-panel hidden';
  panel.innerHTML = `
    <div class="panel-header">
      <h3>Saved Items</h3>
      <button id="close-panel" title="Close">✕</button>
    </div>
    <div class="panel-tabs">
      <button class="tab-button active" data-tab="pins">Pinned Responses</button>
      <button class="tab-button" data-tab="notes">Notes</button>
    </div>
    <div class="panel-actions">
      <button id="clear-all" title="Clear all">Clear All</button>
    </div>
    <div class="panel-content" id="panel-content">
      <p class="no-pins">No items yet</p>
    </div>
  `;

  document.body.appendChild(panel);
  panelElement = panel;

  // Event listeners
  panel.querySelector('#close-panel').addEventListener('click', togglePanel);
  
  // Tab switching
  panel.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      updatePanel();
    });
  });

  // Clear all button
  panel.querySelector('#clear-all').addEventListener('click', async () => {
    if (currentTab === 'pins') {
      if (confirm('Clear all pinned messages in this chat?')) {
        await PinStorage.clearChat(currentConversationId);
        document.querySelectorAll('.pin-button.pinned').forEach(btn => {
          btn.classList.remove('pinned');
          btn.title = 'Pin this message';
        });
        showNotification('All pins cleared');
        updatePanel();
      }
    } else {
      if (confirm('Clear all notes in this chat?')) {
        await PinStorage.clearNotes(currentConversationId);
        showNotification('All notes cleared');
        updatePanel();
      }
    }
  });

  updatePanel();
  console.log('Panel created');
}

// Toggle panel visibility
function togglePanel() {
  if (!panelElement) {
    createPanel();
  }

  panelOpen = !panelOpen;
  panelElement.classList.toggle('hidden');

  if (panelOpen) {
    updatePanel();
  }
  
  console.log('Panel toggled:', panelOpen ? 'open' : 'closed');
}

// Update panel content
async function updatePanel() {
  if (!panelElement) return;

  const content = panelElement.querySelector('#panel-content');

  try {
    if (currentTab === 'pins') {
      const pins = await PinStorage.getPins(currentConversationId);
      console.log('Loaded pins:', pins);
      
      if (pins.length === 0) {
        content.innerHTML = '<p class="no-pins">No pinned messages in this chat</p>';
        return;
      }

      content.innerHTML = pins.map(pin => `
        <div class="pinned-message" data-message-number="${pin.messageNumber}">
          <div class="pin-text">${escapeHtml(pin.text.substring(0, 200))}${pin.text.length > 200 ? '...' : ''}</div>
          <div class="pin-footer">
            <span class="pin-date">${formatDate(pin.pinnedAt)}</span>
            <div class="pin-actions">
              <button class="jump-to-pin" data-number="${pin.messageNumber}" title="Jump to message">Jump</button>
              <button class="remove-pin" data-number="${pin.messageNumber}" title="Remove pin">Remove</button>
            </div>
          </div>
        </div>
      `).join('');

      content.querySelectorAll('.jump-to-pin').forEach(btn => {
        btn.addEventListener('click', () => jumpToMessage(parseInt(btn.dataset.number)));
      });

      content.querySelectorAll('.remove-pin').forEach(btn => {
        btn.addEventListener('click', async () => {
          const messageNumber = parseInt(btn.dataset.number);
          await PinStorage.removePin(currentConversationId, messageNumber);
          updatePanel();
          const msgElement = document.querySelector(`[data-message-number="${messageNumber}"]`);
          if (msgElement) {
            const pinBtn = msgElement.querySelector('.pin-button');
            if (pinBtn) {
              pinBtn.classList.remove('pinned');
              pinBtn.title = 'Pin this message';
            }
          }
          showNotification('Pin removed');
        });
      });

    } else { // notes tab
      const notes = await PinStorage.getNotes(currentConversationId);
      console.log('Loaded notes:', notes);
      
      if (notes.length === 0) {
        content.innerHTML = '<p class="no-pins">No notes in this chat<br><small>Select text from ChatGPT responses to add notes</small></p>';
        return;
      }

      content.innerHTML = notes.map(note => `
        <div class="pinned-message note-item" data-note-id="${note.id}">
          <div class="pin-text">"${escapeHtml(note.text)}"</div>
          <div class="pin-footer">
            <span class="pin-date">${formatDate(note.createdAt)}</span>
            <div class="pin-actions">
              <button class="jump-to-pin" data-number="${note.messageNumber}" title="Jump to message">Jump</button>
              <button class="remove-note" data-note-id="${note.id}" title="Remove note">Remove</button>
            </div>
          </div>
        </div>
      `).join('');

      content.querySelectorAll('.jump-to-pin').forEach(btn => {
        btn.addEventListener('click', () => jumpToMessage(parseInt(btn.dataset.number)));
      });

      content.querySelectorAll('.remove-note').forEach(btn => {
        btn.addEventListener('click', async () => {
          const noteId = btn.dataset.noteId;
          await PinStorage.removeNote(currentConversationId, noteId);
          updatePanel();
          showNotification('Note removed');
        });
      });
    }
  } catch (error) {
    console.error('Error updating panel:', error);
    content.innerHTML = '<p class="no-pins">Error loading items</p>';
  }
}

// Jump to a pinned message
function jumpToMessage(messageNumber) {
  const messageElement = document.querySelector(`[data-message-number="${messageNumber}"]`);
  
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageElement.classList.add('highlight');
    setTimeout(() => messageElement.classList.remove('highlight'), 2000);
    console.log('Jumped to message', messageNumber);
  } else {
    showNotification('Message not found in current view');
    console.warn('Message not found:', messageNumber);
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

// Add keyboard shortcut (Ctrl/Cmd + Shift + P)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    togglePanel();
  }
});

// Watch for URL changes (navigation between chats)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    updateConversationId();
  }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'togglePanel') {
    togglePanel();
    sendResponse({ success: true });
  }
  return true;
});

// Add floating toggle button
function createToggleButton() {
  const button = document.createElement('button');
  button.id = 'toggle-pins-button';
  button.className = 'toggle-pins-btn';
  button.innerHTML = 'PIN';
  button.title = 'Toggle pinned messages (Ctrl+Shift+P)';
  button.addEventListener('click', togglePanel);
  document.body.appendChild(button);
  console.log('Toggle button created');
}

// Initialize
function init() {
  console.log('ChatGPT Pinner: Initializing...');
  
  // Check if PinStorage is available
  if (typeof PinStorage === 'undefined') {
    console.error('PinStorage not found! Make sure storage.js is loaded first.');
    setTimeout(init, 500); // Retry after delay
    return;
  }
  
  updateConversationId();
  observeMessages();
  createToggleButton();
  createPanel();
  
  console.log('ChatGPT Pinner: Initialization complete');
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // Give a small delay to ensure storage.js is loaded
  setTimeout(init, 100);
}