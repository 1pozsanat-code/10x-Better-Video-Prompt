import { GoogleGenAI, Chat, Type } from "@google/genai";

// 1. Initialize the Gemini AI Model
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-pro'; // Using a powerful model for complex JSON generation
const chatModel = 'gemini-2.5-flash'; // Using a faster model for chat

// 2. DOM element selectors
const promptInput = document.getElementById('prompt') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container');
const copyNotification = document.getElementById('copy-notification');
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendChatBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
const chatMessagesContainer = document.getElementById('chat-messages');
const generateVideoBtn = document.getElementById('generate-video-btn') as HTMLButtonElement;
const videoPreview = document.querySelector('.video-preview');
const sceneVisualizationContainer = document.getElementById('scene-visualization');

// 3. State variables
let chat: Chat;
let currentEnhancedPrompt: object | null = null;

// JSON schema for the enhanced prompt
const videoPromptSchema = {
    type: Type.OBJECT,
    properties: {
        meta: {
            type: Type.OBJECT,
            description: 'Metadata for the video generation model.',
            properties: {
                style: { type: Type.STRING, description: 'The overall style of the video (e.g., "sci-fi action thriller", "cinematic").' },
                aspect_ratio: { type: Type.STRING, description: 'Aspect ratio (e.g., "16:9", "21:9").' },
                duration: { type: Type.STRING, description: 'Target duration (e.g., "30s").' },
                mood: { type: Type.STRING, description: 'The emotional tone of the video.' },
            },
            required: ['style', 'aspect_ratio', 'duration', 'mood'],
        },
        scene: {
            type: Type.OBJECT,
            description: 'Details about the scene, subjects, and environment.',
            properties: {
                setting: { type: Type.STRING, description: 'The main setting of the scene.' },
                subject: { type: Type.STRING, description: 'The primary subject or character.' },
                antagonists: { type: Type.STRING, description: 'The opposing force or character. Can be "none".' },
                environment: { type: Type.STRING, description: 'Environmental conditions (e.g., "Dust storm, low visibility").' },
            },
            required: ['setting', 'subject', 'environment'],
        },
        cinematography: {
            type: Type.OBJECT,
            description: 'Camera work and shot composition.',
            properties: {
                shot_sequence: {
                    type: Type.ARRAY,
                    description: 'A sequence of 3-5 key shots describing the scene.',
                    items: { type: Type.STRING },
                },
                camera_movement: { type: Type.STRING, description: 'Description of camera movements.' },
                framing: { type: Type.STRING, description: 'Framing and composition notes.' },
                depth_of_field: { type: Type.STRING, description: 'Notes on depth of field and focus.' },
            },
            required: ['shot_sequence', 'camera_movement', 'framing'],
        },
        lighting: {
            type: Type.OBJECT,
            description: 'Lighting setup for the scene.',
            properties: {
                type: { type: Type.STRING, description: 'Primary type of lighting.' },
                quality: { type: Type.STRING, description: 'Quality of the light (e.g., "Hard shadows, high contrast").' },
                color_temperature: { type: Type.STRING, description: 'Color tones of the light.' },
                special_effects: { type: Type.STRING, description: 'Any special lighting effects.' },
            },
            required: ['type', 'quality', 'color_temperature'],
        },
        technical: {
            type: Type.OBJECT,
            description: 'Technical specifications for rendering.',
            properties: {
                resolution: { type: Type.STRING, description: 'e.g., "4K Ultra HD"' },
                frame_rate: { type: Type.STRING, description: 'e.g., "30fps"' },
                color_grading: { type: Type.STRING, description: 'Post-production color style.' },
            },
            required: ['resolution', 'frame_rate', 'color_grading'],
        },
        vfx_elements: {
            type: Type.ARRAY,
            description: 'List of 2-4 key visual effects to be included.',
            items: { type: Type.STRING },
        },
        additional_notes: {
            type: Type.STRING,
            description: 'A brief summary or other important notes for the generation model.'
        },
        tags: {
            type: Type.ARRAY,
            description: 'A list of 5-7 relevant keywords or tags for the scene.',
            items: { type: Type.STRING },
        }
    },
    required: ['meta', 'scene', 'cinematography', 'lighting', 'technical', 'tags'],
};


// 4. Helper functions

/** Shows a notification message */
function showNotification() {
  copyNotification.classList.add('show');
  setTimeout(() => {
    copyNotification.classList.remove('show');
  }, 2000);
}

/** Copies text to the clipboard */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification();
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    alert('Failed to copy');
  });
}

/** Adds a message to the chat UI */
function addMessage(text: string, sender: 'user' | 'bot') {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}-message`;
  messageEl.textContent = text;

  chatMessagesContainer.appendChild(messageEl);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

/** Displays the enhanced prompt in the results container */
function displayEnhancedPrompt(promptData: any) {
    resultsContainer.innerHTML = '';
    currentEnhancedPrompt = promptData;

    const promptCard = document.createElement('div');
    promptCard.className = 'prompt-card';

    const promptHeader = document.createElement('div');
    promptHeader.className = 'prompt-header';

    const promptTitle = document.createElement('div');
    promptTitle.className = 'prompt-title';
    promptTitle.textContent = 'Enhanced Video Prompt';

    const promptActions = document.createElement('div');
    promptActions.className = 'prompt-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.onclick = () => copyToClipboard(JSON.stringify(promptData, null, 2));

    promptActions.appendChild(copyBtn);
    promptHeader.appendChild(promptTitle);
    promptHeader.appendChild(promptActions);

    const promptContent = document.createElement('pre');
    promptContent.className = 'prompt-content';
    promptContent.textContent = JSON.stringify(promptData, null, 2);
    
    const tagsContainer = document.createElement('div');
    if (promptData.tags && Array.isArray(promptData.tags)) {
        tagsContainer.style.marginTop = '15px';
        const strong = document.createElement('strong');
        strong.textContent = 'Tags: ';
        tagsContainer.appendChild(strong);
        promptData.tags.forEach((tag:string) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }

    promptCard.appendChild(promptHeader);
    promptCard.appendChild(promptContent);
    promptCard.appendChild(tagsContainer);
    
    resultsContainer.appendChild(promptCard);
    generateVideoBtn.disabled = false;

    updateSceneVisualization(promptData.scene);
}

const iconMap: { [key: string]: string } = {
    'woman': 'fa-female', 'man': 'fa-male', 'person': 'fa-user',
    'creature': 'fa-dragon', 'animal': 'fa-dog', 'robot': 'fa-robot',
    'planet': 'fa-globe-americas', 'city': 'fa-city', 'forest': 'fa-tree', 'desert': 'fa-sun',
    'scooter': 'fa-motorcycle', 'car': 'fa-car', 'vehicle': 'fa-space-shuttle',
    'action': 'fa-bolt', 'escape': 'fa-running', 'chase': 'fa-running',
};

/** Updates the scene visualization based on the generated prompt */
function updateSceneVisualization(scene: any) {
    sceneVisualizationContainer.innerHTML = '';
    if (!scene) return;
    
    const elements: {title: string, desc: string}[] = [];
    if (scene.subject) elements.push({ title: 'Subject', desc: scene.subject });
    if (scene.setting) elements.push({ title: 'Setting', desc: scene.setting });
    if (scene.antagonists && scene.antagonists.toLowerCase() !== 'none') elements.push({ title: 'Antagonist', desc: scene.antagonists });
    if (scene.environment) elements.push({ title: 'Environment', desc: scene.environment });
    
    elements.forEach(el => {
        const lowerDesc = el.desc.toLowerCase();
        let iconClass = 'fa-film'; // default icon
        for (const key in iconMap) {
            if (lowerDesc.includes(key)) {
                iconClass = iconMap[key];
                break;
            }
        }

        const sceneElement = document.createElement('div');
        sceneElement.className = 'scene-element';
        sceneElement.innerHTML = `
            <div class="scene-icon"><i class="fas ${iconClass}"></i></div>
            <div class="scene-title">${el.title}</div>
            <div class="scene-desc">${el.desc}</div>
        `;
        sceneVisualizationContainer.appendChild(sceneElement);
    });
}

// 5. Core logic functions

/** Handles the prompt generation */
async function handleGeneratePrompt() {
    const basicPrompt = promptInput.value.trim();
    if (!basicPrompt) {
        alert('Please enter a video idea first.');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
    resultsContainer.innerHTML = '<div class="placeholder">Generating your enhanced prompt...</div>';
    sceneVisualizationContainer.innerHTML = '';
    generateVideoBtn.disabled = true;
    currentEnhancedPrompt = null;

    const systemInstruction = "You are an expert AI Video Prompt Engineer. Your task is to expand a simple user idea into a comprehensive, detailed, and structured JSON prompt for a text-to-video AI model like Google Veo. Break down the user's prompt into a rich scene description, including meta data, scene details, cinematography, lighting, and technical specifications. Follow the provided JSON schema precisely. Ensure the output is only the raw JSON object, without any markdown formatting or explanations.";
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: `${systemInstruction}\n\nUser idea: "${basicPrompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: videoPromptSchema,
            },
        });
        
        const enhancedPromptJson = JSON.parse(response.text);
        displayEnhancedPrompt(enhancedPromptJson);

    } catch (error) {
        console.error('Error generating prompt:', error);
        resultsContainer.innerHTML = `<div class="placeholder" style="color: #ff8a80;">Sorry, something went wrong. Please try again.</div>`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-magic"></i> Enhance Prompt (10X)';
    }
}

/** Handles sending a chat message */
async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';
    sendChatBtn.disabled = true;

    try {
        let fullContext = `User is asking for help with a video prompt.`;
        if (currentEnhancedPrompt) {
            fullContext += `\n\nHere is the current enhanced prompt they are working with:\n${JSON.stringify(currentEnhancedPrompt, null, 2)}`;
        }
        
        const response = await chat.sendMessage({ message: `${fullContext}\n\nUser's question: "${message}"` });
        addMessage(response.text, 'bot');
    } catch (error) {
        console.error('Chat error:', error);
        addMessage('Sorry, I had trouble connecting. Please try again.', 'bot');
    } finally {
        sendChatBtn.disabled = false;
    }
}

/** Simulates video generation */
function handleGenerateVideo() {
    generateVideoBtn.disabled = true;
    generateVideoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    const placeholder = videoPreview.querySelector('.placeholder');
    if (placeholder) placeholder.textContent = 'Connecting to generation service...';
    
    setTimeout(() => {
        videoPreview.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-film" style="font-size: 48px; margin-bottom: 15px; opacity: 0.7;"></i>
                <div>Video generation simulation complete!</div>
                <div style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">In a real app, your video would appear here.</div>
            </div>
        `;
        
        generateVideoBtn.disabled = false;
        generateVideoBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Video';
    }, 2500);
}


// 6. Event listeners
generateBtn.addEventListener('click', handleGeneratePrompt);
sendChatBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
});
generateVideoBtn.addEventListener('click', handleGenerateVideo);


// 7. Initialization logic
function initialize() {
    chat = ai.chats.create({
        model: chatModel,
        config: {
            systemInstruction: "You are a friendly and concise AI assistant specializing in video prompt engineering. Help users refine and improve their video prompts. Answer questions about cinematography, scene composition, and suggest creative ideas. If asked to modify a prompt, explain what you would change instead of providing a new JSON block."
        },
    });
    console.log("App initialized.");
}

initialize();
