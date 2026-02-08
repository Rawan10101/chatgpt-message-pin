# ChatGPT Message Pinner

A Chrome extension that lets you pin important messages in ChatGPT conversations and quickly jump back to them at any time.

## Features

- **Quick Access** - View all your pinned messages in a convenient side panel  
- **Jump to Message** - Click to instantly scroll to any pinned message  
- **Keyboard Shortcut** - Toggle the panel with `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)  
- **Chat-Specific Pins** - Pins are organized per conversation, keeping your workspace clean
- **Duplicate Prevention** - Each message can only be pinned once
- **Persistent Storage** - Your pins are saved and persist across sessions  
- **ChatGPT-Style Design** - Seamlessly integrates with ChatGPT's interface  
- **Responsive** - Works on desktop and mobile views 
- **Pin ChatGPT Responses** - Pin button appears only on ChatGPT's messages , not your own messages
  
## Visuals
<img width="450" height="500" alt="image" src="https://github.com/user-attachments/assets/8b099216-2740-4350-9a50-8a44afbdb53b" />
<img width="450" height="500" alt="image" src="https://github.com/user-attachments/assets/a2e587b5-ecc3-45e4-a352-341f6e67a648" />

## Installation

### Option 1: Load Unpacked Extension (Developer Mode)

1. **Download or Clone** this repository
   ```bash
   git clone https://github.com/Rawan10101/chatgpt-message-pin.git
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Or click the puzzle icon → "Manage Extensions"

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chatgpt-pinner` folder
   - The extension should now appear in your extensions list

5. **Start Using**
   - Go to [chat.openai.com](https://chat.openai.com) or [chatgpt.com](https://chatgpt.com)
   - You'll see a green PIN button in the bottom-right corner

### Option 2: Install from Chrome Web Store (Coming Soon ISA)

The extension will be available on the Chrome Web Store soon.

## Usage

### Pinning Messages

1. **Hover over any message** in a ChatGPT conversation
2. **Click the pin icon** that appears in the top-right corner of the message
3. The message is now pinned! The icon will turn green to indicate it's pinned

### Viewing Pinned Messages

**Three ways to open the panel:**

1. Click the floating **PIN button** in the bottom-right corner
2. Click the extension icon in your Chrome toolbar
3. Use the keyboard shortcut: **`Ctrl+Shift+P`** (Windows/Linux) or **`Cmd+Shift+P`** (Mac)

### Jumping to Messages

1. Open the pinned messages panel
2. Click the **Jump** button 
3. The page will scroll to that message and highlight it

### Unpinning Messages

**Two ways to unpin:**

1. Click the green pin icon on the message again
2. Click the **Remove** button in the pinned messages panel

### Clearing All Pins

1. Open the pinned messages panel
2. Click the **Clear** button in the panel header
3. Confirm you want to clear all pins

## Technical Details

### File Structure
```
chatgpt-pinner/
├─ manifest.json           # Extension configuration
├─ content.js              # Main logic, message detection, UI injection
├─ background.js           # Service worker, storage management
├─ panel/
│   ├─ panel.html          # Panel structure reference
│   ├─ panel.js            # Panel-specific logic
│   └─ panel.css           # All styling
├─ icons/
│   └─ pin-icon.png        # Extension icons
├─ utils/
│   └─ storage.js          # Storage utility wrapper
└─ README.md               # This file
```

### Technologies Used
- **Manifest V3** - Latest Chrome extension format
- **Chrome Storage API** - For persistent data
- **MutationObserver** - For detecting new messages
- **CSS Animations** - Smooth transitions and effects

### Permissions Required
- `storage` - To save the pinned messages
- `activeTab` - To interact with ChatGPT pages
- Host permissions for `chat.openai.com` and `chatgpt.com`

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this extension however you'd like.

## Support

If you encounter any issues or have suggestions:
- Open an issue on GitHub
- Contact: [Rawan_Khalid@aucegypt.edu]
