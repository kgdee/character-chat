const navbarTitleEl = document.querySelector(".navbar .logo span");
const messagesDisplay = document.querySelector(".messages-display");
const systemNotice = document.querySelector(".system-notice");
const typingIndicator = document.querySelector(".typing-indicator");
const messageInput = document.querySelector(".message-input textarea");
const audioPlayer = document.getElementById("audioPlayer");

const greetings = ["Where should we start?", "What can I help with?", "What should we focus on?"];

let userName = "Traveler";
// Define your bot's identity and behavioral rules
let systemPrompt = "";

// Maintain conversation history for multi-turn context
const chatHistory = [];
let currentCharacters = load("currentCharacters", INITIAL_CHARACTERS);
let currentCharacter = null;
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  systemNotice.textContent = getRandomItem(greetings);
});

function initChat() {
  messagesDisplay.innerHTML = "";

  if (currentCharacter) {
    // Add the greeting message to the history
    chatHistory.push({
      role: "model",
      parts: [{ text: currentCharacter.greeting }],
    });

    appendMessage("ai", currentCharacter.greeting);
  }

  updateUI();
}

function updateUI() {
  document.body.style.background = currentCharacter?.image ? `url("${currentCharacter.image}") top center / cover no-repeat fixed` : "";

  document.title = `${currentCharacter?.name ? `${currentCharacter.name} - ` : ""}Character Chat`;
  navbarTitleEl.textContent = currentCharacter?.name || "Character Chat";
}

function applyCharacter(character) {
  currentCharacter = formatCharacter(character);

  systemPrompt = `This is a roleplay chat. Constraints: Keep answers brief (under 3 sentences). Use narrative text like *example* if needed. Your role: "${currentCharacter.intro}. ${currentCharacter.background}". Scenario: You meet me (a male stranger)`;

  initChat();
  toggleFullscreen(true);
  Toast.show("Character applied successfully");
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

async function fetchData(userPrompt) {
  try {
    // Add the new user message to the history
    chatHistory.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

    const response = await fetch(API_URL, {
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
      role: "model", // Must be "model" (or "user" for input), not "assistant"
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
    return str.replaceAll("{char}", characterName).replaceAll("{user}", userName);
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
