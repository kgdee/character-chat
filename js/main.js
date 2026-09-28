const navbarTitleEl = document.querySelector(".navbar .logo span");
const messagesDisplay = document.querySelector(".messages-display");
const systemNotice = document.querySelector(".system-notice");
const typingIndicator = document.querySelector(".typing-indicator");
const messageInput = document.querySelector(".message-input textarea");
const audioPlayer = document.getElementById("audioPlayer");
const goOnBtn = document.querySelector(".go-on-btn");
const menuModal = document.querySelector(".menu-modal");
const modelSelect = document.querySelector(".model-select");

const greetings = ["Where should we start?", "What can I help with?", "What should we focus on?"];

const geminiApiKey = CONFIG.GEMINI_API_KEY;
let currentModel = load("currentModel", "gemini-3.5-flash-lite");

let currentUserName = load("currentUserName", "Traveler");
// Define your bot's identity and behavioral rules
let systemPrompt = "";

let darkTheme = load("darkTheme", true);
// Maintain conversation history for multi-turn context
const chatHistory = [];
let currentCharacters = load("currentCharacters", INITIAL_CHARACTERS);
let currentCharacter = null;
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  updateUI();
});

function getApiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;
}

function initChat() {
  messagesDisplay.innerHTML = "";

  if (currentCharacter) {
    // Add the greeting message to the history
    chatHistory.push({
      role: "model",
      parts: [{ text: currentCharacter.greeting }],
    });

    appendMessage("ai", currentCharacter.greeting);
  } else {
    systemNotice.textContent = getRandomItem(greetings);
  }
}

function updateUI() {
  modelSelect.value = currentModel;

  goOnBtn.classList.toggle("hidden", !currentCharacter);
  systemNotice.classList.toggle("hidden", currentCharacter);

  toggleTheme(darkTheme);
  document.body.style.background = currentCharacter?.image ? `url("${currentCharacter.image}") top center / cover no-repeat fixed` : "";

  document.title = `${currentCharacter?.name ? `${currentCharacter.name} - ` : ""}Character Chat`;
  navbarTitleEl.textContent = currentCharacter?.name || "Ch. Chat";
}

function applyCharacter(character) {
  currentCharacter = formatCharacter(character);

  systemPrompt = `This is a roleplay chat. Constraints: Keep answers brief (under 3 sentences). Use narrative text like *example* if needed. Your role: "${currentCharacter.intro}. ${currentCharacter.background}". Scenario: You meet me (a male stranger)`;

  initChat();
  updateUI();
  toggleFullscreen(true);
  toggleMenuModal(false);
}

function scrollToBottom() {
  messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
}

function appendMessage(role, text) {
  systemNotice.classList.add("hidden");

  // Escape and wrap asterisks with span
  const safeText = escapeHTML(text).replace(/\*[^*]+\*/g, "<span>$&</span>");
  const messageHtml = `<div class="message ${role}">${safeText}</div>`;
  messagesDisplay.insertAdjacentHTML("beforeend", messageHtml);

  if (role === "ai") listenText(removeEmphasized(text));
  scrollToBottom();
}

function loading(state) {
  isLoading = state;
  typingIndicator.classList.toggle("hidden", !state);
  if (state) scrollToBottom();
}

async function fetchData(userPrompt = "*You act*") {
  try {
    // Add the new user message to the history
    chatHistory.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

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
        contents: chatHistory,
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
    chatHistory.push({
      role: "model",
      parts: [{ text: botReply }],
    });

    return botReply;
  } catch (error) {
    handleError(error);
  }
}

async function sendMessage() {
  if (isLoading) return;

  const text = messageInput.value.trim();

  if (!text) return;

  // Render user message immediately
  appendMessage("user", text);
  messageInput.value = "";

  loading(true);

  const reply = await fetchData(text);

  appendMessage("ai", reply);

  loading(false);
}

async function goOn() {
  if (isLoading) return;
  if (!currentCharacter) return;

  loading(true);

  const reply = await fetchData();

  appendMessage("ai", reply);

  loading(false);
}

async function listenText(text) {
  const elevenlabsApiKey = "sk_0c01d5697c370e8566d87fbb0fa0c2781adcdcbe48204f1f";
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
}

// function listenText(text) {
//   window.speechSynthesis.cancel();
//   const utterance = new SpeechSynthesisUtterance(text);
//   window.speechSynthesis.speak(utterance);
// }

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  Toast.show("Text copied successfully!");
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

function toggleMessagesDisplay() {
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
