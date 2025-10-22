

import { GoogleGenAI, Chat, Type, Modality } from "@google/genai";

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

// Viewfinder selectors
const viewfinderDisplay = document.getElementById('viewfinder-display');
const viewfinderControls = document.getElementById('viewfinder-controls');
const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
const panSlider = document.getElementById('pan-slider') as HTMLInputElement;
const tiltSlider = document.getElementById('tilt-slider') as HTMLInputElement;
const apertureSlider = document.getElementById('aperture-slider') as HTMLInputElement;
const shutterSpeedSlider = document.getElementById('shutter-speed-slider') as HTMLInputElement;
const whiteBalanceSlider = document.getElementById('white-balance-slider') as HTMLInputElement;
const tiltSuggestionsContainer = document.getElementById('tilt-suggestions-container');


// Scene Catalysts selector
const catalystsContainer = document.getElementById('catalysts-content');

// Negative Prompt Analysis selectors
const analyzeNegativeBtn = document.getElementById('analyze-negative-btn') as HTMLButtonElement;
const negativePromptFeedback = document.getElementById('negative-prompt-feedback');

// Sound Effects selectors
const sfxPresetsContainer = document.getElementById('sfx-presets');
const sfxCustomInput = document.getElementById('sfx-custom-input') as HTMLInputElement;
const sfxAddBtn = document.getElementById('sfx-add-btn') as HTMLButtonElement;
const sfxListContainer = document.getElementById('sfx-list-container');

// Frame Generation selectors
const generateFirstFrameBtn = document.getElementById('generate-first-frame-btn') as HTMLButtonElement;
const generateLastFrameBtn = document.getElementById('generate-last-frame-btn') as HTMLButtonElement;
const firstFramePrompt = document.getElementById('first-frame-prompt') as HTMLTextAreaElement;
const lastFramePrompt = document.getElementById('last-frame-prompt') as HTMLTextAreaElement;
const firstFramePreviewContainer = document.getElementById('first-frame-preview-container');
const lastFramePreviewContainer = document.getElementById('last-frame-preview-container');
const useSubjectFirstBtn = document.getElementById('use-subject-first') as HTMLButtonElement;
const useSubjectLastBtn = document.getElementById('use-subject-last') as HTMLButtonElement;


// 3. State variables
let chat: Chat;
let currentEnhancedPrompt: any | null = null;
let uploadedImageBase64: { mimeType: string, data: string } | null = null;
let selectedStylePreset: string | null = null;
let styleDescriptionsCache: any | null = null;
let addedSoundEffects: string[] = [];
const SAVED_PROMPTS_KEY = 'ai-video-prompts';
let firstFrameBase64: string | null = null;
let lastFrameBase64: string | null = null;

// Viewfinder state
let currentSceneData: any | null = null;
let tiltedVisualsCache: { gritty: any | null, epic: any | null } = {
    gritty: null,
    epic: null,
};

// Audio state
let outputAudioContext: AudioContext | null = null;
let currentlyPlayingSource: AudioBufferSourceNode | null = null;

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
                type: { type: Type.STRING, description: 'Primary type of lighting (e.g., "Natural sunlight", "Studio lighting", "Neon glow").' },
                quality: { type: Type.STRING, description: 'Quality of the light (e.g., "Hard shadows, high contrast", "Soft diffused light").' },
                color_temperature: { type: Type.STRING, description: 'Color tones of the light (e.g., "Warm golden hour", "Cool blue tones").' },
                key_light_source: { type: Type.STRING, description: 'The direction and nature of the main light source (e.g., "Top-down moonlight", "Side-lit from a window").' },
                fill_light_intensity: { type: Type.STRING, description: 'The intensity of the fill light, which softens shadows (e.g., "Low", "Medium", "None").' },
                backlight_effect: { type: Type.STRING, description: 'The effect of the backlight, which separates the subject from the background (e.g., "Rim lighting for a halo effect", "Silhouette", "None").' },
                special_effects: { type: Type.STRING, description: 'Any other special lighting effects (e.g., "Lens flare", "God rays", "Flickering lights"). Can be "None".' },
            },
            required: ['type', 'quality', 'color_temperature', 'key_light_source', 'fill_light_intensity', 'backlight_effect'],
        },
        sound_design: {
            type: Type.OBJECT,
            description: 'Details about the audio and sound effects for the scene.',
            properties: {
                key_effects: {
                    type: Type.ARRAY,
                    description: 'A list of 2-5 key sound effects to be included in the video. Can be specific sounds or musical cues.',
                    items: { type: Type.STRING },
                },
                music: {
                    type: Type.STRING,
                    description: 'A brief description of the background music style (e.g., "Epic orchestral score", "Driving synthwave track", "Lo-fi beats"). Can be "None".'
                }
            }
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

const imageAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        analysis: {
            type: Type.OBJECT,
            description: "A detailed analysis of the image content.",
            properties: {
                overall_description: { type: Type.STRING, description: "A rich, detailed paragraph describing the entire scene, including mood, atmosphere, and potential narrative." },
                dominant_colors: {
                    type: Type.ARRAY,
                    description: "An array of 3-5 dominant or significant colors found in the image, described evocatively (e.g., 'Midnight Blue', 'Fiery Orange').",
                    items: { type: Type.STRING }
                },
                identified_objects: {
                    type: Type.ARRAY,
                    description: "A list of key objects, characters, or elements identified in the image.",
                    items: { type: Type.STRING }
                },
                composition_style: { type: Type.STRING, description: "A brief description of the image's composition or photographic style (e.g., 'Rule of thirds, shallow depth of field', 'Symmetrical, leading lines')." }
            },
            required: ["overall_description", "dominant_colors", "identified_objects"]
        },
        prompt_suggestions: {
            type: Type.ARRAY,
            description: "An array of 3 distinct video prompt ideas based on the detailed analysis.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "A short, creative title for the prompt idea." },
                    prompt: { type: Type.STRING, description: "The descriptive video prompt text, incorporating details from the analysis." }
                },
                required: ["title", "prompt"]
            }
        }
    },
    required: ["analysis", "prompt_suggestions"]
};

const tiltedVisualsSchema = {
    type: Type.OBJECT,
    properties: {
        descriptions: {
            type: Type.OBJECT,
            properties: {
                subject: { type: Type.STRING, description: "The rewritten subject description." },
                setting: { type: Type.STRING, description: "The rewritten setting description." },
                environment: { type: Type.STRING, description: "The rewritten environment description." },
            },
            required: ["subject", "setting", "environment"]
        },
        visual_suggestions: {
            type: Type.ARRAY,
            description: "An array of 2-3 subtle visual suggestions (e.g., lighting, VFX) that match the tone.",
            items: {
                type: Type.OBJECT,
                properties: {
                    effect: { type: Type.STRING, description: "A short name for the effect (e.g., 'Lens Flare', 'Atmospheric Haze')." },
                    description: { type: Type.STRING, description: "A brief description of how to apply the effect to enhance the mood." }
                },
                required: ["effect", "description"]
            }
        }
    },
    required: ["descriptions", "visual_suggestions"]
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

const styleVisualsSchema = {
    type: Type.OBJECT,
    properties: {
        cinematic: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING, description: "A one-sentence summary of the style's feeling." },
                key_elements: { type: Type.STRING, description: "A comma-separated list of 3-4 key visual trademarks (e.g., 'Dramatic lighting, film grain, shallow depth of field')." }
            },
            required: ["description", "key_elements"]
        },
        anime: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING, description: "A one-sentence summary of the style's feeling." },
                key_elements: { type: Type.STRING, description: "A comma-separated list of 3-4 key visual trademarks." }
            },
            required: ["description", "key_elements"]
        },
        photorealistic: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING, description: "A one-sentence summary of the style's feeling." },
                key_elements: { type: Type.STRING, description: "A comma-separated list of 3-4 key visual trademarks." }
            },
            required: ["description", "key_elements"]
        },
        abstract: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING, description: "A one-sentence summary of the style's feeling." },
                key_elements: { type: Type.STRING, description: "A comma-separated list of 3-4 key visual trademarks." }
            },
            required: ["description", "key_elements"]
        }
    },
    required: ["cinematic", "anime", "photorealistic", "abstract"]
};


// 4. Helper functions

/**
 * Decodes a base64 string into a Uint8Array.
 */
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 */
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


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
    
    const messageContent = document.createElement('span');
    messageContent.textContent = text;
    messageEl.appendChild(messageContent);

    if (sender === 'bot') {
        const speakBtn = document.createElement('button');
        speakBtn.className = 'action-btn speak-btn';
        speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        speakBtn.setAttribute('aria-label', 'Play audio for this message');
        speakBtn.title = 'Hear this message';
        speakBtn.onclick = () => speakText(text, speakBtn);
        messageEl.appendChild(speakBtn);
    }

    chatMessagesContainer.appendChild(messageEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

/**
 * Updates a value in the current enhanced prompt object and refreshes the JSON display.
 * @param path A dot-notation string for the property path (e.g., "lighting.color_temperature").
 * @param value The new value to set.
 */
function updatePromptAndRefreshJSON(path: string, value: any) {
    if (!currentEnhancedPrompt) return;

    // Use a simple loop to navigate the path and set the value
    const keys = path.split('.');
    let current: any = currentEnhancedPrompt;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) { // Create path if it doesn't exist
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    // Re-render the JSON in the results card to show the live update
    const jsonContent = resultsContainer.querySelector('.prompt-content');
    if (jsonContent) {
        jsonContent.textContent = JSON.stringify(currentEnhancedPrompt, null, 2);
    }
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

    // --- Sound Effects Section ---
    const sfxContainer = document.createElement('div');
    sfxContainer.className = 'sound-effects-container';
    if (promptData.sound_design?.key_effects?.length > 0) {
        const strong = document.createElement('strong');
        strong.innerHTML = '<i class="fas fa-volume-up"></i> Sound Design:';
        sfxContainer.appendChild(strong);
        promptData.sound_design.key_effects.forEach((sfx: string) => {
            const sfxEl = document.createElement('span');
            sfxEl.className = 'sound-effect-tag';
            sfxEl.textContent = sfx;
            sfxContainer.appendChild(sfxEl);
        });
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
    if (sfxContainer.hasChildNodes()) {
        promptCard.appendChild(sfxContainer);
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

    // Enable 'Use Subject' buttons for frame generation
    useSubjectFirstBtn.disabled = !promptData.scene?.subject;
    useSubjectLastBtn.disabled = !promptData.scene?.subject;


    // --- Trigger catalyst generation ---
    if (catalystsContainer) {
        catalystsContainer.innerHTML = `
            <div class="catalyst-loader">
                <div class="spinner"></div>
                <span>Brewing up creative sparks...</span>
            </div>
        `;
        catalystsContainer.classList.remove('placeholder');
        generateSceneCatalysts(promptData.scene);
    }
}

/** Generates a color from a string for the color chips */
function stringToHslColor(str: string, s = 60, l = 70) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Displays the detailed image analysis results */
function displayImageAnalysisResults(analysisData: any) {
    resultsContainer.innerHTML = ''; // Clear previous results

    // Main container card
    const analysisCard = document.createElement('div');
    analysisCard.className = 'image-analysis-card';

    // --- Analysis Section ---
    const analysisSection = document.createElement('div');
    analysisSection.className = 'analysis-section';

    const analysisHeader = document.createElement('h3');
    analysisHeader.innerHTML = `<i class="fas fa-search"></i> Image Analysis`;
    analysisSection.appendChild(analysisHeader);

    // Description
    const description = document.createElement('p');
    description.className = 'analysis-description';
    description.textContent = analysisData.analysis.overall_description;
    analysisSection.appendChild(description);

    // Details Grid (Colors, Objects, Style)
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'analysis-details-grid';

    // Identified Objects
    if (analysisData.analysis.identified_objects?.length > 0) {
        const objectsContainer = document.createElement('div');
        objectsContainer.innerHTML = `<strong>Identified Elements:</strong>`;
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container analysis-tags';
        analysisData.analysis.identified_objects.forEach((obj: string) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = obj;
            tagsContainer.appendChild(tagEl);
        });
        objectsContainer.appendChild(tagsContainer);
        detailsGrid.appendChild(objectsContainer);
    }
    
    // Dominant Colors
    if (analysisData.analysis.dominant_colors?.length > 0) {
        const colorsContainer = document.createElement('div');
        colorsContainer.innerHTML = `<strong>Dominant Colors:</strong>`;
        const paletteContainer = document.createElement('div');
        paletteContainer.className = 'color-palette';
        analysisData.analysis.dominant_colors.forEach((colorName: string) => {
             const colorEl = document.createElement('span');
             colorEl.className = 'color-chip';
             colorEl.style.backgroundColor = stringToHslColor(colorName);
             colorEl.textContent = colorName;
             paletteContainer.appendChild(colorEl);
        });
        colorsContainer.appendChild(paletteContainer);
        detailsGrid.appendChild(colorsContainer);
    }

    // Composition Style
    if (analysisData.analysis.composition_style) {
        const compositionContainer = document.createElement('div');
        compositionContainer.innerHTML = `<strong>Composition:</strong> <p>${analysisData.analysis.composition_style}</p>`;
        detailsGrid.appendChild(compositionContainer);
    }

    analysisSection.appendChild(detailsGrid);
    analysisCard.appendChild(analysisSection);

    // --- Prompt Suggestions Section ---
    const promptsSection = document.createElement('div');
    promptsSection.className = 'prompt-suggestions-section';

    const promptsHeader = document.createElement('h3');
    promptsHeader.innerHTML = `<i class="fas fa-lightbulb"></i> Prompt Suggestions`;
    promptsSection.appendChild(promptsHeader);

    analysisData.prompt_suggestions.forEach((p: {title: string, prompt: string}) => {
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
        promptsSection.appendChild(card);
    });

    analysisCard.appendChild(promptsSection);
    resultsContainer.appendChild(analysisCard);
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
    tiltedVisualsCache = { gritty: null, epic: null };

    // Reset sliders to default positions
    zoomSlider.value = '100';
    panSlider.value = '0';
    tiltSlider.value = '0';
    apertureSlider.value = '3';
    shutterSpeedSlider.value = '3';
    whiteBalanceSlider.value = '5500';

    
    viewfinderDisplay.innerHTML = ''; // Clear previous content
    if (tiltSuggestionsContainer) tiltSuggestionsContainer.innerHTML = '';
    viewfinderControls.style.display = 'grid'; // Show controls

    const grid = document.createElement('div');
    grid.className = 'viewfinder-grid';
    grid.id = 'viewfinder-grid'; // Add id for easy selection
    
    const elements: { title: string, desc: string }[] = [];
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
        sceneElement.className = 'viewfinder-element';
        sceneElement.dataset.title = el.title; // For tilting
        sceneElement.innerHTML = `
            <div class="viewfinder-icon"><i class="fas ${iconClass}"></i></div>
            <div class="viewfinder-title">${el.title}</div>
            <div class="viewfinder-desc">${el.desc}</div>
        `;
        grid.appendChild(sceneElement);
    });

    viewfinderDisplay.appendChild(grid);
    applyViewfinderTransforms(); // Apply initial transforms
}

/** Applies all viewfinder transformations (zoom, pan, tilt) based on sliders */
function applyViewfinderTransforms() {
    const grid = document.getElementById('viewfinder-grid');
    if (!grid) return;

    const zoom = parseFloat(zoomSlider.value) / 100; // e.g., 100 -> 1.0
    const pan = parseInt(panSlider.value, 10); // in %
    const tilt = parseInt(tiltSlider.value, 10); // in degrees

    grid.style.transform = `translateX(${pan}%) scale(${zoom}) rotateX(${tilt}deg)`;
}

/** Handles tilt angle content changes based on AI */
async function handleTiltContentUpdate() {
    if (!currentSceneData) return;
    const angleValue = parseInt(tiltSlider.value, 10);

    let tone: 'gritty' | 'epic' | null = null;
    
    if (angleValue <= -20) tone = 'gritty';
    else if (angleValue >= 20) tone = 'epic';

    // Return to neutral state
    if (!tone) {
        const originalDescriptions = {
            subject: currentSceneData.subject,
            setting: currentSceneData.setting,
            environment: currentSceneData.environment,
        };
        updateViewfinderDescriptions(originalDescriptions);
        displayTiltSuggestions([]); // Clear suggestions
        return;
    }

    // Fetch or use cached data for the selected tone
    let newVisuals: any = null;
    if (tiltedVisualsCache[tone]) {
        newVisuals = tiltedVisualsCache[tone];
    } else {
        newVisuals = await generateTiltedVisuals(tone);
        if (newVisuals) tiltedVisualsCache[tone] = newVisuals;
    }
    
    if (newVisuals) {
        updateViewfinderDescriptions(newVisuals.descriptions);
        displayTiltSuggestions(newVisuals.visual_suggestions);
    } else {
         // Handle error case by resetting to original
        const originalDescriptions = {
            subject: currentSceneData.subject,
            setting: currentSceneData.setting,
            environment: currentSceneData.environment,
        };
        updateViewfinderDescriptions(originalDescriptions);
        displayTiltSuggestions([]);
    }
}

/** Fetches new descriptions and visual suggestions from AI based on tone */
async function generateTiltedVisuals(tone: 'gritty' | 'epic'): Promise<any> {
    const allDescElements = document.querySelectorAll('.viewfinder-desc');
    allDescElements.forEach(el => el.classList.add('loading-tilt'));
    if (tiltSuggestionsContainer) tiltSuggestionsContainer.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i></div>`;

    try {
        const prompt = `Rewrite the following video scene descriptions to have a more "${tone}" and cinematic tone. Focus on evocative language. Additionally, suggest 2-3 subtle visual effects (like lighting changes or atmospheric effects) that would enhance this tone. Provide the output as a JSON object with a 'descriptions' object (containing 'subject', 'setting', 'environment' keys) and a 'visual_suggestions' array.

Original Subject: ${currentSceneData.subject}
Original Setting: ${currentSceneData.setting}
Original Environment: ${currentSceneData.environment}
`;
        const response = await ai.models.generateContent({
            model: chatModel, // Use fast model for interactive edits
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: tiltedVisualsSchema,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error(`Error generating ${tone} visuals:`, error);
        showNotification(`Error: Could not generate ${tone} effects.`);
        return null; // Return null on error
    } finally {
        allDescElements.forEach(el => el.classList.remove('loading-tilt'));
        if (tiltSuggestionsContainer && tiltSuggestionsContainer.querySelector('.placeholder')) {
            tiltSuggestionsContainer.innerHTML = '';
        }
    }
}

/** Updates the text content of the viewfinder elements with new descriptions */
function updateViewfinderDescriptions(descriptions: any) {
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

/** Displays the visual suggestions from the tilt effect */
function displayTiltSuggestions(suggestions: any[]) {
    if (!tiltSuggestionsContainer) return;

    tiltSuggestionsContainer.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'tilt-suggestions-grid';

    suggestions.forEach(suggestion => {
        const card = document.createElement('div');
        card.className = 'tilt-suggestion-card';

        const effectName = document.createElement('strong');
        effectName.textContent = suggestion.effect;
        
        const effectDesc = document.createElement('p');
        effectDesc.textContent = suggestion.description;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'action-btn';
        applyBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Apply`;
        applyBtn.onclick = () => applyTiltSuggestion(suggestion);

        card.appendChild(effectName);
        card.appendChild(effectDesc);
        card.appendChild(applyBtn);
        grid.appendChild(card);
    });

    tiltSuggestionsContainer.appendChild(grid);
}

/** Applies a visual suggestion to the main enhanced prompt */
function applyTiltSuggestion(suggestion: { effect: string, description: string }) {
    if (!currentEnhancedPrompt) {
        showNotification("Error: No active prompt to apply suggestion to.");
        return;
    }
    const suggestionText = `${suggestion.effect}: ${suggestion.description}`;
    
    const currentVfx = currentEnhancedPrompt.vfx_elements || [];
    
    if (currentVfx.includes(suggestionText)) {
        showNotification("Suggestion already applied!");
        return;
    }
    
    const newVfx = [...currentVfx, suggestionText];
    
    updatePromptAndRefreshJSON('vfx_elements', newVfx);
    
    showNotification(`Applied: ${suggestion.effect}`);
}


/** Generates and displays example prompts for each style preset */
async function generateAndDisplayExamplePrompts() {
    const visualContainers: { [key: string]: HTMLElement | null } = {
        cinematic: document.getElementById('style-visual-cinematic'),
        anime: document.getElementById('style-visual-anime'),
        photorealistic: document.getElementById('style-visual-photorealistic'),
        abstract: document.getElementById('style-visual-abstract'),
    };

    // Add placeholders
    Object.values(visualContainers).forEach(container => {
        if (container) {
            container.innerHTML = `<div class="placeholder-text"><i class="fas fa-spinner fa-spin"></i></div>`;
        }
    });

    try {
        const prompt = `For each of the following video styles (cinematic, anime, photorealistic, abstract), provide a detailed JSON object. Each object must contain a 'description' (a short, evocative, one-sentence summary of the style's feeling) and 'key_elements' (a comma-separated string of 3-4 defining visual characteristics, like lighting, texture, or composition styles).`;

        const response = await ai.models.generateContent({
            model: chatModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: styleVisualsSchema,
            },
        });

        const descriptions = JSON.parse(response.text);
        styleDescriptionsCache = descriptions; // Cache the results

        Object.keys(descriptions).forEach(style => {
            const container = visualContainers[style as keyof typeof visualContainers];
            const data = descriptions[style as keyof typeof descriptions];
            if (container && data) {
                container.innerHTML = `
                    <div class="style-visual-description">${data.description}</div>
                    <div class="style-visual-key-elements"><strong>Key Elements:</strong> ${data.key_elements}</div>
                `;
            }
        });

    } catch (error) {
        console.error("Error generating style visuals:", error);
        Object.values(visualContainers).forEach(container => {
            if (container) {
                container.innerHTML = `<div class="placeholder-text error" style="font-size: 0.8em; color: #ff8a80;"><i class="fas fa-exclamation-triangle"></i> Failed to load</div>`;
            }
        });
    }
}

/** Generates dynamic scene catalysts based on the current prompt */
async function generateSceneCatalysts(scene: any) {
    if (!scene || !catalystsContainer) return;

    try {
        const prompt = `Based on the following video scene, generate 2-3 dynamic "antagonist actions" and 2-3 "environmental events" that could unexpectedly happen to increase excitement and tension. Keep each suggestion as a short, punchy, actionable phrase.

Subject: ${scene.subject}
Setting: ${scene.setting}
Antagonist: ${scene.antagonists || 'None'}
Environment: ${scene.environment}
`;
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: catalystSchema,
            },
        });
        const catalysts = JSON.parse(response.text);
        displaySceneCatalysts(catalysts);
    } catch (error) {
        console.error("Error generating scene catalysts:", error);
        catalystsContainer.innerHTML = '<div class="placeholder" style="color: #ff8a80;">Failed to generate suggestions.</div>';
    }
}

/** Displays the generated scene catalysts in the UI */
function displaySceneCatalysts(catalysts: { antagonist_actions: string[], environmental_events: string[] }) {
    if (!catalystsContainer) return;
    catalystsContainer.innerHTML = '';
    catalystsContainer.classList.remove('placeholder');

    const grid = document.createElement('div');
    grid.className = 'catalysts-grid';

    // Antagonist Actions Column
    const antagonistCol = document.createElement('div');
    antagonistCol.className = 'catalyst-column';
    antagonistCol.innerHTML = `<h3><i class="fas fa-user-secret"></i> Antagonist Actions</h3>`;
    catalysts.antagonist_actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'catalyst-btn';
        btn.textContent = action;
        btn.onclick = () => applyCatalyst(action, 'antagonist');
        antagonistCol.appendChild(btn);
    });

    // Environmental Events Column
    const environmentCol = document.createElement('div');
    environmentCol.className = 'catalyst-column';
    environmentCol.innerHTML = `<h3><i class="fas fa-wind"></i> Environmental Events</h3>`;
    catalysts.environmental_events.forEach(event => {
        const btn = document.createElement('button');
        btn.className = 'catalyst-btn';
        btn.textContent = event;
        btn.onclick = () => applyCatalyst(event, 'environment');
        environmentCol.appendChild(btn);
    });

    grid.appendChild(antagonistCol);
    grid.appendChild(environmentCol);
    catalystsContainer.appendChild(grid);
}

/** Applies a catalyst to the main prompt */
function applyCatalyst(text: string, type: 'antagonist' | 'environment') {
    const currentPrompt = promptInput.value;
    const addition = type === 'antagonist' ? `The antagonist ${text}.` : `Suddenly, ${text}.`;
    promptInput.value = `${currentPrompt.trim()} ${addition}`;
    promptInput.focus();
    showNotification(`Added catalyst: "${text}"`);
}

/** Analyzes the negative prompt for effectiveness */
async function generateNegativePromptAnalysis() {
    const prompt = negativePromptInput.value;
    if (!prompt.trim()) {
        showNotification("Negative prompt is empty.");
        return;
    }

    negativePromptFeedback.style.display = 'block';
    negativePromptFeedback.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Analyzing...</div>`;
    
    try {
        const analysisPrompt = `Analyze the following negative prompt for an AI video generator. Provide constructive feedback on its quality and suggest a revised, more effective version. Focus on conciseness, avoiding contradictions, and using standard keywords.

Negative Prompt: "${prompt}"`;

        const response = await ai.models.generateContent({
            model: chatModel,
            contents: analysisPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: negativePromptAnalysisSchema,
            },
        });

        const analysis = JSON.parse(response.text);
        displayNegativePromptAnalysis(analysis);
    } catch (error) {
        console.error("Error analyzing negative prompt:", error);
        negativePromptFeedback.innerHTML = `<div class="placeholder" style="color: #ff8a80;">Analysis failed.</div>`;
    }
}

/** Displays the negative prompt analysis */
function displayNegativePromptAnalysis(analysis: { feedback: string, suggested_prompt: string }) {
    negativePromptFeedback.innerHTML = `
        <p>${analysis.feedback}</p>
        <p><strong>Suggestion:</strong> <span class="suggested-prompt-text">"${analysis.suggested_prompt}"</span></p>
        <button class="action-btn" id="apply-suggestion-btn"><i class="fas fa-check"></i> Apply Suggestion</button>
    `;
    document.getElementById('apply-suggestion-btn').onclick = () => {
        negativePromptInput.value = analysis.suggested_prompt;
        negativePromptFeedback.style.display = 'none';
        showNotification("Suggested negative prompt applied!");
    };
}

/** Updates the list of displayed sound effects */
function updateSFXList() {
    sfxListContainer.innerHTML = '';
    addedSoundEffects.forEach((sfx, index) => {
        const item = document.createElement('div');
        item.className = 'sfx-item';
        item.innerHTML = `
            <span>${sfx}</span>
            <button class="sfx-remove-btn" data-index="${index}" title="Remove">&times;</button>
        `;
        sfxListContainer.appendChild(item);
    });

    // Update the main JSON prompt if it exists
    updatePromptAndRefreshJSON('sound_design.key_effects', addedSoundEffects);
}

/** Adds a sound effect to the list */
function addSoundEffect(sfx: string) {
    sfx = sfx.trim();
    if (sfx && !addedSoundEffects.includes(sfx)) {
        addedSoundEffects.push(sfx);
        updateSFXList();
    }
}

/** Removes a sound effect from the list */
function removeSoundEffect(index: number) {
    addedSoundEffects.splice(index, 1);
    updateSFXList();
}

/** Retrieves saved prompts from local storage */
function getSavedPrompts(): any[] {
    const promptsJSON = localStorage.getItem(SAVED_PROMPTS_KEY);
    return promptsJSON ? JSON.parse(promptsJSON) : [];
}

/** Saves prompts to local storage */
function savePrompts(prompts: any[]) {
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts));
}

/** Renders the list of saved prompts */
function renderSavedPrompts() {
    const prompts = getSavedPrompts();
    savedPromptsContainer.innerHTML = '';
    if (prompts.length === 0) {
        savedPromptsContainer.innerHTML = '<div class="placeholder">No saved prompts yet.</div>';
        return;
    }

    prompts.forEach(prompt => {
        const item = document.createElement('div');
        item.className = 'saved-prompt-item';
        item.innerHTML = `
            <div>
                <div class="saved-prompt-title" title="${prompt.title}">${prompt.title}</div>
                <div class="saved-prompt-date">${new Date(prompt.id).toLocaleString()}</div>
            </div>
            <div class="saved-prompt-actions">
                <button class="action-btn" data-id="${prompt.id}" name="load"><i class="fas fa-folder-open"></i> Load</button>
                <button class="action-btn" data-id="${prompt.id}" name="delete"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        savedPromptsContainer.appendChild(item);
    });
}

/** Loads a saved prompt into the results view */
function loadPrompt(id: number) {
    const prompts = getSavedPrompts();
    const promptToLoad = prompts.find(p => p.id === id);
    if (promptToLoad) {
        displayEnhancedPrompt(promptToLoad.data);
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
        showNotification("Prompt loaded successfully!");
    }
}

/** Deletes a saved prompt */
function deletePrompt(id: number) {
    let prompts = getSavedPrompts();
    prompts = prompts.filter(p => p.id !== id);
    savePrompts(prompts);
    renderSavedPrompts();
    showNotification("Prompt deleted.");
}


/** Converts text to speech and plays it */
async function speakText(text: string, buttonElement: HTMLButtonElement) {
    if (currentlyPlayingSource) {
        currentlyPlayingSource.stop();
        currentlyPlayingSource = null;
    }
    const allSpeakBtns = document.querySelectorAll('.speak-btn');
    allSpeakBtns.forEach(btn => btn.classList.remove('playing'));

    buttonElement.classList.add('playing');
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data received.");

        if (!outputAudioContext) {
            outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }

        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.start();

        currentlyPlayingSource = source;
        source.onended = () => {
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '<i class="fas fa-volume-up"></i>';
            if (currentlyPlayingSource === source) {
                currentlyPlayingSource = null;
            }
        };

    } catch (error) {
        console.error("Error generating speech:", error);
        showNotification("Sorry, text-to-speech is unavailable.");
        buttonElement.classList.remove('playing');
        buttonElement.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

/** Handles image file selection */
function handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64String = (e.target.result as string).split(',')[1];
        uploadedImageBase64 = { mimeType: file.type, data: base64String };

        imagePreview.src = e.target.result as string;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        analyzeImageBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

/** Generates a single image frame (first or last) */
async function generateImageFrame(type: 'first' | 'last') {
    const promptEl = type === 'first' ? firstFramePrompt : lastFramePrompt;
    const previewContainer = type === 'first' ? firstFramePreviewContainer : lastFramePreviewContainer;
    const generateBtn = type === 'first' ? generateFirstFrameBtn : generateLastFrameBtn;
    
    const prompt = promptEl.value;
    if (!prompt) {
        showNotification(`Please enter a prompt for the ${type} frame.`);
        return;
    }

    generateBtn.disabled = true;
    previewContainer.innerHTML = `<div class="placeholder-text"><i class="fas fa-spinner fa-spin"></i><p>Generating...</p></div>`;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
            },
        });
        
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        if (type === 'first') {
            firstFrameBase64 = base64ImageBytes;
        } else {
            lastFrameBase64 = base64ImageBytes;
        }

        previewContainer.innerHTML = `<img src="data:image/png;base64,${base64ImageBytes}" alt="${type} frame preview">`;

    } catch (error) {
        console.error(`Error generating ${type} frame:`, error);
        previewContainer.innerHTML = `<div class="placeholder-text error" style="color: #ff8a80;"><i class="fas fa-exclamation-triangle"></i> Failed to generate</div>`;
    } finally {
        generateBtn.disabled = false;
    }
}


// 5. Main logic and event listeners
async function main() {
    const textPrompt = promptInput.value.trim();
    if (!textPrompt) {
        alert('Please enter a prompt.');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing...';
    resultsContainer.innerHTML = '<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Generating your enhanced prompt...</div>';
    if (catalystsContainer) {
        catalystsContainer.innerHTML = `
            <div class="catalyst-loader">
                <div class="spinner"></div>
                <span>Waiting for main prompt...</span>
            </div>
        `;
        catalystsContainer.classList.remove('placeholder');
    }
    
    // Reset viewfinder
    if(viewfinderDisplay) viewfinderDisplay.innerHTML = '<div class="placeholder">Waiting for prompt...</div>';
    if(viewfinderControls) viewfinderControls.style.display = 'none';

    try {
        let generationPrompt = `Create an advanced, professional video generation prompt based on the user's idea. The output must be a valid JSON object adhering to the provided schema. Flesh out every detail, from cinematography to lighting and sound design, to create a rich, actionable prompt.

User's Idea: "${textPrompt}"`;

        if (negativePromptInput.value.trim()) {
            generationPrompt += `\n\nNegative Prompt/Exclusions: "${negativePromptInput.value.trim()}"`;
        } else {
            generationPrompt += `\n\nNegative Prompt/Exclusions: "none"`;
        }

        if (selectedStylePreset) {
            generationPrompt += `\n\nOverall Style: The video must have a strong "${selectedStylePreset}" aesthetic.`;
        }

        if (addedSoundEffects.length > 0) {
            generationPrompt += `\n\nMandatory Sound Effects: Ensure these sound effects are included: ${addedSoundEffects.join(', ')}.`;
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: videoPromptSchema,
            },
        });
        
        const enhancedPrompt = JSON.parse(response.text);
        displayEnhancedPrompt(enhancedPrompt);

    } catch (error) {
        console.error('Error generating prompt:', error);
        resultsContainer.innerHTML = '<div class="placeholder" style="color: #ff8a80;">An error occurred. Please try again.</div>';
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-magic"></i> Enhance Prompt (10X)';
    }
}

async function analyzeImage() {
    if (!uploadedImageBase64) {
        alert('Please upload an image first.');
        return;
    }

    analyzeImageBtn.disabled = true;
    analyzeImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    resultsContainer.innerHTML = '<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Analyzing image, this might take a moment...</div>';

    try {
        const response = await ai.models.generateContent({
            model: chatModel, // Use a multimodal model for image analysis
            contents: {
                parts: [
                    { inlineData: uploadedImageBase64 },
                    { text: "Analyze this image in detail and suggest 3 creative video prompt ideas based on its content. The output must be a valid JSON object." }
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: imageAnalysisSchema,
            },
        });

        const analysisResults = JSON.parse(response.text);
        displayImageAnalysisResults(analysisResults);

    } catch (error) {
        console.error('Error analyzing image:', error);
        resultsContainer.innerHTML = '<div class="placeholder" style="color: #ff8a80;">An error occurred during image analysis. Please try again.</div>';
    } finally {
        analyzeImageBtn.disabled = false;
        analyzeImageBtn.innerHTML = '<i class="fas fa-cogs"></i> Analyze Image';
    }
}


async function startChat() {
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    addMessage(userInput, 'user');
    chatInput.value = '';
    sendChatBtn.disabled = true;

    // Thinking indicator
    const thinkingMessage = document.createElement('div');
    thinkingMessage.className = 'message bot-message thinking';
    thinkingMessage.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i></span>';
    chatMessagesContainer.appendChild(thinkingMessage);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    try {
        let response;
        if (currentEnhancedPrompt) {
            // Provide context if a prompt is available
            const context = `The user is working on a video prompt. Here is the current JSON data for it:\n\n${JSON.stringify(currentEnhancedPrompt, null, 2)}\n\nNow, answer the user's question: "${userInput}"`;
            response = await chat.sendMessage({ message: context });
        } else {
            response = await chat.sendMessage({ message: userInput });
        }

        chatMessagesContainer.removeChild(thinkingMessage); // Remove thinking indicator
        addMessage(response.text, 'bot');
    } catch (error) {
        console.error('Chat error:', error);
        chatMessagesContainer.removeChild(thinkingMessage);
        addMessage('Sorry, I encountered an error. Please try again.', 'bot');
    } finally {
        sendChatBtn.disabled = false;
    }
}


function init() {
    chat = ai.chats.create({ model: chatModel });
    
    // Event listeners
    generateBtn.onclick = main;
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            main();
        }
    });

    imageUploadInput.onchange = handleImageUpload;
    analyzeImageBtn.onclick = analyzeImage;
    
    sendChatBtn.onclick = startChat;
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            startChat();
        }
    });

    // Viewfinder listeners
    zoomSlider.addEventListener('input', applyViewfinderTransforms);
    panSlider.addEventListener('input', applyViewfinderTransforms);
    tiltSlider.addEventListener('input', applyViewfinderTransforms);
    tiltSlider.addEventListener('change', handleTiltContentUpdate); // API call on release

    // Style Preset listeners
    stylePresetsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.style-preset-btn');
        if (!button) return;

        const style = (button as HTMLElement).dataset.style;
        const card = button.closest('.style-preset-card');

        // Toggle selection
        if (card.classList.contains('active')) {
            card.classList.remove('active');
            selectedStylePreset = null;
        } else {
            stylePresetsContainer.querySelectorAll('.style-preset-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedStylePreset = style;
        }
    });

    // Negative Prompt Analysis listener
    analyzeNegativeBtn.onclick = generateNegativePromptAnalysis;

    // SFX listeners
    sfxAddBtn.onclick = () => {
        addSoundEffect(sfxCustomInput.value);
        sfxCustomInput.value = '';
    };
    sfxCustomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addSoundEffect(sfxCustomInput.value);
            sfxCustomInput.value = '';
        }
    });
    sfxListContainer.addEventListener('click', (e) => {
        const target = e.target;
        // FIX: The original code had a TypeScript error because `e.target` is of type `EventTarget`.
        // By checking if it's an `HTMLElement`, we can safely access `dataset`.
        if (target instanceof HTMLElement && target.classList.contains('sfx-remove-btn')) {
            const indexStr = target.dataset.index;
            if (indexStr !== undefined) {
                const index = parseInt(indexStr, 10);
                if (!isNaN(index)) {
                    removeSoundEffect(index);
                }
            }
        }
    });

    // Saved Prompts listeners
    savedPromptsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (button) {
            const id = parseInt(button.dataset.id, 10);
            if (button.name === 'load') {
                loadPrompt(id);
            } else if (button.name === 'delete') {
                if (confirm('Are you sure you want to delete this prompt?')) {
                    deletePrompt(id);
                }
            }
        }
    });
    
    // Frame Generation listeners
    generateFirstFrameBtn.onclick = () => generateImageFrame('first');
    generateLastFrameBtn.onclick = () => generateImageFrame('last');
    useSubjectFirstBtn.onclick = () => {
        if(currentEnhancedPrompt?.scene?.subject) {
            firstFramePrompt.value = currentEnhancedPrompt.scene.subject;
        }
    };
    useSubjectLastBtn.onclick = () => {
        if(currentEnhancedPrompt?.scene?.subject) {
            lastFramePrompt.value = currentEnhancedPrompt.scene.subject;
        }
    };

    // Initial setup
    renderSavedPrompts();
    generateAndDisplayExamplePrompts();
    // Populate SFX presets
    const sfxPresets = ['Tense cinematic music', 'Futuristic synthwave', 'Heavy footsteps on metal', 'Explosion in the distance', 'Rain and thunder', 'Glitched digital sounds'];
    sfxPresets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'sfx-preset-btn';
        btn.textContent = preset;
        btn.onclick = () => addSoundEffect(preset);
        sfxPresetsContainer.appendChild(btn);
    });
}

document.addEventListener('DOMContentLoaded', init);
