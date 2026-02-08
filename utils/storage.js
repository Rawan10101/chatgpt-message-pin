const PinStorage = {
  async getPins(conversationId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
        const allChats = result.pinnedMessagesByChat || {};
        resolve(allChats[conversationId] || []);
      });
    });
  },

  // Get all chats with pins
  async getAllChats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
        resolve(result.pinnedMessagesByChat || {});
      });
    });
  },

  // Add a new pinned message
  async addPin(conversationId, messageData) {
    const allChats = await this.getAllChats();
    const chatPins = allChats[conversationId] || [];
    
    // Check if message is already pinned by checking message number
    const existingIndex = chatPins.findIndex(pin => pin.messageNumber === messageData.messageNumber);
    if (existingIndex !== -1) {
      return { success: false, message: 'Message already pinned' };
    }

    chatPins.push({
      ...messageData,
      pinnedAt: Date.now()
    });

    allChats[conversationId] = chatPins;

    return new Promise((resolve) => {
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        resolve({ success: true, pins: chatPins });
      });
    });
  },

  // Remove a pinned message
  async removePin(conversationId, messageNumber) {
    const allChats = await this.getAllChats();
    const chatPins = allChats[conversationId] || [];
    const filtered = chatPins.filter(pin => pin.messageNumber !== messageNumber);

    allChats[conversationId] = filtered;

    return new Promise((resolve) => {
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        resolve({ success: true, pins: filtered });
      });
    });
  },

  // Clear all pins for a specific chat
  async clearChat(conversationId) {
    const allChats = await this.getAllChats();
    delete allChats[conversationId];

    return new Promise((resolve) => {
      chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
        resolve({ success: true });
      });
    });
  },

  // Clear all pins across all chats
  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ pinnedMessagesByChat: {} }, () => {
        resolve({ success: true });
      });
    });
  },

  // Check if a message is pinned by message number
  async isPinned(conversationId, messageNumber) {
    const pins = await this.getPins(conversationId);
    return pins.some(pin => pin.messageNumber === messageNumber);
  }
};

// Make it available globally for content script
if (typeof window !== 'undefined') {
  window.PinStorage = PinStorage;
}
