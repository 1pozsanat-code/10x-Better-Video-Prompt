import { GoogleGenAI, Chat, Type } from "@google/genai";

// 1. Initialize the Gemini AI Model
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-pro'; // Using a powerful model for complex JSON generation
const chatModel = 'gemini-2.5-flash'; // Using a faster model for chat, summarization, and image analysis

// 2. DOM element selectors
const promptInput = document.getElementById('prompt') as HTMLTextAreaElement;
const negativePromptInput = document.getElementById('negative-prompt') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container');
const copyNotification = document.getElementById('copy-notification');
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendChatBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
const chatMessagesContainer = document.getElementById('chat-messages');
const generateVideoBtn = document.getElementById('generate-video-btn') as HTMLButtonElement;
const videoPreview = document.querySelector('.video-preview');
const stylePresetsContainer = document.getElementById('style-presets');
const savedPromptsContainer = document.getElementById('saved-prompts-container');

// Image Upload Elements
const imageUploadInput = document.getElementById('image-upload-input') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const imagePlaceholder = document.getElementById('image-placeholder');
const analyzeImageBtn = document.getElementById('analyze-image-btn') as HTMLButtonElement;

// NEW Viewfinder selectors
const viewfinderDisplay = document.getElementById('viewfinder-display');
const viewfinderControls = document.getElementById('viewfinder-controls');
const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
const panSlider = document.getElementById('pan-slider') as HTMLInputElement;
const tiltSlider = document.getElementById('tilt-slider') as HTMLInputElement;

// NEW Scene Catalysts selector
const catalystsContainer = document.getElementById('catalysts-content');

// NEW Negative Prompt Analysis selectors
const analyzeNegativeBtn = document.getElementById('analyze-negative-btn') as HTMLButtonElement;
const negativePromptFeedback = document.getElementById('negative-prompt-feedback');


// 3. State variables
let chat: Chat;
let currentEnhancedPrompt: object | null = null;
let uploadedImageBase64: { mimeType: string, data: string } | null = null;
let selectedStylePreset: string | null = null;
const SAVED_PROMPTS_KEY = 'ai-video-prompts';

// NEW Viewfinder state
let currentSceneData: any | null = null;
let tiltedDescriptionsCache: { gritty: any | null, epic: any | null } = {
    gritty: null,
    epic: null,
};


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
                negative_prompt: { 
                    type: Type.STRING, 
                    description: 'A concise summary of elements, styles, or concepts to explicitly exclude from the video. Can be "none" if no exclusions are provided.' 
                },
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

const tiltedDescriptionsSchema = {
    type: Type.OBJECT,
    properties: {
        subject: { type: Type.STRING, description: "The rewritten subject description." },
        setting: { type: Type.STRING, description: "The rewritten setting description." },
        environment: { type: Type.STRING, description: "The rewritten environment description." },
    },
    required: ["subject", "setting", "environment"]
};

const catalystSchema = {
    type: Type.OBJECT,
    properties: {
        antagonist_actions: {
            type: Type.ARRAY,
            description: "An array of 2-3 dynamic and engaging actions the antagonist could perform. These should be short, evocative phrases.",
            items: { type: Type.STRING }
        },
        environmental_events: {
            type: Type.ARRAY,
            description: "An array of 2-3 dynamic environmental events or effects that could occur in the scene. These should be short, evocative phrases.",
            items: { type: Type.STRING }
        }
    },
    required: ["antagonist_actions", "environmental_events"]
};

const negativePromptAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        feedback: { type: Type.STRING, description: "Constructive feedback and analysis of the negative prompt." },
        suggested_prompt: { type: Type.STRING, description: "A revised, more effective negative prompt." }
    },
    required: ["feedback", "suggested_prompt"]
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
    
    // --- Exclusions Section ---
    const exclusionsContainer = document.createElement('div');
    exclusionsContainer.className = 'exclusions-container';
    if (promptData.meta?.negative_prompt && promptData.meta.negative_prompt.toLowerCase() !== 'none') {
        const strong = document.createElement('strong');
        strong.innerHTML = '<i class="fas fa-ban"></i> Exclusions: ';
        exclusionsContainer.appendChild(strong);
        const exclusionText = document.createElement('span');
        exclusionText.textContent = promptData.meta.negative_prompt;
        exclusionsContainer.appendChild(exclusionText);
    }

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
    if (exclusionsContainer.hasChildNodes()) {
        promptCard.appendChild(exclusionsContainer);
    }
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
    setupInteractiveViewfinder(promptData.scene);

    // --- Trigger catalyst generation ---
    if (catalystsContainer) {
        catalystsContainer.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Generating creative suggestions...</div>`;
        catalystsContainer.classList.add('placeholder');
        generateSceneCatalysts(promptData.scene);
    }
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
        let generationPrompt = `Based on the following detailed JSON video prompt, create a concise, human-readable, single-paragraph text prompt for an AI video generation model. Focus on the most critical visual elements, actions, atmosphere, and cinematic style. The output must be under 1000 characters and should be plain text only, without any titles, markdown, or explanations.

JSON Prompt:
${JSON.stringify(promptData, null, 2)}`;

        if (promptData.meta?.negative_prompt && promptData.meta.negative_prompt.toLowerCase() !== 'none') {
            generationPrompt += `\n\nImportant: The final prompt must also incorporate the following exclusions: ${promptData.meta.negative_prompt}`;
        }

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

/** Sets up the interactive viewfinder with controls */
function setupInteractiveViewfinder(scene: any) {
    if (!scene || !viewfinderDisplay || !viewfinderControls) {
        if(viewfinderDisplay) viewfinderDisplay.innerHTML = '<div class="placeholder">Scene data is missing.</div>';
        if(viewfinderControls) viewfinderControls.style.display = 'none';
        return;
    }

    // Store data and reset caches for this new scene
    currentSceneData = scene;
    tiltedDescriptionsCache = { gritty: null, epic: null };

    // Reset sliders to default positions
    zoomSlider.value = '2';
    panSlider.value = '2';
    tiltSlider.value = '2';
    
    viewfinderDisplay.innerHTML = ''; // Clear previous content
    viewfinderControls.style.display = 'grid'; // Show controls

    const grid = document.createElement('div');
    grid.className = 'viewfinder-grid';
    grid.id = 'viewfinder-grid'; // Add id for easy selection
    
    const elements: { title: string, desc: string, group: 'character' | 'world' }[] = [];
    if (scene.subject) elements.push({ title: 'Subject', desc: scene.subject, group: 'character' });
    if (scene.setting) elements.push({ title: 'Setting', desc: scene.setting, group: 'world' });
    if (scene.antagonists && scene.antagonists.toLowerCase() !== 'none') elements.push({ title: 'Antagonist', desc: scene.antagonists, group: 'character' });
    if (scene.environment) elements.push({ title: 'Environment', desc: scene.environment, group: 'world' });
    
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
        sceneElement.className = 'viewfinder-element';
        sceneElement.dataset.group = el.group; // For panning
        sceneElement.dataset.title = el.title; // For tilting
        sceneElement.innerHTML = `
            <div class="viewfinder-icon"><i class="fas ${iconClass}"></i></div>
            <div class="viewfinder-title">${el.title}</div>
            <div class="viewfinder-desc">${el.desc}</div>
        `;
        grid.appendChild(sceneElement);
    });

    viewfinderDisplay.appendChild(grid);
    applyZoom(); // Apply initial zoom level
    applyPan(); // Apply initial pan focus
}

/** Applies zoom level based on slider */
function applyZoom() {
    const grid = document.getElementById('viewfinder-grid');
    if (!grid) return;
    const level = zoomSlider.value;
    grid.classList.remove('zoom-level-1', 'zoom-level-2');
    grid.classList.add(`zoom-level-${level}`);
}

/** Applies pan focus based on slider */
function applyPan() {
    const elements = document.querySelectorAll('.viewfinder-element');
    const focus = panSlider.value; // 1: character, 2: neutral, 3: world

    elements.forEach(el => {
        const element = el as HTMLElement;
        element.classList.remove('pan-unfocused');

        if (focus === '1' && element.dataset.group !== 'character') {
            element.classList.add('pan-unfocused');
        } else if (focus === '3' && element.dataset.group !== 'world') {
            element.classList.add('pan-unfocused');
        }
    });
}

/** Handles tilt angle changes */
async function handleTilt() {
    if (!currentSceneData) return;
    const angle = tiltSlider.value; // 1: gritty, 2: neutral, 3: epic

    let newDescriptions: any = null;
    let tone: 'gritty' | 'epic' | null = null;
    
    if (angle === '1') tone = 'gritty';
    if (angle === '3') tone = 'epic';

    if (tone) {
        if (tiltedDescriptionsCache[tone]) {
            newDescriptions = tiltedDescriptionsCache[tone];
        } else {
            newDescriptions = await generateTiltedDescriptions(tone);
            tiltedDescriptionsCache[tone] = newDescriptions; // Cache the result
        }
    } else { // Neutral
        newDescriptions = {
            subject: currentSceneData.subject,
            setting: currentSceneData.setting,
            environment: currentSceneData.environment,
            // We don't modify antagonist
        };
    }
    
    updateTiltDescriptions(newDescriptions);
}

/** Fetches new descriptions from AI based on tone */
async function generateTiltedDescriptions(tone: 'gritty' | 'epic'): Promise<any> {
    const allDescElements = document.querySelectorAll('.viewfinder-desc');
    allDescElements.forEach(el => el.classList.add('loading-tilt'));

    try {
        const prompt = `Rewrite the following video scene descriptions to have a more "${tone}" and cinematic tone. Focus on evocative language that matches the requested tone. Provide the output as a JSON object with 'subject', 'setting', and 'environment' keys.

Original Subject: ${currentSceneData.subject}
Original Setting: ${currentSceneData.setting}
Original Environment: ${currentSceneData.environment}
`;
        const response = await ai.models.generateContent({
            model: chatModel, // Use fast model for interactive edits
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: tiltedDescriptionsSchema,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Error generating ${tone} descriptions:`, error);
        showNotification(`Error: Could not generate ${tone} descriptions.`);
        return null; // Return null on error
    } finally {
        allDescElements.forEach(el => el.classList.remove('loading-tilt'));
    }
}

/** Updates the text content of the viewfinder elements with new descriptions */
function updateTiltDescriptions(descriptions: any) {
    if (!descriptions) return;
    
    const elements = document.querySelectorAll('.viewfinder-element');
    elements.forEach(el => {
        const element = el as HTMLElement;
        const title = element.dataset.title?.toLowerCase();
        const descEl = element.querySelector('.viewfinder-desc') as HTMLElement;
        
        if (!descEl) return;
        
        if (title === 'subject' && descriptions.subject) {
            descEl.textContent = descriptions.subject;
        } else if (title === 'setting' && descriptions.setting) {
            descEl.textContent = descriptions.setting;
        } else if (title === 'environment' && descriptions.environment) {
            descEl.textContent = descriptions.environment;
        } else if (title === 'antagonist') {
            // Antagonist is not tilted, reset to original if needed
            descEl.textContent = currentSceneData.antagonists;
        }
    });
}


// 5. Core logic functions

/** Handles the prompt generation from text */
async function handleGeneratePrompt() {
    const basicPrompt = promptInput.value.trim();
    const negativePrompt = negativePromptInput.value.trim();

    if (!basicPrompt) {
        alert('Please enter a video idea first.');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
    resultsContainer.innerHTML = '<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Generating your enhanced prompt...</div>';
    if (viewfinderDisplay && viewfinderControls) {
        viewfinderDisplay.innerHTML = '<div class="placeholder">Generate an enhanced prompt to activate the viewfinder.</div>';
        viewfinderControls.style.display = 'none';
    }
    if (catalystsContainer) {
        catalystsContainer.innerHTML = '<div class="placeholder">Generate an enhanced prompt to see dynamic suggestions.</div>';
        catalystsContainer.classList.add('placeholder');
    }
    generateVideoBtn.disabled = true;
    currentEnhancedPrompt = null;

    const systemInstruction = "You are an expert AI Video Prompt Engineer. Your task is to expand a simple user idea into a comprehensive, detailed, and structured JSON prompt for a text-to-video AI model like Google Veo. If a style preset is provided, ensure the 'meta.style' field in the JSON reflects this style and that other fields (like lighting, color_grading, cinematography, etc.) are influenced by it to create a cohesive result. Break down the user's prompt into a rich scene description, including meta data, scene details, cinematography, lighting, and technical specifications. Crucially, for the 'cinematography' section, you must use specific and professional cinematic terms. For 'shot_sequence', provide an array of objects, each defining a 'shot_type' (e.g., 'Establishing Shot', 'Wide Shot', 'Close-up', 'Low-Angle Shot') and a 'description' of what happens in that shot. For 'camera_movement', suggest techniques like 'crane shot', 'dolly zoom', 'whip pan', 'tracking shot', or 'handheld shaky effect' to match the mood and action of the scene. If the user provides exclusion criteria, populate the `meta.negative_prompt` field with a summary of these exclusions and ensure the rest of the generated prompt avoids these concepts. If no exclusions are given, set `meta.negative_prompt` to \"none\". Follow the provided JSON schema precisely. Ensure the output is only the raw JSON object, without any markdown formatting or explanations.";
    
    let finalPrompt = `User idea: "${basicPrompt}"`;
    if (selectedStylePreset) {
        finalPrompt = `Apply the following style preset: "${selectedStylePreset}".\n\n${finalPrompt}`;
    }
    if (negativePrompt) {
        finalPrompt += `\n\nExclusion Criteria (things to avoid): "${negativePrompt}"`;
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

/** Summarizes the current prompt to provide context for the chat assistant */
async function summarizePromptForChat(promptData: any): Promise<string> {
    try {
        const prompt = `Summarize the following detailed video prompt JSON into a short paragraph (under 80 words). This summary will be used as context for a chat assistant helping a user refine the prompt. Focus on the core concepts: the subject, setting, style, and key actions or cinematic elements.

JSON Prompt:
${JSON.stringify(promptData, null, 2)}`;

        const response = await ai.models.generateContent({
            model: chatModel, // Use the faster model for summarization
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error('Error summarizing prompt for chat:', error);
        // Fallback to a simpler, structured summary if API fails
        return `A video about "${promptData.scene?.subject}" in a "${promptData.scene?.setting}" setting, with a "${promptData.meta?.style}" style. Key cinematography includes ${promptData.cinematography?.camera_movement}.`;
    }
}

/** Handles sending a chat message */
async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';
    sendChatBtn.disabled = true;

    // Add a thinking indicator
    const thinkingMessageEl = document.createElement('div');
    thinkingMessageEl.className = 'message bot-message thinking';
    thinkingMessageEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    chatMessagesContainer.appendChild(thinkingMessageEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    try {
        let fullContext = `User is asking for help with a video prompt.`;
        if (currentEnhancedPrompt) {
            const promptSummary = await summarizePromptForChat(currentEnhancedPrompt);
            fullContext += `\n\nThey are working with a prompt summarized as: "${promptSummary}"`;
        }
        
        const response = await chat.sendMessage({ message: `${fullContext}\n\nUser's question: "${message}"` });
        
        thinkingMessageEl.remove(); // Remove thinking indicator
        addMessage(response.text, 'bot');

    } catch (error) {
        console.error('Chat error:', error);
        thinkingMessageEl.remove(); // Remove thinking indicator on error too
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


// 6. Scene Catalysts Logic
/** Generates dynamic suggestions for the scene */
async function generateSceneCatalysts(scene: any) {
    if (!scene) {
        if (catalystsContainer) catalystsContainer.innerHTML = '<div class="placeholder">Scene data is missing for suggestions.</div>';
        return;
    }

    try {
        const generationPrompt = `Based on the following video scene, generate a JSON object with creative suggestions for dynamic events. Suggest 2-3 "antagonist_actions" and 2-3 "environmental_events". These should be short, evocative phrases that could be added to the prompt to make it more exciting.

Scene Subject: ${scene.subject}
Scene Setting: ${scene.setting}
Scene Antagonist: ${scene.antagonists || 'None'}
Scene Environment: ${scene.environment}
`;
        const response = await ai.models.generateContent({
            model: chatModel, // fast model is fine for this
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: catalystSchema,
            },
        });
        const catalystData = JSON.parse(response.text);
        displaySceneCatalysts(catalystData);
    } catch (error) {
        console.error('Error generating scene catalysts:', error);
        if (catalystsContainer) {
            catalystsContainer.innerHTML = `<div class="placeholder" style="color: #ff8a80;">Failed to generate suggestions.</div>`;
        }
    }
}

/** Displays the generated scene catalysts in the UI */
function displaySceneCatalysts(catalystData: any) {
    if (!catalystsContainer) return;
    catalystsContainer.innerHTML = '';
    catalystsContainer.classList.remove('placeholder');

    const grid = document.createElement('div');
    grid.className = 'catalysts-grid';

    const antagonistCol = document.createElement('div');
    antagonistCol.className = 'catalyst-column';
    antagonistCol.innerHTML = `<h3><i class="fas fa-skull-crossbones"></i> Antagonist Actions</h3>`;

    const environmentCol = document.createElement('div');
    environmentCol.className = 'catalyst-column';
    environmentCol.innerHTML = `<h3><i class="fas fa-wind"></i> Environmental Events</h3>`;

    catalystData.antagonist_actions?.forEach((action: string) => {
        const btn = document.createElement('button');
        btn.className = 'catalyst-btn';
        btn.textContent = action;
        btn.onclick = () => applyCatalyst(action);
        antagonistCol.appendChild(btn);
    });

    catalystData.environmental_events?.forEach((event: string) => {
        const btn = document.createElement('button');
        btn.className = 'catalyst-btn';
        btn.textContent = event;
        btn.onclick = () => applyCatalyst(event);
        environmentCol.appendChild(btn);
    });
    
    if (antagonistCol.childElementCount <= 1) { // h3 is one child
         antagonistCol.innerHTML += '<p class="no-catalyst">No specific antagonist actions suggested.</p>';
    }
    if (environmentCol.childElementCount <= 1) {
         environmentCol.innerHTML += '<p class="no-catalyst">No specific environmental events suggested.</p>';
    }

    grid.appendChild(antagonistCol);
    grid.appendChild(environmentCol);
    catalystsContainer.appendChild(grid);
}

/** Adds a catalyst suggestion to the main prompt input */
function applyCatalyst(text: string) {
    const currentPrompt = promptInput.value.trim();
    // Appends the suggestion, adding a comma if there's existing text.
    promptInput.value = currentPrompt ? `${currentPrompt}, ${text}` : text;
    promptInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification('Suggestion added to your prompt!');
}

// 7. Negative Prompt Analysis Logic

/** Analyzes the negative prompt for improvements */
async function analyzeNegativePrompt() {
    const mainPrompt = promptInput.value.trim();
    const negativePrompt = negativePromptInput.value.trim();

    if (!negativePrompt) {
        showNotification("Please enter something in the exclusion criteria to analyze.");
        return;
    }
     if (!mainPrompt) {
        showNotification("Please provide a main prompt for context before analyzing exclusions.");
        return;
    }

    if (!negativePromptFeedback) return;

    analyzeNegativeBtn.disabled = true;
    analyzeNegativeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    negativePromptFeedback.style.display = 'block';
    negativePromptFeedback.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Analyzing...</div>`;

    try {
        const generationPrompt = `You are an expert AI Video Prompt Engineer. Analyze the provided main prompt and its corresponding negative prompt (exclusion criteria). Your goal is to refine the negative prompt for better results from a text-to-video model.

        1.  **Identify Weak Terms:** Find vague terms like "bad," "ugly," "low quality" and suggest specific, descriptive alternatives. For example, instead of "bad anatomy," suggest "deformed hands, extra limbs, distorted facial features."
        2.  **Check for Contradictions:** Ensure the negative prompt doesn't accidentally contradict the main prompt's intent.
        3.  **Anticipate Issues:** Based on the main prompt, suggest common AI artifacts to exclude. For example, if the main prompt asks for "a person walking," the negative prompt could include "unnatural gait, sliding feet."
        4.  **Consolidate and Clarify:** Combine related ideas and make the prompt clear and concise.

        Return your analysis in a structured JSON format with two keys: "feedback" (a brief paragraph explaining your reasoning and suggestions) and "suggested_prompt" (the complete, improved negative prompt string).

        **Main Prompt:** "${mainPrompt}"
        **Current Negative Prompt:** "${negativePrompt}"`;
        
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: negativePromptAnalysisSchema,
            },
        });

        const analysisData = JSON.parse(response.text);
        displayNegativePromptFeedback(analysisData);

    } catch (error) {
        console.error("Error analyzing negative prompt:", error);
        negativePromptFeedback.innerHTML = `<div class="placeholder" style="color: #ff8a80;">Failed to analyze. Please try again.</div>`;
    } finally {
        analyzeNegativeBtn.disabled = false;
        analyzeNegativeBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Analyze';
    }
}

/** Displays the feedback from the negative prompt analysis */
function displayNegativePromptFeedback(data: { feedback: string, suggested_prompt: string }) {
    if (!negativePromptFeedback) return;
    negativePromptFeedback.innerHTML = '';
    negativePromptFeedback.style.display = 'block';

    const feedbackParagraph = document.createElement('p');
    feedbackParagraph.innerHTML = `<strong>Analysis:</strong> ${data.feedback}`;

    const suggestionHeader = document.createElement('h4');
    suggestionHeader.textContent = 'Suggested Improvement:';
    suggestionHeader.style.marginTop = '10px';
    suggestionHeader.style.marginBottom = '5px';

    const suggestedPromptText = document.createElement('p');
    suggestedPromptText.className = 'suggested-prompt-text';
    suggestedPromptText.textContent = data.suggested_prompt;

    const useBtn = document.createElement('button');
    useBtn.className = 'action-btn';
    useBtn.innerHTML = `<i class="fas fa-check"></i> Use Suggestion`;
    useBtn.onclick = () => {
        negativePromptInput.value = data.suggested_prompt;
        showNotification('Suggested prompt applied!');
    };
    
    negativePromptFeedback.appendChild(feedbackParagraph);
    negativePromptFeedback.appendChild(suggestionHeader);
    negativePromptFeedback.appendChild(suggestedPromptText);
    negativePromptFeedback.appendChild(useBtn);
}


// 8. Saved Prompts Logic

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


// 9. Event listeners & Initialization
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
    analyzeNegativeBtn.addEventListener('click', analyzeNegativePrompt);

    // NEW: Viewfinder control listeners
    zoomSlider.addEventListener('input', applyZoom);
    panSlider.addEventListener('input', applyPan);
    tiltSlider.addEventListener('change', handleTilt); // Use 'change' to avoid too many API calls


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
        const card = target.closest('.style-preset-card');
        if (card) {
            const button = card.querySelector('.style-preset-btn');
            if (!button) return;

            const style = button.getAttribute('data-style');
            const currentActive = stylePresetsContainer.querySelector('.style-preset-card.active');
            
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            
            if (selectedStylePreset === style) {
                // If clicking the active one, deactivate it
                selectedStylePreset = null;
            } else {
                // Activate the new one
                card.classList.add('active');
                selectedStylePreset = style;
            }
        }
    });

    // Initial render of saved prompts
    renderSavedPrompts();
}

init();