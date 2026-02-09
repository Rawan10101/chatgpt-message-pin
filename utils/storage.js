// This uses chrome.storage directly without messaging to background

const PinStorage = {
  // Get all pins for a conversation
  getPins: function(conversationId) {
    console.log('[PinStorage] Getting pins for conversation:', conversationId);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error getting pins:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          const allChats = result.pinnedMessagesByChat || {};
          const chatPins = allChats[conversationId] || [];
          console.log('[PinStorage] Got', chatPins.length, 'pins');
          resolve(chatPins);
        });
      } catch (error) {
        console.error('[PinStorage] Exception getting pins:', error);
        reject(error);
      }
    });
  },

  // Get all notes for a conversation
  getNotes: function(conversationId) {
    console.log('[PinStorage] Getting notes for conversation:', conversationId);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['notesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error getting notes:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          const allChats = result.notesByChat || {};
          const chatNotes = allChats[conversationId] || [];
          console.log('[PinStorage] Got', chatNotes.length, 'notes');
          resolve(chatNotes);
        });
      } catch (error) {
        console.error('[PinStorage] Exception getting notes:', error);
        reject(error);
      }
    });
  },

  // Add a pin
  addPin: function(conversationId, pinData) {
    console.log('[PinStorage] Adding pin for conversation:', conversationId, pinData);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.pinnedMessagesByChat || {};
          const chatPins = allChats[conversationId] || [];
          chatPins.push(pinData);
          allChats[conversationId] = chatPins;
          
          chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error saving pin:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] Pin saved! Total pins:', chatPins.length);
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception adding pin:', error);
        reject(error);
      }
    });
  },

  // Add a note
  addNote: function(conversationId, noteData) {
    console.log('[PinStorage] Adding note for conversation:', conversationId, noteData);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['notesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.notesByChat || {};
          const chatNotes = allChats[conversationId] || [];
          chatNotes.push(noteData);
          allChats[conversationId] = chatNotes;
          
          chrome.storage.local.set({ notesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error saving note:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] Note saved! Total notes:', chatNotes.length);
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception adding note:', error);
        reject(error);
      }
    });
  },

  // Remove a pin
  removePin: function(conversationId, messageNumber) {
    console.log('[PinStorage] Removing pin:', conversationId, messageNumber);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.pinnedMessagesByChat || {};
          const chatPins = allChats[conversationId] || [];
          const filtered = chatPins.filter(pin => pin.messageNumber !== messageNumber);
          allChats[conversationId] = filtered;
          
          chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error removing pin:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] Pin removed! Remaining:', filtered.length);
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception removing pin:', error);
        reject(error);
      }
    });
  },

  // Remove a note
  removeNote: function(conversationId, noteId) {
    console.log('[PinStorage] Removing note:', conversationId, noteId);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['notesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.notesByChat || {};
          const chatNotes = allChats[conversationId] || [];
          const filtered = chatNotes.filter(note => note.id !== noteId);
          allChats[conversationId] = filtered;
          
          chrome.storage.local.set({ notesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error removing note:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] Note removed! Remaining:', filtered.length);
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception removing note:', error);
        reject(error);
      }
    });
  },

  // Check if a message is pinned
  isPinned: function(conversationId, messageNumber) {
    return new Promise((resolve) => {
      this.getPins(conversationId)
        .then(pins => {
          const isPinned = pins.some(pin => pin.messageNumber === messageNumber);
          console.log('[PinStorage] Message', messageNumber, 'is pinned:', isPinned);
          resolve(isPinned);
        })
        .catch(error => {
          console.error('[PinStorage] Error checking if pinned:', error);
          resolve(false);
        });
    });
  },

  // Clear all pins for a conversation
  clearChat: function(conversationId) {
    console.log('[PinStorage] Clearing all pins for conversation:', conversationId);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['pinnedMessagesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.pinnedMessagesByChat || {};
          allChats[conversationId] = [];
          
          chrome.storage.local.set({ pinnedMessagesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error clearing pins:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] All pins cleared');
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception clearing chat:', error);
        reject(error);
      }
    });
  },

  // Clear all notes for a conversation
  clearNotes: function(conversationId) {
    console.log('[PinStorage] Clearing all notes for conversation:', conversationId);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['notesByChat'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[PinStorage] Error reading storage:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allChats = result.notesByChat || {};
          allChats[conversationId] = [];
          
          chrome.storage.local.set({ notesByChat: allChats }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PinStorage] Error clearing notes:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[PinStorage] All notes cleared');
            resolve({ success: true });
          });
        });
      } catch (error) {
        console.error('[PinStorage] Exception clearing notes:', error);
        reject(error);
      }
    });
  }
};

console.log('[PinStorage] DIRECT storage utility loaded (no background messaging)');