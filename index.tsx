import { GoogleGenAI, Chat, Type } from "@google/genai";

// 1. Initialize the Gemini AI Model
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-pro'; // Using a powerful model for complex JSON generation
const chatModel = 'gemini-2.5-flash'; // Using a faster model for chat, summarization, and image analysis

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
const stylePresetsContainer = document.getElementById('style-presets');
const savedPromptsContainer = document.getElementById('saved-prompts-container');


// Image Upload Elements
const imageUploadInput = document.getElementById('image-upload-input') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const imagePlaceholder = document.getElementById('image-placeholder');
const analyzeImageBtn = document.getElementById('analyze-image-btn') as HTMLButtonElement;


// 3. State variables
let chat: Chat;
let currentEnhancedPrompt: object | null = null;
let uploadedImageBase64: { mimeType: string, data: string } | null = null;
let selectedStylePreset: string | null = null;
const SAVED_PROMPTS_KEY = 'ai-video-prompts';

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
                    description: 'A sequence of 3-5 key shots describing the scene. For each shot, specify the type and a brief description.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: {
                                type: Type.STRING,
                                description: 'The type of camera shot (e.g., "Establishing Shot", "Wide Shot", "Medium Shot", "Close-up", "Low-Angle Shot", "POV Shot").'
                            },
                            description: {
                                type: Type.STRING,
                                description: 'A brief description of the action or composition within this shot.'
                            }
                        },
                        required: ['shot_type', 'description']
                    }
                },
                camera_movement: { type: Type.STRING, description: 'Description of camera movements. Use specific cinematic terms like "dolly zoom", "crane shot", "whip pan", "dutch angle", "steadicam", "handheld shaky cam".' },
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

const alternativePromptsSchema = {
    type: Type.ARRAY,
    description: "An array of 3 distinct video prompt ideas.",
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "A short, creative title for the prompt idea." },
            prompt: { type: Type.STRING, description: "The descriptive video prompt text." }
        },
        required: ["title", "prompt"]
    }
};

const sceneSuggestionsSchema = {
    type: Type.ARRAY,
    description: "An array of 3 specific visual elements for the scene.",
    items: {
        type: Type.OBJECT,
        properties: {
            element: { type: Type.STRING, description: "The name of the visual element (e.g., 'Holographic Koi Fish')." },
            description: { type: Type.STRING, description: "A brief one-sentence description of the element." }
        },
        required: ["element", "description"]
    }
};


// 4. Helper functions

/** Shows a notification message */
function showNotification(message: string = 'Copied to clipboard!') {
    const span = copyNotification.querySelector('span');
    if (span) span.textContent = message;
    copyNotification.classList.add('show');
    setTimeout(() => {
        copyNotification.classList.remove('show');
    }, 2000);
}

/** Copies text to the clipboard */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Prompt copied to clipboard!');
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

    // --- JSON Section ---
    const jsonHeader = document.createElement('div');
    jsonHeader.className = 'prompt-header';
    jsonHeader.innerHTML = `
        <div class="prompt-title">Enhanced Prompt (JSON)</div>
        <div class="prompt-actions">
            <button class="action-btn" id="save-prompt-btn"><i class="fas fa-save"></i> Save</button>
            <button class="action-btn" id="copy-json-btn"><i class="fas fa-copy"></i> Copy</button>
        </div>
    `;

    const jsonContent = document.createElement('pre');
    jsonContent.className = 'prompt-content';
    jsonContent.textContent = JSON.stringify(promptData, null, 2);

    // --- Simplified Text Section ---
    const simpleTextHeader = document.createElement('div');
    simpleTextHeader.className = 'prompt-header simple-text-header'; // Add new class for styling
    simpleTextHeader.innerHTML = `
        <div class="prompt-title">Simplified Text Prompt</div>
        <div class="prompt-actions">
            <button class="action-btn" id="copy-simple-btn" disabled><i class="fas fa-copy"></i> Copy</button>
        </div>
    `;

    const simpleTextContent = document.createElement('div');
    simpleTextContent.className = 'prompt-content simple-text-content placeholder';
    simpleTextContent.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating simplified text...`;
    
    // --- Tags Section ---
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tags-container';
    if (promptData.tags && Array.isArray(promptData.tags)) {
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

    // --- Assemble Card ---
    promptCard.appendChild(jsonHeader);
    promptCard.appendChild(jsonContent);
    promptCard.appendChild(simpleTextHeader);
    promptCard.appendChild(simpleTextContent);
    promptCard.appendChild(tagsContainer);
    
    resultsContainer.appendChild(promptCard);
    
    // --- Add event listeners ---
    (promptCard.querySelector('#copy-json-btn') as HTMLButtonElement).onclick = () => copyToClipboard(JSON.stringify(promptData, null, 2));

    (promptCard.querySelector('#save-prompt-btn') as HTMLButtonElement).onclick = () => {
        const prompts = getSavedPrompts();
        const newPrompt = {
            id: Date.now(),
            title: `${promptData.scene?.subject || 'Untitled'} - ${promptData.meta?.style || 'Default Style'}`,
            data: promptData
        };
        prompts.unshift(newPrompt); // Add to the beginning of the list
        savePrompts(prompts);
        renderSavedPrompts();
        showNotification('Prompt saved successfully!');
    };


    // --- Generate and display simple prompt ---
    const copySimpleBtn = promptCard.querySelector('#copy-simple-btn') as HTMLButtonElement;
    generateSimplePrompt(promptData, simpleTextContent, copySimpleBtn);
    
    generateVideoBtn.disabled = false;
    updateSceneVisualization(promptData.scene);
}

/** Displays the alternative prompts from image analysis */
function displayAlternativePrompts(prompts: {title: string, prompt: string}[]) {
    resultsContainer.innerHTML = '';
    prompts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'alt-prompt-card';

        const title = document.createElement('h3');
        title.textContent = p.title;

        const promptText = document.createElement('p');
        promptText.textContent = p.prompt;
        
        const useBtn = document.createElement('button');
        useBtn.innerHTML = `<i class="fas fa-check-circle"></i> Use This Prompt`;
        useBtn.onclick = () => {
            promptInput.value = p.prompt;
            promptInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        card.appendChild(title);
        card.appendChild(promptText);
        card.appendChild(useBtn);
        resultsContainer.appendChild(card);
    });
}


/** Generates and populates the simplified text prompt */
async function generateSimplePrompt(promptData: any, contentElement: HTMLElement, buttonElement: HTMLButtonElement) {
    try {
        const generationPrompt = `Based on the following detailed JSON video prompt, create a concise, human-readable, single-paragraph text prompt for an AI video generation model. Focus on the most critical visual elements, actions, atmosphere, and cinematic style. The output must be under 1000 characters and should be plain text only, without any titles, markdown, or explanations.

JSON Prompt:
${JSON.stringify(promptData, null, 2)}`;

        const response = await ai.models.generateContent({
            model: chatModel, // Use the faster model for this task
            contents: generationPrompt,
        });
        
        const simpleText = response.text.trim();
        
        contentElement.textContent = simpleText;
        contentElement.classList.remove('placeholder');
        
        buttonElement.disabled = false;
        buttonElement.onclick = () => copyToClipboard(simpleText);

    } catch (error) {
        console.error('Error generating simple prompt:', error);
        contentElement.innerHTML = 'Failed to generate simplified prompt.';
        contentElement.style.color = '#ff8a80';
        contentElement.classList.remove('placeholder');
    }
}


const iconMap: { [key: string]: string } = {
    'woman': 'fa-female', 'man': 'fa-male', 'person': 'fa-user',
    'creature': 'fa-dragon', 'animal': 'fa-dog', 'robot': 'fa-robot',
    'planet': 'fa-globe-americas', 'city': 'fa-city', 'forest': 'fa-tree', 'desert': 'fa-sun',
    'scooter': 'fa-motorcycle', 'car': 'fa-car', 'vehicle': 'fa-space-shuttle',
    'action': 'fa-bolt', 'escape': 'fa-running', 'chase': 'fa-running',
};

/** Generates and displays scene element suggestions */
async function getAndDisplaySceneSuggestions(scene: any, container: HTMLElement) {
    try {
        const suggestionPrompt = `Based on the following scene description, suggest 3 specific, tangible, and visually interesting elements or objects that would exist in this environment. Focus on small details that enhance the atmosphere. Return an empty array if no specific suggestions come to mind.

Setting: ${scene.setting}
Subject: ${scene.subject}
Environment: ${scene.environment}`;

        const response = await ai.models.generateContent({
            model: chatModel, // Use the faster model for this creative task
            contents: suggestionPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: sceneSuggestionsSchema,
            },
        });
        
        const suggestions = JSON.parse(response.text);

        // Clear loading placeholder
        container.innerHTML = ''; 
        
        if (!suggestions || suggestions.length === 0) {
             const parent = container.parentElement;
             if (parent) parent.style.display = 'none'; // Hide the whole suggestions section if there are no suggestions
             return;
        }

        suggestions.forEach((sug: {element: string, description: string}) => {
            const suggestionElement = document.createElement('div');
            suggestionElement.className = 'scene-element suggestion'; 
            suggestionElement.title = sug.description; // Tooltip for full description
            suggestionElement.innerHTML = `
                <div class="scene-icon"><i class="fas fa-lightbulb"></i></div>
                <div class="scene-title">${sug.element}</div>
                <div class="scene-desc">${sug.description}</div>
            `;
            container.appendChild(suggestionElement);
        });

    } catch (error) {
        console.error('Error generating scene suggestions:', error);
        container.innerHTML = '<div class="placeholder" style="color: #ff8a80; text-align: center; width: 100%;">Could not generate suggestions.</div>';
    }
}


/** Updates the scene visualization based on the generated prompt */
function updateSceneVisualization(scene: any) {
    sceneVisualizationContainer.innerHTML = '';
    if (!scene) return;
    
    // --- Render Core Elements ---
    const coreElementsContainer = document.createElement('div');
    coreElementsContainer.className = 'scene-elements-grid';

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
        coreElementsContainer.appendChild(sceneElement);
    });
    sceneVisualizationContainer.appendChild(coreElementsContainer);

    // --- Render Suggested Elements ---
    if (scene.setting && scene.subject && scene.environment) {
        const suggestionsSection = document.createElement('div');
        suggestionsSection.className = 'suggestions-section';
        
        const suggestionsHeader = document.createElement('h3');
        suggestionsHeader.className = 'suggestions-title';
        suggestionsHeader.innerHTML = `<i class="fas fa-magic"></i> Suggested Details`;
        suggestionsSection.appendChild(suggestionsHeader);

        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'scene-elements-grid';
        suggestionsContainer.innerHTML = `<div class="placeholder" style="text-align: center; width: 100%;"><i class="fas fa-spinner fa-spin"></i> Generating ideas...</div>`;
        suggestionsSection.appendChild(suggestionsContainer);

        sceneVisualizationContainer.appendChild(suggestionsSection);

        // Asynchronously fetch and display suggestions
        getAndDisplaySceneSuggestions(scene, suggestionsContainer);
    }
}

// 5. Core logic functions

/** Handles the prompt generation from text */
async function handleGeneratePrompt() {
    const basicPrompt = promptInput.value.trim();
    if (!basicPrompt) {
        alert('Please enter a video idea first.');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
    resultsContainer.innerHTML = '<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Generating your enhanced prompt...</div>';
    sceneVisualizationContainer.innerHTML = '';
    generateVideoBtn.disabled = true;
    currentEnhancedPrompt = null;

    const systemInstruction = "You are an expert AI Video Prompt Engineer. Your task is to expand a simple user idea into a comprehensive, detailed, and structured JSON prompt for a text-to-video AI model like Google Veo. If a style preset is provided, ensure the 'meta.style' field in the JSON reflects this style and that other fields (like lighting, color_grading, cinematography, etc.) are influenced by it to create a cohesive result. Break down the user's prompt into a rich scene description, including meta data, scene details, cinematography, lighting, and technical specifications. Crucially, for the 'cinematography' section, you must use specific and professional cinematic terms. For 'shot_sequence', provide an array of objects, each defining a 'shot_type' (e.g., 'Establishing Shot', 'Wide Shot', 'Close-up', 'Low-Angle Shot') and a 'description' of what happens in that shot. For 'camera_movement', suggest techniques like 'crane shot', 'dolly zoom', 'whip pan', 'tracking shot', or 'handheld shaky effect' to match the mood and action of the scene. Follow the provided JSON schema precisely. Ensure the output is only the raw JSON object, without any markdown formatting or explanations.";
    
    let finalPrompt = `User idea: "${basicPrompt}"`;
    if (selectedStylePreset) {
        finalPrompt = `Apply the following style preset: "${selectedStylePreset}".\n\n${finalPrompt}`;
    }

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: finalPrompt,
            config: {
                systemInstruction,
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

/** Handles image file selection and preview */
function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            imagePreview.src = result;
            imagePreview.style.display = 'block';
            imagePlaceholder.style.display = 'none';
            analyzeImageBtn.disabled = false;

            // Store base64 data
            const [header, base64] = result.split(',');
            uploadedImageBase64 = {
                mimeType: file.type,
                data: base64
            };
        };
        reader.readAsDataURL(file);
    }
}

/** Handles prompt generation from an image */
async function handleAnalyzeImage() {
    if (!uploadedImageBase64) {
        alert('Please upload an image first.');
        return;
    }

    analyzeImageBtn.disabled = true;
    analyzeImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    resultsContainer.innerHTML = '<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Analyzing image and generating prompts...</div>';

    const imagePart = {
        inlineData: uploadedImageBase64
    };

    const textPart = {
        text: "Analyze this image carefully. Based on its content, mood, and potential stories, generate 3 distinct and creative video prompt ideas. The user wants to create a short video inspired by this image. For each idea, provide a short, catchy title and a descriptive prompt text. Follow the provided JSON schema."
    };

    try {
        const response = await ai.models.generateContent({
            model: chatModel, // Flash model is great for multimodal tasks
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: alternativePromptsSchema,
            },
        });
        
        const alternativePrompts = JSON.parse(response.text);
        displayAlternativePrompts(alternativePrompts);
    } catch (error) {
        console.error('Error analyzing image:', error);
        resultsContainer.innerHTML = `<div class="placeholder" style="color: #ff8a80;">Sorry, failed to analyze the image. Please try a different one.</div>`;
    } finally {
        analyzeImageBtn.disabled = false;
        analyzeImageBtn.innerHTML = '<i class="fas fa-cogs"></i> Analyze Image';
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


// 6. Saved Prompts Logic

/** Gets all saved prompts from localStorage */
function getSavedPrompts(): any[] {
    const promptsJson = localStorage.getItem(SAVED_PROMPTS_KEY);
    return promptsJson ? JSON.parse(promptsJson) : [];
}

/** Saves an array of prompts to localStorage */
function savePrompts(prompts: any[]) {
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts));
}

/** Renders the list of saved prompts in the UI */
function renderSavedPrompts() {
    const prompts = getSavedPrompts();
    savedPromptsContainer.innerHTML = ''; // Clear existing list

    if (prompts.length === 0) {
        savedPromptsContainer.innerHTML = '<div class="placeholder">No saved prompts yet.</div>';
        return;
    }

    prompts.forEach(prompt => {
        const item = document.createElement('div');
        item.className = 'saved-prompt-item';
        item.innerHTML = `
            <div class="saved-prompt-info">
                <div class="saved-prompt-title" title="${prompt.title}">${prompt.title}</div>
                <div class="saved-prompt-date">${new Date(prompt.id).toLocaleString()}</div>
            </div>
            <div class="saved-prompt-actions">
                <button class="action-btn load-btn" data-id="${prompt.id}"><i class="fas fa-folder-open"></i> Load</button>
                <button class="action-btn delete-btn" data-id="${prompt.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
        `;
        savedPromptsContainer.appendChild(item);
    });
}

/** Loads a saved prompt into the results view */
function handleLoadPrompt(promptId: number) {
    const prompts = getSavedPrompts();
    const promptToLoad = prompts.find(p => p.id === promptId);
    if (promptToLoad) {
        displayEnhancedPrompt(promptToLoad.data);
        promptInput.value = ''; // Clear input as we've loaded a prompt
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showNotification('Prompt loaded successfully!');
    } else {
        console.error('Could not find prompt with id:', promptId);
        showNotification('Error: Could not load prompt.');
    }
}

/** Deletes a prompt from localStorage */
function handleDeletePrompt(promptId: number) {
    if (!confirm('Are you sure you want to delete this prompt?')) {
        return;
    }
    let prompts = getSavedPrompts();
    prompts = prompts.filter(p => p.id !== promptId);
    savePrompts(prompts);
    renderSavedPrompts();
    showNotification('Prompt deleted.');
}


// 7. Event listeners & Initialization
function init() {
    generateBtn.addEventListener('click', handleGeneratePrompt);
    sendChatBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
    generateVideoBtn.addEventListener('click', handleGenerateVideo);
    imageUploadInput.addEventListener('change', handleImageUpload);
    analyzeImageBtn.addEventListener('click', handleAnalyzeImage);

    // Saved prompts event delegation
    savedPromptsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const loadBtn = target.closest('.load-btn');
        const deleteBtn = target.closest('.delete-btn');

        if (loadBtn) {
            const promptId = parseInt(loadBtn.getAttribute('data-id')!, 10);
            handleLoadPrompt(promptId);
        }

        if (deleteBtn) {
            const promptId = parseInt(deleteBtn.getAttribute('data-id')!, 10);
            handleDeletePrompt(promptId);
        }
    });
    
    // Initialize chat
    chat = ai.chats.create({
        model: chatModel,
        config: {
            systemInstruction: 'You are a friendly and helpful AI assistant specializing in video prompt engineering. Help the user refine their ideas and understand the generated prompts.',
        },
    });

    // Style preset button logic
    stylePresetsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.style-preset-btn');
        if (button) {
            const style = button.getAttribute('data-style');
            const currentActive = stylePresetsContainer.querySelector('.active');
            
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            
            if (selectedStylePreset === style) {
                selectedStylePreset = null;
            } else {
                button.classList.add('active');
                selectedStylePreset = style;
            }
        }
    });

    // Initial render of saved prompts
    renderSavedPrompts();
}

init();