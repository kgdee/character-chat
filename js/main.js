const navbarTitleEl = document.querySelector(".navbar .logo span");
const chatBody = document.querySelector(".chat-body");
const messagesDisplay = document.querySelector(".messages-display");
const systemNotice = document.querySelector(".system-notice");
const typingIndicator = document.querySelector(".typing-indicator");
const messageInput = document.querySelector(".message-input textarea");
const audioPlayer = document.getElementById("audioPlayer");
const goOnBtn = document.querySelector(".go-on-btn");
const menuModal = document.querySelector(".menu-modal");
const modelSelect = document.querySelector(".model-select");
const voiceSelect = document.querySelector(".voice-select");

const geminiApiKey = CONFIG.GEMINI_API_KEY;
const elevenlabsApiKey = CONFIG.ELEVENLABS_API_KEY;

const greetings = ["Where should we start?", "What can I help with?", "What should we focus on?"];
const goOnMsg = "*You act*";
const maxMessages = 100;

let currentModel = load("currentModel", "gemini-3.5-flash-lite");
let currentUserName = load("currentUserName", "Traveler");
// Define your bot's identity and behavioral rules
let systemPrompt = "";
let voices = [];
let currentMessages = [];
let currentCharacters = load("currentCharacters", INITIAL_CHARACTERS);
let currentCharacter = null;
let darkTheme = load("darkTheme", true);
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  populateVoiceList();
  initChat();
});

function getApiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;
}

function initChat() {
  currentMessages = load(`currentMessages_${currentCharacter?.name}`, []);
  messagesDisplay.innerHTML = "";

  if (currentCharacter && currentMessages.length <= 0) {
    // Add the greeting message to the history
    addMessage("model", currentCharacter.greeting);
  }

  toggleMenuModal(false);
  updateUI();

  if (currentMessages.length === 1 && currentMessages[0].role !== "user") speakMessage(currentMessages[0].id);
}

function addMessage(role, text) {
  const msgData = {
    id: generateId(),
    role: role,
    parts: [{ text: text }],
  };

  currentMessages.push(msgData);
  if (currentMessages.length > 3) currentMessages.shift();

  save(`currentMessages_${currentCharacter?.name}`, currentMessages);

  if (text !== goOnMsg) appendMessage(msgData);
}

async function deleteMessage(messageId, showConfirm = false) {
  const index = currentMessages.findIndex((item) => item.id === messageId);
  if (index === -1) return;

  if (showConfirm) {
    const confirmed = await ConfirmModal.confirmAction(`Delete message?`, "This action cannot be undone.");
    if (!confirmed) return;
  }

  currentMessages = currentMessages.slice(0, index);

  save(`currentMessages_${currentCharacter?.name}`, currentMessages);

  updateUI();
}

async function redoMessage(messageId) {
  const index = currentMessages.findIndex((item) => item.id === messageId);
  if (index === -1) return;

  const confirmed = await ConfirmModal.confirmAction(`Redo message?`, "This action cannot be undone.");
  if (!confirmed) return;

  let userMessage = null;
  // Loop backward from the target index to find the most recent user message
  for (let i = index; i >= 0; i--) {
    if (currentMessages[i].role === "user") {
      userMessage = { ...currentMessages[i] };
    }
  }

  if (userMessage) {
    await deleteMessage(userMessage.id);
    sendMessage(userMessage.parts[0].text);
  } else {
    await deleteMessage(messageId);
    goOn();
  }
}

async function restartChat() {
  const confirmed = await ConfirmModal.confirmAction(`Restart this chat?`, "This will clear your conversation and start a new session.");
  if (!confirmed) return;

  currentMessages = [];
  save(`currentMessages_${currentCharacter?.name}`, currentMessages);
  initChat();
}

function renderMessages() {
  messagesDisplay.innerHTML = currentMessages.map((item) => (item.parts[0].text === goOnMsg ? "" : createMessageHTML(item))).join("");
}

function updateUI() {
  renderMessages();

  modelSelect.value = currentModel;

  goOnBtn.classList.toggle("hidden", !currentCharacter);

  systemNotice.classList.toggle("hidden", currentCharacter || currentMessages.length > 0);
  if (!currentCharacter) systemNotice.textContent = getRandomItem(greetings);

  toggleTheme(darkTheme);
  document.body.style.background = currentCharacter?.image ? `url("${currentCharacter.image}") top center / cover no-repeat fixed` : "";

  document.title = `${currentCharacter?.name ? `${currentCharacter.name} - ` : ""}Character Chat`;
  navbarTitleEl.textContent = currentCharacter?.name || "Ch. Chat";
}

function applyCharacter(character) {
  currentCharacter = formatCharacter(character);

  systemPrompt = `This is a roleplay chat. Constraints: Keep answers brief (under 3 sentences). Use narrative text like *example* if needed. Your role: "${currentCharacter.intro}. ${currentCharacter.background}". Scenario: You meet me (a male stranger)`;

  initChat();
}

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

function appendMessage(data) {
  systemNotice.classList.add("hidden");

  messagesDisplay.insertAdjacentHTML("beforeend", createMessageHTML(data));

  if (data.role !== "user") speakMessage(data.id);
  scrollToBottom();
}

function createMessageHTML(data) {
  const safeText = escapeHTML(data.parts[0].text).replace(/\*[^*]+\*/g, "<span>$&</span>");
  const role = data.role === "user" ? data.role : "ai";
  const isUser = role === "user";

  const messageHtml = `
  <div class="message ${role}" data-id="${data.id}">
    <div class="text-box">
      ${safeText}
    </div>
    <div class="actions">
      <button onclick="speakMessage('${data.id}')"><i class="bi bi-volume-up"></i></button>
      <button onclick="copyMessage('${data.id}')"><i class="bi bi-copy"></i></button>
      ${!isUser ? `<button onclick="redoMessage('${data.id}')"><i class="bi bi-arrow-clockwise"></i></button>` : ""}
      ${isUser ? `<button onclick="deleteMessage('${data.id}', true)"><i class="bi bi-trash"></i></button>` : ""}
    </div>
  </div>`;

  return messageHtml;
}

function loading(state) {
  isLoading = state;
  typingIndicator.classList.toggle("hidden", !state);
  if (state) scrollToBottom();
}

async function fetchData(userPrompt = "*You act*") {
  try {
    addMessage("user", userPrompt);

    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        // Pass the ENTIRE conversation array instead of just one prompt
        contents: currentMessages.map(({ id, ...rest }) => rest),
      }),
    });

    // Handle HTTP error statuses (e.g., 404, 500, 429)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!botReply) {
      throw new Error("Invalid response format received from the API.");
    }

    // Add the bot's response back into the history so it remembers it next time
    addMessage("model", botReply);

    return botReply;
  } catch (error) {
    handleError(error);
  }
}

async function sendMessage(text) {
  if (isLoading) return;

  text = text || messageInput.value.trim();

  if (!text) return;

  messageInput.value = "";

  loading(true);

  const reply = await fetchData(text);

  loading(false);
}

async function goOn() {
  if (isLoading) return;
  if (!currentCharacter) return;

  loading(true);

  const reply = await fetchData();

  loading(false);
}

function populateVoiceList() {
  voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en"));

  voiceSelect.innerHTML = voices
    .map(
      (voice, i) => `
    <option value="${i}">
      ${voice.name} (${voice.lang})${voice.default ? " — Default" : ""}
    </option>
  `,
    )
    .join("");
}

if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = populateVoiceList;
}

function speakMessage(messageId) {
  const message = currentMessages.filter((item) => item.id === messageId)[0];
  if (!message) return;

  const text = removeEmphasized(message.parts[0].text);

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const selectedIndex = voiceSelect.value;
  if (voices[selectedIndex]) {
    utterance.voice = voices[selectedIndex];
  }

  window.speechSynthesis.speak(utterance);
}

async function listenMessage(messageId) {
  const message = currentMessages.filter((item) => item.id === messageId)[0];
  if (!message) return;

  const text = removeEmphasized(message.parts[0].text);

  if (currentCharacter && message.role !== "user") {
    const voiceId = VOICES[currentCharacter?.voice || 0].id;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenlabsApiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2", // Updated model ID
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    // Convert response audio stream to a playable URL
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    audioPlayer.src = audioUrl;
    audioPlayer.play();
  } else {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}

function copyMessage(messageId) {
  const message = currentMessages.filter((item) => item.id === messageId)[0];
  if (!message) return;

  copyText(message.parts[0].text);
}

function formatCharacter(character) {
  // Deep clone to avoid mutating the original object
  const formattedChar = JSON.parse(JSON.stringify(character));
  const characterName = formattedChar.name;

  // Helper function to replace placeables in strings
  const replacePlaceholders = (str) => {
    if (typeof str !== "string") return str;
    return str.replaceAll("{char}", characterName).replaceAll("{user}", currentUserName);
  };

  // Iterate over all keys in the object
  for (const key in formattedChar) {
    if (typeof formattedChar[key] === "string") {
      formattedChar[key] = replacePlaceholders(formattedChar[key]);
    }
  }

  return formattedChar;
}

function toggleChatBody() {
  if (!currentCharacter) return;
  messagesDisplay.classList.toggle("invisible");
}

function toggleMenuModal(force) {
  const shouldHide = force !== undefined ? !force : undefined;
  menuModal.classList.toggle("hidden", shouldHide);
}

async function changeUserName() {
  const newUserName = prompt("Enter your new user name:", currentUserName);

  if (newUserName && newUserName.trim() !== "") {
    currentUserName = newUserName;
    save("currentUserName", currentUserName);
  }
}

function changeModel(model) {
  currentModel = model;
  save("currentModel", currentModel);
}

function toggleTheme(force = undefined) {
  const checkbox = document.querySelector(".theme-checkbox");
  const descEl = document.querySelector(".theme-desc");
  force === undefined ? (darkTheme = !darkTheme) : (darkTheme = force);
  save("darkTheme", darkTheme);
  document.body.classList.toggle("dark-theme", darkTheme);
  checkbox.checked = darkTheme;
  descEl.textContent = darkTheme ? "Enabled" : "Disabled";
}

const keyActions = {
  KeyF: toggleFullscreen,
};

document.addEventListener("keydown", (event) => {
  const action = keyActions[event.code];
  const isFocus = document.activeElement.matches("input, textarea");

  if (action && !isFocus) {
    event.preventDefault();
    action();
  }
});
