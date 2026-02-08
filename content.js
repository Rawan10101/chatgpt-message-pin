console.log('ChatGPT Pinner: Content script loaded');

let panelOpen = false;
let panelElement = null;
let currentConversationId = null;

// Extract conversation ID from URL
function extractConversationId() {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : 'default';
}

// Update current conversation ID when URL changes
function updateConversationId() {
  const newId = extractConversationId();
  if (newId !== currentConversationId) {
    currentConversationId = newId;
    console.log('Changed to conversation:', currentConversationId);
    // Reassign all message numbers for the new conversation
    assignAllMessageNumbers();
    if (panelOpen) {
      updatePanel();
    }
  }
}

// Assign message numbers to all messages based on DOM order
function assignAllMessageNumbers() {
  const messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
  messages.forEach((msg, index) => {
    msg.dataset.messageNumber = index + 1;
  });
}

// Add pin button to a message element
function addPinButton(messageElement) {
  // Skip if button already exists
  if (messageElement.querySelector('.pin-button')) {
    return;
  }

  // Only add pin button to assistant messages (ChatGPT's responses)
  const authorRole = messageElement.querySelector('[data-message-author-role="assistant"]');
  if (!authorRole) {
    return; // Skip user messages
  }

  // Make sure all messages have numbers assigned
  assignAllMessageNumbers();

  const messageNumber = parseInt(messageElement.dataset.messageNumber);

  const pinButton = document.createElement('button');
  pinButton.className = 'pin-button';
  pinButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 1C9.5 0.723858 9.27614 0.5 9 0.5H7C6.72386 0.5 6.5 0.723858 6.5 1V2H4.5C4.22386 2 4 2.22386 4 2.5V6C4 6.27614 4.22386 6.5 4.5 6.5H6.5V15C6.5 15.2761 6.72386 15.5 7 15.5H9C9.27614 15.5 9.5 15.2761 9.5 15V6.5H11.5C11.7761 6.5 12 6.27614 12 6V2.5C12 2.22386 11.7761 2 11.5 2H9.5V1Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
    </svg>
  `;
  pinButton.title = 'Pin this message';
  
  // Check if already pinned
  PinStorage.isPinned(currentConversationId, messageNumber).then(isPinned => {
    if (isPinned) {
      pinButton.classList.add('pinned');
      pinButton.title = 'Unpin this message';
    }
  });

  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    await handlePinClick(messageElement, pinButton);
  });

  // Find the best place to insert the button
  const messageContent = messageElement.querySelector('[data-message-author-role]') || messageElement;
  messageContent.style.position = 'relative';
  messageContent.appendChild(pinButton);
}

// Handle pin/unpin action
async function handlePinClick(messageElement, button) {
  const messageNumber = parseInt(messageElement.dataset.messageNumber);
  const isPinned = button.classList.contains('pinned');

  if (isPinned) {
    // Unpin
    await PinStorage.removePin(currentConversationId, messageNumber);
    button.classList.remove('pinned');
    button.title = 'Pin this message';
    showNotification('Message unpinned');
  } else {
    // Pin
    const messageData = {
      messageNumber: messageNumber,
      text: messageElement.innerText.substring(0, 500), // First 500 chars
      timestamp: Date.now(),
      url: window.location.href,
      conversationId: currentConversationId
    };

    const result = await PinStorage.addPin(currentConversationId, messageData);
    if (result.success) {
      button.classList.add('pinned');
      button.title = 'Unpin this message';
      showNotification('Message pinned!');
    } else {
      showNotification(result.message);
    }
  }

  // Update panel if open
  if (panelOpen) {
    updatePanel();
  }
}

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
  const observer = new MutationObserver((mutations) => {
    // Update conversation ID on URL changes
    updateConversationId();
    
    // Look for message elements
    const messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    messages.forEach(msg => addPinButton(msg));
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan
  updateConversationId();
  const messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
  messages.forEach(msg => addPinButton(msg));
}

// Create and inject the panel
function createPanel() {
  if (panelElement) return;

  const panel = document.createElement('div');
  panel.id = 'pinned-messages-panel';
  panel.className = 'pinned-panel hidden';
  panel.innerHTML = `
    <div class="panel-header">
      <h3>Pinned Messages</h3>
      <div class="panel-actions">
        <button id="clear-all-pins" title="Clear all pins in this chat">Clear</button>
        <button id="close-panel" title="Close">✕</button>
      </div>
    </div>
    <div class="panel-content" id="panel-content">
      <p class="no-pins">No pinned messages yet</p>
    </div>
  `;

  document.body.appendChild(panel);
  panelElement = panel;

  // Event listeners
  panel.querySelector('#close-panel').addEventListener('click', togglePanel);
  panel.querySelector('#clear-all-pins').addEventListener('click', async () => {
    if (confirm('Clear all pinned messages in this chat?')) {
      await PinStorage.clearChat(currentConversationId);
      updatePanel();
      // Update all pin buttons in current view
      document.querySelectorAll('.pin-button.pinned').forEach(btn => {
        btn.classList.remove('pinned');
        btn.title = 'Pin this message';
      });
      showNotification('All pins cleared for this chat');
    }
  });

  updatePanel();
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
}

// Update panel content
async function updatePanel() {
  if (!panelElement) return;

  const pins = await PinStorage.getPins(currentConversationId);
  const content = panelElement.querySelector('#panel-content');

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

  // Add event listeners
  content.querySelectorAll('.jump-to-pin').forEach(btn => {
    btn.addEventListener('click', () => jumpToMessage(parseInt(btn.dataset.number)));
  });

  content.querySelectorAll('.remove-pin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const messageNumber = parseInt(btn.dataset.number);
      await PinStorage.removePin(currentConversationId, messageNumber);
      updatePanel();
      // Update button if visible
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
}

// Jump to a pinned message
function jumpToMessage(messageNumber) {
  const messageElement = document.querySelector(`[data-message-number="${messageNumber}"]`);
  
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageElement.classList.add('highlight');
    setTimeout(() => messageElement.classList.remove('highlight'), 2000);
  } else {
    showNotification('Message not found in current view');
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
    // Reset message counter for new conversation
    messageCounter = 0;
    // Re-scan messages with new numbers
    document.querySelectorAll('[data-testid^="conversation-turn-"]').forEach((msg, index) => {
      msg.dataset.messageNumber = index + 1;
      messageCounter = index + 1;
    });
  }
}).observe(document, { subtree: true, childList: true });

// Add floating toggle button
function createToggleButton() {
  const button = document.createElement('button');
  button.id = 'toggle-pins-button';
  button.className = 'toggle-pins-btn';
  button.innerHTML = 'PIN';
  button.title = 'Toggle pinned messages (Ctrl+Shift+P)';
  button.addEventListener('click', togglePanel);
  document.body.appendChild(button);
}

// Initialize
function init() {
  console.log('ChatGPT Pinner: Initializing...');
  updateConversationId();
  observeMessages();
  createToggleButton();
  createPanel();
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
