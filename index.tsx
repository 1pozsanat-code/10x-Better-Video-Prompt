import { GoogleGenAI, Chat, Type, Modality } from "@google/genai";

// 1. Initialize the Gemini AI Model
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-pro'; // Using a powerful model for complex JSON generation
const chatModel = 'gemini-2.5-flash'; // Using a faster model for chat, summarization, and image analysis

// 2. DOM element selectors
const promptInput = document.getElementById('prompt') as HTMLTextAreaElement;
const narrativeArcToggle = document.getElementById('narrative-arc-toggle') as HTMLInputElement;
const negativePromptInput = document.getElementById('negative-prompt') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container');
const copyNotification = document.getElementById('copy-notification');
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendChatBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
const chatMessagesContainer = document.getElementById('chat-messages');
const generateVideoBtn = document.getElementById('generate-video-btn') as HTMLButtonElement;
const videoPreviewContainer = document.getElementById('video-preview-container');
const stylePresetsContainer = document.getElementById('style-presets');
const savedPromptsContainer = document.getElementById('saved-prompts-container');
const promptHistoryContainer = document.getElementById('prompt-history-container');
const searchSuggestionsContainer = document.getElementById('search-suggestions-container');
const nsfwToggle = document.getElementById('nsfw-toggle') as HTMLInputElement;
const nsfwDisclaimer = document.getElementById('nsfw-disclaimer');
const resetPromptBtn = document.getElementById('reset-prompt-btn') as HTMLButtonElement;


// API Key Gate selectors
const apiKeyGate = document.getElementById('api-key-gate');
const selectApiKeyBtn = document.getElementById('select-api-key-btn') as HTMLButtonElement;


// Image Upload Elements
const imageUploadInput = document.getElementById('image-upload-input') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const imagePlaceholder = document.getElementById('image-placeholder');
const analyzeImageBtn = document.getElementById('analyze-image-btn') as HTMLButtonElement;
const imageAnalysisHintInput = document.getElementById('image-analysis-hint') as HTMLTextAreaElement;

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

// VFX Elements selectors
const vfxCustomInput = document.getElementById('vfx-custom-input') as HTMLInputElement;
const vfxAddBtn = document.getElementById('vfx-add-btn') as HTMLButtonElement;
const vfxListContainer = document.getElementById('vfx-list-container');

// Frame Generation selectors
const generateFirstFrameBtn = document.getElementById('generate-first-frame-btn') as HTMLButtonElement;
const generateLastFrameBtn = document.getElementById('generate-last-frame-btn') as HTMLButtonElement;
const firstFramePrompt = document.getElementById('first-frame-prompt') as HTMLTextAreaElement;
const lastFramePrompt = document.getElementById('last-frame-prompt') as HTMLTextAreaElement;
const firstFramePreviewContainer = document.getElementById('first-frame-preview-container');
const lastFramePreviewContainer = document.getElementById('last-frame-preview-container');
const useSubjectFirstBtn = document.getElementById('use-subject-first') as HTMLButtonElement;
const useSubjectLastBtn = document.getElementById('use-subject-last') as HTMLButtonElement;
const suggestFirstFrameBtn = document.getElementById('suggest-first-frame-btn') as HTMLButtonElement;
const suggestLastFrameBtn = document.getElementById('suggest-last-frame-btn') as HTMLButtonElement;

// Video Generation Controls
const videoModelSelect = document.getElementById('video-model-select') as HTMLSelectElement;
const resolutionSelect = document.getElementById('resolution-select') as HTMLSelectElement;
const frameRateSelect = document.getElementById('frame-rate-select') as HTMLSelectElement;
const aspectRatioSelect = document.getElementById('aspect-ratio-select') as HTMLSelectElement;


// 3. State variables
let chat: Chat;
let currentEnhancedPrompt: any | null = null;
let uploadedImageBase64: { mimeType: string, data: string } | null = null;
let selectedStylePreset: string | null = null;
let addedSoundEffects: string[] = [];
const SAVED_PROMPTS_KEY = 'ai-video-prompts';
const PROMPT_HISTORY_KEY = 'ai-video-prompt-history';
let firstFrameBase64: string | null = null;
let lastFrameBase64: string | null = null;
let searchSuggestionTimeout: number | null = null;
let selectedVideoModelPreset: string | null = 'veo-standard';
let isApiKeySelected = false;


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
                duration: { type: Type.STRING, description: 'Target duration (e.g., "30s").' },
                mood: { type: Type.STRING, description: 'The emotional tone of the video.' },
                negative_prompt: { 
                    type: Type.STRING, 
                    description: 'A concise summary of elements, styles, or concepts to explicitly exclude from the video. Can be "none" if no exclusions are provided.' 
                },
            },
            required: ['style', 'duration', 'mood'],
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
                    description: 'A sequence of 3-5 distinct key shots that define the visual flow and narrative of the scene. Each shot should build upon the last.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: {
                                type: Type.STRING,
                                description: 'The type of camera shot (e.g., "Establishing Shot", "Wide Shot", "Medium Shot", "Close-up", "Low-Angle Shot", "POV Shot").'
                            },
                            description: {
                                type: Type.STRING,
                                description: 'A brief but vivid description of the action, subject, and composition within this shot.'
                            },
                            purpose: {
                                type: Type.STRING,
                                description: 'The narrative purpose of this shot (e.g., "Introduce the character", "Build tension", "Reveal the obstacle", "Climax of the action").'
                            },
                            transition_to_next_shot: {
                                type: Type.STRING,
                                description: 'The transition effect to the next shot (e.g., "Cut", "Fade to Black", "Dissolve"). Omitted for the last shot.'
                            }
                        },
                        required: ['shot_type', 'description', 'purpose']
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
                quality: { 
                    type: Type.STRING, 
                    description: 'Quality of the light, describing its hardness and diffusion. Be specific, using terms like "Hard, crisp shadows with high contrast (chiaroscuro)", "Soft, diffused light creating a gentle, wrapping glow", "Dappled light filtering through foliage or blinds", "Sharp specular highlights on wet or metallic surfaces", or "Flat, even lighting with minimal shadows".' 
                },
                color_temperature: { 
                    type: Type.STRING, 
                    description: 'Color tones of the light. Be evocative with examples like "Warm golden hour sunlight", "Cool, sterile blue tones of a medical lab", "Vibrant neon pink and cyan glow of a futuristic city", "Fiery orange of a sunset", "Sickly green of fluorescent bulbs", or "Muted, monochromatic tones of a noir film".' 
                },
                key_light_source: { 
                    type: Type.STRING, 
                    description: 'The direction and intensity of the primary light source. Be extremely specific. For direction, use terms like "front-lit", "side-lit from the left", "top-down", "backlit", or "underlit". For intensity and quality, describe it vividly, e.g., "Intense, blinding overhead sun", "Soft, gentle light filtering through a window to the right", "Flickering, dim candlelight from below", "Harsh, direct spotlight from the front".' 
                },
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
                aspect_ratio: { type: Type.STRING, description: 'Aspect ratio (e.g., "16:9", "21:9").' },
                color_grading: { type: Type.STRING, description: 'Post-production color style.' },
            },
            required: ['resolution', 'frame_rate', 'aspect_ratio', 'color_grading'],
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

const narrativeArcSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A concise, cinematic title for the story." },
        logline: { type: Type.STRING, description: "A one-sentence summary of the story." },
        beats: {
            type: Type.OBJECT,
            description: "The key story beats that form the narrative arc.",
            properties: {
                exposition: { type: Type.STRING, description: "Introduction of the setting and main character." },
                inciting_incident: { type: Type.STRING, description: "The event that kicks off the main conflict." },
                rising_action: { type: Type.STRING, description: "A brief summary of the escalating conflict and stakes." },
                climax: { type: Type.STRING, description: "The peak of the conflict, the main confrontation." },
                resolution: { type: Type.STRING, description: "The immediate aftermath and conclusion of the story." }
            },
            required: ["exposition", "inciting_incident", "rising_action", "climax", "resolution"]
        }
    },
    required: ["title", "logline", "beats"]
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
        },
        creative_suggestions: {
            type: Type.OBJECT,
            description: "Specific creative suggestions derived from the image analysis.",
            properties: {
                camera_angles: {
                    type: Type.ARRAY,
                    description: "An array of 2-3 specific camera angle suggestions (e.g., 'Low-angle shot', 'Dutch angle').",
                    items: { type: Type.STRING }
                },
                lighting_moods: {
                    type: Type.ARRAY,
                    description: "An array of 2-3 specific lighting mood suggestions (e.g., 'Chiaroscuro lighting', 'Golden hour glow').",
                    items: { type: Type.STRING }
                },
                narrative_elements: {
                    type: Type.ARRAY,
                    description: "An array of 2-3 potential narrative elements or story hooks inspired by the image.",
                    items: { type: Type.STRING }
                }
            },
            required: ["camera_angles", "lighting_moods", "narrative_elements"]
        }
    },
    required: ["analysis", "prompt_suggestions", "creative_suggestions"]
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

const vfxSuggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        vfx_suggestions: {
            type: Type.ARRAY,
            description: "An array of 2-4 relevant and creative visual effect suggestions based on the mood and setting. Each suggestion should be a short, descriptive string.",
            items: { type: Type.STRING }
        }
    },
    required: ["vfx_suggestions"]
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
function copyToClipboard(text: string, message: string = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showNotification(message);
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
    const keys = path.split(/[\.\[\]]/).filter(Boolean); // Handles array paths like 'shot_sequence[0]'
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
function displayEnhancedPrompt(promptData: any, narrativeArcData: any | null = null) {
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
    simpleTextContent.id = 'simple-text-content-container'; // Add ID for easier selection
    simpleTextContent.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating simplified text...`;
    
    // --- Narrative Arc Section ---
    const narrativeArcContainer = document.createElement('div');
    if (narrativeArcData) {
        narrativeArcContainer.className = 'narrative-arc-container';
        
        const header = document.createElement('strong');
        header.innerHTML = `<i class="fas fa-scroll"></i> Narrative Arc: ${narrativeArcData.title}`;
        narrativeArcContainer.appendChild(header);

        const logline = document.createElement('p');
        logline.className = 'narrative-arc-logline';
        logline.textContent = narrativeArcData.logline;
        narrativeArcContainer.appendChild(logline);

        const beatsList = document.createElement('div');
        beatsList.className = 'narrative-beats-list';
        
        const beats: { [key: string]: string } = narrativeArcData.beats;
        const beatOrder = ['exposition', 'inciting_incident', 'rising_action', 'climax', 'resolution'];

        beatOrder.forEach(key => {
            if(beats[key]) {
                const item = document.createElement('div');
                item.className = 'narrative-beat-item';
                const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                item.innerHTML = `
                    <div class="narrative-beat-title">${title}</div>
                    <p class="narrative-beat-description">${beats[key]}</p>
                `;
                beatsList.appendChild(item);
            }
        });
        narrativeArcContainer.appendChild(beatsList);
    }

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

    // --- Lighting Section ---
    const lightingContainer = document.createElement('div');
    lightingContainer.className = 'lighting-container';
    if (promptData.lighting) {
        const header = document.createElement('strong');
        header.innerHTML = '<i class="fas fa-lightbulb"></i> Lighting Setup';
        lightingContainer.appendChild(header);

        const lightingGrid = document.createElement('div');
        lightingGrid.className = 'lighting-grid';

        const lightingDetails = {
            'Type': promptData.lighting.type,
            'Quality': promptData.lighting.quality,
            'Color': promptData.lighting.color_temperature,
            'Key Source': promptData.lighting.key_light_source,
            'Fill Intensity': promptData.lighting.fill_light_intensity,
            'Backlight': promptData.lighting.backlight_effect,
            'Special Effects': promptData.lighting.special_effects,
        };

        for (const [key, value] of Object.entries(lightingDetails)) {
            if (value && String(value).toLowerCase() !== 'none') {
                const item = document.createElement('div');
                item.className = 'lighting-item';
                item.innerHTML = `<strong>${key}</strong><span>${value}</span>`;
                lightingGrid.appendChild(item);
            }
        }
        lightingContainer.appendChild(lightingGrid);
    }

    // --- Cinematography Section ---
    const cinematographyContainer = document.createElement('div');
    cinematographyContainer.className = 'cinematography-container';
    if (promptData.cinematography?.shot_sequence?.length > 0) {
        const header = document.createElement('strong');
        header.innerHTML = '<i class="fas fa-video"></i> Cinematography & Shot Flow';
        cinematographyContainer.appendChild(header);

        const timeline = document.createElement('div');
        timeline.className = 'shot-sequence-timeline';

        promptData.cinematography.shot_sequence.forEach((shot: any, index: number) => {
            const item = document.createElement('div');
            item.className = 'shot-item';
            item.innerHTML = `
                <div class="shot-number">${index + 1}</div>
                <div class="shot-details">
                    <div class="shot-type">${shot.shot_type}</div>
                    <div class="shot-purpose">${shot.purpose}</div>
                    <p class="shot-description">${shot.description}</p>
                </div>
            `;
            timeline.appendChild(item);

            // --- Add transition selector if not the last shot ---
            if (index < promptData.cinematography.shot_sequence.length - 1) {
                const connector = document.createElement('div');
                connector.className = 'transition-connector';

                const select = document.createElement('select');
                select.className = 'transition-select';
                select.title = 'Select transition to next shot';
                
                const transitions = ['Cut', 'Fade to Black', 'Fade In', 'Dissolve', 'Wipe (Left to Right)', 'Wipe (Top to Bottom)'];
                transitions.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t;
                    option.textContent = t;
                    select.appendChild(option);
                });

                select.value = shot.transition_to_next_shot || 'Cut'; // Default to Cut

                select.onchange = (e) => {
                    const newValue = (e.target as HTMLSelectElement).value;
                    updatePromptAndRefreshJSON(`cinematography.shot_sequence[${index}].transition_to_next_shot`, newValue);
                };
                
                connector.appendChild(select);
                timeline.appendChild(connector);
            }
        });

        cinematographyContainer.appendChild(timeline);
        
        // Also display camera movement and framing if available
        const otherDetails = document.createElement('div');
        otherDetails.className = 'cinematography-other-details';
        let detailsHtml = '';
        if (promptData.cinematography.camera_movement) {
            detailsHtml += `<div><strong>Camera Movement:</strong> <span>${promptData.cinematography.camera_movement}</span></div>`;
        }
        if (promptData.cinematography.framing) {
            detailsHtml += `<div><strong>Framing:</strong> <span>${promptData.cinematography.framing}</span></div>`;
        }
        if (promptData.cinematography.depth_of_field) {
            detailsHtml += `<div><strong>Depth of Field:</strong> <span>${promptData.cinematography.depth_of_field}</span></div>`;
        }
        if(detailsHtml) {
            otherDetails.innerHTML = detailsHtml;
            cinematographyContainer.appendChild(otherDetails);
        }
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

    // --- VFX Suggestions Section ---
    const vfxSuggestionsContainer = document.createElement('div');
    vfxSuggestionsContainer.className = 'vfx-suggestions-container placeholder';
    vfxSuggestionsContainer.innerHTML = `
        <strong><i class="fas fa-wand-magic-sparkles"></i> VFX Suggestions:</strong>
        <div class="vfx-suggestion-loader">
            <i class="fas fa-spinner fa-spin"></i> Finding ideas...
        </div>
    `;


    // --- Assemble Card ---
    promptCard.appendChild(jsonHeader);
    promptCard.appendChild(jsonContent);
    promptCard.appendChild(simpleTextHeader);
    promptCard.appendChild(simpleTextContent);
    if (narrativeArcData) {
        promptCard.appendChild(narrativeArcContainer);
    }
    if (exclusionsContainer.hasChildNodes()) {
        promptCard.appendChild(exclusionsContainer);
    }
    if (lightingContainer.hasChildNodes()) {
        promptCard.appendChild(lightingContainer);
    }
    if (cinematographyContainer.hasChildNodes()) {
        promptCard.appendChild(cinematographyContainer);
    }
    if (sfxContainer.hasChildNodes()) {
        promptCard.appendChild(sfxContainer);
    }
    promptCard.appendChild(vfxSuggestionsContainer);
    promptCard.appendChild(tagsContainer);
    
    resultsContainer.appendChild(promptCard);
    
    // --- Add event listeners ---
    (promptCard.querySelector('#copy-json-btn') as HTMLButtonElement).onclick = () => copyToClipboard(JSON.stringify(promptData, null, 2), 'JSON prompt copied to clipboard!');

    (promptCard.querySelector('#save-prompt-btn') as HTMLButtonElement).onclick = () => {
        const prompts = getSavedPrompts();
        const simpleText = document.getElementById('simple-text-content-container')?.textContent || '';
        const newPrompt = {
            id: Date.now(),
            title: `${promptData.scene?.subject || 'Untitled'} - ${promptData.meta?.style || 'Default Style'}`,
            data: promptData,
            simpleText: simpleText
        };
        prompts.unshift(newPrompt); // Add to the beginning of the list
        savePrompts(prompts);
        renderSavedPrompts();
        showNotification('Prompt saved successfully!');
    };


    // --- Generate and display simple prompt ---
    const copySimpleBtn = promptCard.querySelector('#copy-simple-btn') as HTMLButtonElement;
    generateSimplePrompt(promptData, simpleTextContent, copySimpleBtn);
    
    // --- Generate VFX Suggestions ---
    if (promptData.meta?.mood && promptData.scene?.setting) {
        generateVFXSuggestions(promptData.meta.mood, promptData.scene.setting, vfxSuggestionsContainer);
    } else {
        vfxSuggestionsContainer.style.display = 'none'; // Hide if not enough info
    }

    const selectedOption = videoModelSelect.options[videoModelSelect.selectedIndex];
    const isVeo = selectedOption.dataset.isVeo === 'true';
    if (isVeo) {
        generateVideoBtn.disabled = !isApiKeySelected;
    } else {
        generateVideoBtn.disabled = false; // For simulated models, only depends on prompt being present
    }

    // --- Populate and enable technical controls ---
    if (promptData.technical) {
        resolutionSelect.value = promptData.technical.resolution || '1080p Full HD';
        frameRateSelect.value = promptData.technical.frame_rate || '30fps';
        aspectRatioSelect.value = promptData.technical.aspect_ratio || '16:9';
        
        resolutionSelect.disabled = false;
        frameRateSelect.disabled = false;
        aspectRatioSelect.disabled = false;
    }

    setupInteractiveViewfinder(promptData.scene);

    // Enable 'Use Subject' and 'Suggest' buttons for frame generation
    useSubjectFirstBtn.disabled = !promptData.scene?.subject;
    useSubjectLastBtn.disabled = !promptData.scene?.subject;
    suggestFirstFrameBtn.disabled = false;
    suggestLastFrameBtn.disabled = false;


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
    
    // --- Populate manual VFX list ---
    updateVFXList();
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
    
    // --- Creative Suggestions Section ---
    if (analysisData.creative_suggestions) {
        const creativeGrid = document.createElement('div');
        creativeGrid.className = 'creative-suggestions-grid';

        const createSuggestionColumn = (title: string, icon: string, suggestions: string[]) => {
            if (!suggestions || suggestions.length === 0) return null;

            const column = document.createElement('div');
            column.className = 'suggestion-column';
            
            const header = document.createElement('h3');
            header.innerHTML = `<i class="fas ${icon}"></i> ${title}`;
            column.appendChild(header);

            suggestions.forEach(suggestion => {
                const btn = document.createElement('button');
                btn.className = 'suggestion-item-btn';
                btn.textContent = suggestion;
                btn.onclick = () => {
                    promptInput.value = (promptInput.value.trim() ? promptInput.value.trim() + ', ' : '') + suggestion;
                    promptInput.focus();
                    showNotification(`Added: "${suggestion}"`);
                };
                column.appendChild(btn);
            });
            return column;
        };

        const anglesCol = createSuggestionColumn('Camera Angles', 'fa-video', analysisData.creative_suggestions.camera_angles);
        const lightingCol = createSuggestionColumn('Lighting Moods', 'fa-lightbulb', analysisData.creative_suggestions.lighting_moods);
        const narrativeCol = createSuggestionColumn('Narrative Elements', 'fa-scroll', analysisData.creative_suggestions.narrative_elements);

        if (anglesCol) creativeGrid.appendChild(anglesCol);
        if (lightingCol) creativeGrid.appendChild(lightingCol);
        if (narrativeCol) creativeGrid.appendChild(narrativeCol);

        analysisSection.appendChild(creativeGrid);
    }

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
        buttonElement.onclick = () => copyToClipboard(simpleText, 'Simplified text prompt copied!');

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
    updateVFXList(); // Keep the manual editor in sync
    
    showNotification(`Applied: ${suggestion.effect}`);
}

/** Applies a VFX suggestion to the main enhanced prompt */
function applyVFXSuggestion(suggestion: string, buttonElement: HTMLButtonElement) {
    if (!currentEnhancedPrompt) {
        showNotification("Error: No active prompt to apply suggestion to.");
        return;
    }
    
    const currentVfx = currentEnhancedPrompt.vfx_elements || [];
    
    if (currentVfx.includes(suggestion)) {
        showNotification("Suggestion already applied!");
        return;
    }
    
    const newVfx = [...currentVfx, suggestion];
    
    updatePromptAndRefreshJSON('vfx_elements', newVfx);
    updateVFXList(); // Keep the manual editor in sync
    
    showNotification(`Applied: ${suggestion}`);
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i class="fas fa-check"></i> Applied`;
}

/** Displays the generated VFX suggestions in the UI */
function displayVFXSuggestions(suggestions: string[], container: HTMLElement) {
    container.innerHTML = ''; // Clear loader
    container.classList.remove('placeholder');

    const header = document.createElement('strong');
    header.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> VFX Suggestions:';
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'vfx-suggestions-list';

    suggestions.forEach(suggestion => {
        const btn = document.createElement('button');
        btn.className = 'vfx-suggestion-btn';
        btn.textContent = suggestion;
        btn.onclick = () => applyVFXSuggestion(suggestion, btn);
        list.appendChild(btn);
    });

    container.appendChild(list);
}

/** Fetches VFX suggestions from the AI */
async function generateVFXSuggestions(mood: string, setting: string, container: HTMLElement) {
    if (!mood || !setting) return;

    try {
        const prompt = `Based on a video scene with a mood of "${mood}" and a setting of "${setting}", suggest 2-4 highly relevant and creative visual effects (VFX). The suggestions should be short, descriptive phrases.`;
        
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: vfxSuggestionsSchema,
            },
        });
        const result = JSON.parse(response.text);
        if (result.vfx_suggestions && result.vfx_suggestions.length > 0) {
            displayVFXSuggestions(result.vfx_suggestions, container);
        } else {
            container.style.display = 'none'; // Hide if no suggestions
        }
    } catch (error) {
        console.error("Error generating VFX suggestions:", error);
        container.innerHTML = '<div class="vfx-suggestion-error">Could not load suggestions.</div>';
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

/** Updates the list of displayed VFX elements */
function updateVFXList() {
    vfxListContainer.innerHTML = '';
    if (!currentEnhancedPrompt || !currentEnhancedPrompt.vfx_elements) {
        return;
    }
    currentEnhancedPrompt.vfx_elements.forEach((vfx: string, index: number) => {
        const item = document.createElement('div');
        item.className = 'vfx-item';
        item.innerHTML = `
            <span>${vfx}</span>
            <button class="vfx-remove-btn" data-index="${index}" title="Remove">&times;</button>
        `;
        vfxListContainer.appendChild(item);
    });
}

/** Adds a VFX element to the list and the main prompt */
function addVFX() {
    if (!currentEnhancedPrompt) {
        showNotification("Please generate an enhanced prompt first.");
        return;
    }
    const vfx = vfxCustomInput.value.trim();
    if (vfx && !currentEnhancedPrompt.vfx_elements.includes(vfx)) {
        const newVfx = [...currentEnhancedPrompt.vfx_elements, vfx];
        updatePromptAndRefreshJSON('vfx_elements', newVfx);
        updateVFXList();
        vfxCustomInput.value = '';
    }
}

/** Removes a VFX element from the list and the main prompt */
function removeVFX(index: number) {
    if (!currentEnhancedPrompt || !currentEnhancedPrompt.vfx_elements) return;
    
    const newVfx = [...currentEnhancedPrompt.vfx_elements];
    newVfx.splice(index, 1);
    updatePromptAndRefreshJSON('vfx_elements', newVfx);
    updateVFXList();
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
                ${prompt.simpleText ? `<button class="action-btn" data-id="${prompt.id}" name="copy-text"><i class="fas fa-file-alt"></i> Copy Text</button>` : ''}
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


/** Retrieves prompt history from local storage */
function getPromptHistory(): any[] {
    const historyJSON = localStorage.getItem(PROMPT_HISTORY_KEY);
    return historyJSON ? JSON.parse(historyJSON) : [];
}

/** Saves prompt history to local storage */
function savePromptHistory(history: any[]) {
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(history));
}

/** Adds a successfully generated prompt to the history */
function addToHistory(userPrompt: string, enhancedPrompt: any, narrativeArc: any | null) {
    const history = getPromptHistory();
    const newHistoryItem = {
        id: Date.now(),
        userPrompt: userPrompt,
        enhancedPrompt: enhancedPrompt,
        narrativeArc: narrativeArc,
        // --- Save a snapshot of the generation settings ---
        negativePrompt: negativePromptInput.value.trim(),
        narrativeArcEnabled: narrativeArcToggle.checked,
        stylePreset: selectedStylePreset,
        soundEffects: [...addedSoundEffects],
        nsfwEnabled: nsfwToggle.checked
    };
    history.unshift(newHistoryItem); // Add to the top
    if (history.length > 50) { // Keep last 50 prompts
        history.pop();
    }
    savePromptHistory(history);
}

/** Renders the list of prompt history items */
function renderPromptHistory() {
    if (!promptHistoryContainer) return;
    const history = getPromptHistory();
    promptHistoryContainer.innerHTML = '';
    if (history.length === 0) {
        promptHistoryContainer.innerHTML = '<div class="placeholder">Your prompt history will appear here.</div>';
        return;
    }

    history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'saved-prompt-item'; // Reusing style
        const title = item.userPrompt.length > 50 ? item.userPrompt.substring(0, 47) + '...' : item.userPrompt;
        el.innerHTML = `
            <div>
                <div class="saved-prompt-title" title="${item.userPrompt}">${title}</div>
                <div class="saved-prompt-date">${new Date(item.id).toLocaleString()}</div>
            </div>
            <div class="saved-prompt-actions">
                <button class="action-btn" data-id="${item.id}" name="load-history"><i class="fas fa-folder-open"></i> Load</button>
                <button class="action-btn" data-id="${item.id}" name="delete-history"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        promptHistoryContainer.appendChild(el);
    });
}

/** Loads a history item into the results view */
function loadFromHistory(id: number) {
    const history = getPromptHistory();
    const itemToLoad = history.find(p => p.id === id);
    if (itemToLoad) {
        // --- Restore the full input snapshot ---
        promptInput.value = itemToLoad.userPrompt || '';
        negativePromptInput.value = itemToLoad.negativePrompt || '';
        narrativeArcToggle.checked = itemToLoad.narrativeArcEnabled || false;
        nsfwToggle.checked = itemToLoad.nsfwEnabled || false;
        if (nsfwDisclaimer) {
            nsfwDisclaimer.style.display = nsfwToggle.checked ? 'block' : 'none';
        }

        // Restore sound effects
        addedSoundEffects = itemToLoad.soundEffects || [];
        updateSFXList();

        // Restore style preset
        selectedStylePreset = itemToLoad.stylePreset || null;
        stylePresetsContainer.querySelectorAll('.style-preset-card').forEach(c => c.classList.remove('active'));
        if (selectedStylePreset) {
            const activeCard = stylePresetsContainer.querySelector(`[data-style="${selectedStylePreset}"]`);
            if (activeCard) {
                activeCard.classList.add('active');
            }
        }
        
        // --- Display the results ---
        displayEnhancedPrompt(itemToLoad.enhancedPrompt, itemToLoad.narrativeArc);
        window.scrollTo({ top: resultsContainer.offsetTop - 20, behavior: 'smooth' });
        showNotification("History item loaded successfully!");
    }
}

/** Deletes an item from history */
function deleteFromHistory(id: number) {
    let history = getPromptHistory();
    history = history.filter(p => p.id !== id);
    savePromptHistory(history);
    renderPromptHistory();
    showNotification("History item deleted.");
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
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

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
        generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate';
    }
}

/** Generates an AI-powered prompt suggestion for the first or last frame */
async function generateFramePromptSuggestion(type: 'first' | 'last') {
    if (!currentEnhancedPrompt) {
        showNotification("Please generate an enhanced prompt first.");
        return;
    }

    const suggestBtn = type === 'first' ? suggestFirstFrameBtn : suggestLastFrameBtn;
    const promptEl = type === 'first' ? firstFramePrompt : lastFramePrompt;

    suggestBtn.disabled = true;
    suggestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const originalPlaceholder = promptEl.placeholder;
    promptEl.placeholder = 'Generating suggestion...';

    try {
        const generationPrompt = `Based on the following detailed JSON video prompt, generate a single, concise, and visually descriptive text prompt for the ${type} frame of the scene. The prompt should be suitable for an AI image generator and capture the essence of the ${type === 'first' ? 'opening' : 'closing'} moment described in the shot_sequence. The output must be plain text only, without any explanations, titles, or markdown.

JSON Prompt:
${JSON.stringify(currentEnhancedPrompt, null, 2)}`;

        const response = await ai.models.generateContent({
            model: chatModel,
            contents: generationPrompt,
        });

        promptEl.value = response.text.trim();
        showNotification(`Suggested prompt for ${type} frame generated.`);

    } catch (error) {
        console.error(`Error generating ${type} frame suggestion:`, error);
        showNotification(`Failed to generate suggestion for ${type} frame.`);
    } finally {
        suggestBtn.disabled = false;
        suggestBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Suggest';
        promptEl.placeholder = originalPlaceholder;
    }
}


/** Clears and hides the search suggestions container */
function clearSearchSuggestions() {
    if (searchSuggestionsContainer) {
        searchSuggestionsContainer.style.display = 'none';
        searchSuggestionsContainer.innerHTML = '';
    }
}

/** Renders search suggestions in the UI */
function displaySearchSuggestions(suggestions: string[], sources: any[]) {
    if (!searchSuggestionsContainer || suggestions.length === 0) {
        clearSearchSuggestions();
        return;
    }

    searchSuggestionsContainer.innerHTML = `
        <div class="suggestions-header">
            <span class="suggestions-title"><i class="fas fa-lightbulb"></i> Cinematic Suggestions</span>
            <button class="suggestions-close-btn" id="close-suggestions-btn" title="Close">&times;</button>
        </div>
        <div class="suggestions-list" id="suggestions-list">
        </div>
    `;
    
    const suggestionsList = searchSuggestionsContainer.querySelector('#suggestions-list');

    suggestions.forEach(term => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn';
        btn.textContent = term;
        btn.onclick = () => {
            promptInput.value = (promptInput.value.trim().endsWith(',') ? promptInput.value.trim() : promptInput.value.trim() + ',') + ` ${term}`;
            promptInput.focus();
            clearSearchSuggestions();
        };
        suggestionsList.appendChild(btn);
    });

    if (sources.length > 0) {
        const sourcesHtml = sources.map((source: any, index: number) => {
            if (source.web?.uri) {
                 return `<a href="${source.web.uri}" target="_blank" rel="noopener noreferrer">Source ${index + 1}</a>`;
            }
            return '';
        }).filter(Boolean).join('');
        
        if (sourcesHtml) {
            const sourcesEl = document.createElement('div');
            sourcesEl.className = 'suggestions-sources';
            sourcesEl.innerHTML = `Sources: ${sourcesHtml}`;
            searchSuggestionsContainer.appendChild(sourcesEl);
        }
    }
    
    const closeBtn = searchSuggestionsContainer.querySelector('#close-suggestions-btn');
    if (closeBtn instanceof HTMLElement) {
        closeBtn.onclick = clearSearchSuggestions;
    }
    searchSuggestionsContainer.style.display = 'block';
}


/** Fetches cinematic term suggestions based on user input */
async function getSearchSuggestions(query: string) {
    if (!searchSuggestionsContainer) return;
    searchSuggestionsContainer.style.display = 'block';
    searchSuggestionsContainer.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i> Finding cinematic terms...</div>`;

    try {
        const generationPrompt = `Analyze the following video prompt idea. Identify the single most niche, technical, or specific term within it. Based on that single term, use Google Search to find 3-4 related cinematic terms, techniques, or visual concepts that would enrich the prompt.
- The output should be a single, comma-separated string of these terms.
- Do not include the original term in the output.
- If no specific term is found or no relevant cinematic concepts are available, respond with the exact text "N/A".

User's prompt: "${query}"`;

        const response = await ai.models.generateContent({
           model: "gemini-2.5-flash",
           contents: generationPrompt,
           config: {
             tools: [{googleSearch: {}}],
           },
        });
        
        const suggestionsText = response.text.trim();
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        if (suggestionsText && suggestionsText !== 'N/A') {
            const suggestions = suggestionsText.split(',').map(s => s.trim()).filter(Boolean);
            displaySearchSuggestions(suggestions, sources);
        } else {
            clearSearchSuggestions();
        }

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        clearSearchSuggestions();
    }
}

/** Handles user typing in the prompt input to trigger suggestions */
function handlePromptInput() {
    if (searchSuggestionTimeout) {
        clearTimeout(searchSuggestionTimeout);
    }
    const query = promptInput.value.trim();
    
    if (query.split(' ').length < 3) {
        clearSearchSuggestions();
        return;
    }
    
    searchSuggestionTimeout = window.setTimeout(() => {
        getSearchSuggestions(query);
    }, 1500); // Wait 1.5 seconds after user stops typing
}

/** Resets the UI to show the API key gate */
function resetApiKeyGate() {
    apiKeyGate.style.display = 'block';
    isApiKeySelected = false;
    generateVideoBtn.disabled = true;
}

/** Resets all user inputs and UI states to their default values */
function resetAllInputs() {
    // Main prompts
    promptInput.value = '';
    negativePromptInput.value = '';
    clearSearchSuggestions();
    narrativeArcToggle.checked = false;

    // NSFW toggle
    nsfwToggle.checked = false;
    if (nsfwDisclaimer) nsfwDisclaimer.style.display = 'none';

    // Negative prompt feedback
    if(negativePromptFeedback) negativePromptFeedback.style.display = 'none';

    // SFX
    addedSoundEffects = [];
    updateSFXList();
    sfxCustomInput.value = '';

    // Style preset
    selectedStylePreset = null;
    stylePresetsContainer.querySelectorAll('.style-preset-card').forEach(c => c.classList.remove('active'));

    // Image analysis
    imageUploadInput.value = ''; // Clear file input
    uploadedImageBase64 = null;
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    if(imagePlaceholder) imagePlaceholder.style.display = 'block';
    analyzeImageBtn.disabled = true;
    imageAnalysisHintInput.value = '';

    // Reset results and state
    currentEnhancedPrompt = null;
    resultsContainer.innerHTML = '<div class="placeholder">Your enhanced prompts will appear here...</div>';

    // Reset viewfinder
    if(viewfinderDisplay) viewfinderDisplay.innerHTML = '<div class="placeholder">Generate an enhanced prompt to activate the viewfinder.</div>';
    if(viewfinderControls) viewfinderControls.style.display = 'none';
    if (tiltSuggestionsContainer) tiltSuggestionsContainer.innerHTML = '';
    
    // Reset catalysts
    if (catalystsContainer) {
         catalystsContainer.innerHTML = 'Generate an enhanced prompt to see dynamic suggestions.';
         catalystsContainer.classList.add('placeholder');
    }

    // VFX (needs currentEnhancedPrompt to be null)
    updateVFXList();
    vfxCustomInput.value = '';

    // Frame generation
    firstFramePrompt.value = '';
    lastFramePrompt.value = '';
    firstFrameBase64 = null;
    lastFrameBase64 = null;
    firstFramePreviewContainer.innerHTML = '<span class="placeholder-text"><i class="fas fa-image"></i></span>';
    lastFramePreviewContainer.innerHTML = '<span class="placeholder-text"><i class="fas fa-image"></i></span>';
    useSubjectFirstBtn.disabled = true;
    useSubjectLastBtn.disabled = true;
    suggestFirstFrameBtn.disabled = true;
    suggestLastFrameBtn.disabled = true;

    // Video generation
    videoPreviewContainer.innerHTML = '<div class="placeholder">Video will appear here after generation</div>';
    videoModelSelect.selectedIndex = 0;
    
    // Reset and disable technical controls
    aspectRatioSelect.selectedIndex = 0;
    resolutionSelect.selectedIndex = 0;
    frameRateSelect.selectedIndex = 0;
    aspectRatioSelect.disabled = true;
    resolutionSelect.disabled = true;
    frameRateSelect.disabled = true;

    handleModelSelectionChange(); // This will also handle button disable state

    // Reset main button
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fas fa-magic"></i> Enhance Prompt';

    // Show notification
    showNotification("All inputs have been reset.");
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 5. Main logic and event listeners
async function main() {
    clearSearchSuggestions(); // Clear any suggestions when generating
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
    
    // Reset viewfinder and frame generation buttons
    if(viewfinderDisplay) viewfinderDisplay.innerHTML = '<div class="placeholder">Waiting for prompt...</div>';
    if(viewfinderControls) viewfinderControls.style.display = 'none';
    suggestFirstFrameBtn.disabled = true;
    suggestLastFrameBtn.disabled = true;

    let narrativeArcData = null;

    try {
        // Step 1: Generate Narrative Arc if toggled
        if (narrativeArcToggle.checked) {
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building narrative...';
            const narrativePrompt = `Based on the user's idea "${textPrompt}", generate a compelling 5-beat narrative arc (Exposition, Inciting Incident, Rising Action, Climax, Resolution). The output must be a valid JSON object.`;
            
            try {
                const narrativeResponse = await ai.models.generateContent({
                    model: chatModel, // Use a faster model for the story part
                    contents: narrativePrompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: narrativeArcSchema,
                    }
                });
                narrativeArcData = JSON.parse(narrativeResponse.text);
            } catch (narrativeError) {
                console.warn("Could not generate narrative arc, proceeding without it.", narrativeError);
                showNotification("Warning: Could not generate a narrative arc. Proceeding with standard enhancement.");
            }
        }


        // Step 2: Generate the main video prompt
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enhancing details...';
        let generationPrompt = `Create an advanced, professional video generation prompt based on the user's idea. The output must be a valid JSON object adhering to the provided schema. Flesh out every detail, from cinematography to lighting and sound design, to create a rich, actionable prompt. For the 'shot_sequence', also suggest a suitable 'transition_to_next_shot' (e.g., 'Cut', 'Dissolve', 'Fade to Black') for all but the final shot. For 'technical.color_grading', suggest a specific color grading style that complements the mood and style of the video, such as 'Desaturated cool tones', 'Warm vintage look', or 'High contrast cyberpunk'.

User's Idea: "${textPrompt}"`;

        if (narrativeArcData) {
            generationPrompt += `\n\n**Crucially, use the following narrative arc to structure the scene and define the 'purpose' for each shot in the 'cinematography.shot_sequence'.** Each shot's purpose must directly correspond to and elaborate upon one of the provided story beats. Ensure the shot sequence follows the narrative flow logically from exposition to resolution.
\nNarrative Arc:
Title: ${narrativeArcData.title}
Logline: ${narrativeArcData.logline}
Beats: 
- Exposition: ${narrativeArcData.beats.exposition}
- Inciting Incident: ${narrativeArcData.beats.inciting_incident}
- Rising Action: ${narrativeArcData.beats.rising_action}
- Climax: ${narrativeArcData.beats.climax}
- Resolution: ${narrativeArcData.beats.resolution}
`;
        }

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

        if (nsfwToggle.checked) {
            generationPrompt += `\n\nNSFW Content Enabled: The user has confirmed they are responsible for the generated content. Generate content accordingly.`;
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
        displayEnhancedPrompt(enhancedPrompt, narrativeArcData);

        // Add to history and re-render
        addToHistory(textPrompt, enhancedPrompt, narrativeArcData);
        renderPromptHistory();

    } catch (error) {
        console.error('Error generating prompt:', error);
        resultsContainer.innerHTML = '<div class="placeholder" style="color: #ff8a80;">An error occurred. Please try again.</div>';
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-magic"></i> Enhance Prompt';
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
        const hint = imageAnalysisHintInput.value.trim();
        let textPrompt = `Analyze this image in detail. Provide a comprehensive analysis, 3 full video prompt ideas, and specific creative suggestions. The output must be a valid JSON object.
- For the 'analysis', give a rich description, identify objects, dominant colors, and composition.
- For 'prompt_suggestions', provide 3 complete, distinct video prompt ideas.
- For 'creative_suggestions', provide 2-3 specific ideas for each of the following categories: 'camera_angles', 'lighting_moods', and 'narrative_elements'.`;

        if (hint) {
            textPrompt += `\n\nUse the following user-provided hint to guide the analysis and suggestions: "${hint}"`;
        }

        const response = await ai.models.generateContent({
            model: chatModel, // Use a multimodal model for image analysis
            contents: {
                parts: [
                    { inlineData: uploadedImageBase64 },
                    { text: textPrompt }
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

async function initApiKeyCheck() {
    try {
        if (await window.aistudio.hasSelectedApiKey()) {
            apiKeyGate.style.display = 'none';
            isApiKeySelected = true;
            handleModelSelectionChange();
        } else {
            handleModelSelectionChange();
        }
    } catch (e) {
        // Fallback for environments where aistudio is not available
        console.warn("aistudio.hasSelectedApiKey() not available. Hiding API key gate.");
        apiKeyGate.style.display = 'none';
        isApiKeySelected = true;
    }
}

function handleModelSelectionChange() {
    const selectedOption = videoModelSelect.options[videoModelSelect.selectedIndex];
    selectedVideoModelPreset = selectedOption.value;
    const isVeo = selectedOption.dataset.isVeo === 'true';

    if (isVeo) {
        // Veo model selected
        if (!isApiKeySelected) {
            resetApiKeyGate(); // Shows gate, disables button
        } else {
            apiKeyGate.style.display = 'none';
            generateVideoBtn.disabled = !currentEnhancedPrompt; // Enable if prompt exists
        }
    } else {
        // Simulation model selected
        apiKeyGate.style.display = 'none';
        generateVideoBtn.disabled = !currentEnhancedPrompt; // Enable if prompt exists
    }
}


async function init() {
    chat = ai.chats.create({ model: chatModel });
    
    // Event listeners
    generateBtn.onclick = main;
    resetPromptBtn.onclick = resetAllInputs;
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            main();
        }
    });
    promptInput.addEventListener('input', handlePromptInput);

    nsfwToggle.addEventListener('change', () => {
        if (nsfwDisclaimer) {
            nsfwDisclaimer.style.display = nsfwToggle.checked ? 'block' : 'none';
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
        const card = target.closest('.style-preset-card');
        if (!card) return;

        const style = (card as HTMLElement).dataset.style;

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
    
    // VFX Listeners
    vfxAddBtn.onclick = addVFX;
    vfxCustomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addVFX();
        }
    });
    vfxListContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && target.classList.contains('vfx-remove-btn')) {
            const indexStr = target.dataset.index;
            if (indexStr !== undefined) {
                const index = parseInt(indexStr, 10);
                if (!isNaN(index)) {
                    removeVFX(index);
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
            } else if (button.name === 'copy-text') {
                const prompts = getSavedPrompts();
                const promptToCopy = prompts.find(p => p.id === id);
                if (promptToCopy && promptToCopy.simpleText) {
                    copyToClipboard(promptToCopy.simpleText, 'Simplified text prompt copied!');
                }
            } else if (button.name === 'delete') {
                if (confirm('Are you sure you want to delete this prompt?')) {
                    deletePrompt(id);
                }
            }
        }
    });
    
    // History listeners
    if (promptHistoryContainer) {
        promptHistoryContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (button) {
                const id = parseInt(button.dataset.id, 10);
                if (button.name === 'load-history') {
                    loadFromHistory(id);
                } else if (button.name === 'delete-history') {
                    if (confirm('Are you sure you want to delete this history item?')) {
                        deleteFromHistory(id);
                    }
                }
            }
        });
    }

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
    suggestFirstFrameBtn.onclick = () => generateFramePromptSuggestion('first');
    suggestLastFrameBtn.onclick = () => generateFramePromptSuggestion('last');

    // Video Model Selection listener
    videoModelSelect.onchange = handleModelSelectionChange;

    // Video Technical Controls listeners
    aspectRatioSelect.onchange = (e) => updatePromptAndRefreshJSON('technical.aspect_ratio', (e.target as HTMLSelectElement).value);
    resolutionSelect.onchange = (e) => updatePromptAndRefreshJSON('technical.resolution', (e.target as HTMLSelectElement).value);
    frameRateSelect.onchange = (e) => updatePromptAndRefreshJSON('technical.frame_rate', (e.target as HTMLSelectElement).value);
    
    // API Key listener
    selectApiKeyBtn.onclick = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition
            apiKeyGate.style.display = 'none';
            isApiKeySelected = true;
            handleModelSelectionChange();
        } catch(e) {
            console.error("Error opening API key selection:", e);
            showNotification("Could not open API key selection dialog.");
        }
    };

    generateVideoBtn.onclick = async () => {
        if (!currentEnhancedPrompt) {
            showNotification("Error: Please enhance a prompt first.");
            return;
        }
        if (!selectedVideoModelPreset) {
            showNotification("Please select a video model preset.");
            return;
        }

        const selectedOption = videoModelSelect.options[videoModelSelect.selectedIndex];
        const isVeo = selectedOption.dataset.isVeo === 'true';
        const modelDisplayName = selectedOption.text;

        if (isVeo) {
            // Real Veo Generation
            const simplifiedPromptEl = document.getElementById('simple-text-content-container');
            if (!simplifiedPromptEl || simplifiedPromptEl.classList.contains('placeholder')) {
                showNotification("Simplified prompt is not ready yet.");
                return;
            }
            const prompt = simplifiedPromptEl.textContent;

            const loadingMessages = [
                `Request sent to '${modelDisplayName}'...`,
                "This can take a few minutes. Please wait.",
                "Still rendering your masterpiece...",
                "Applying cinematic touches...",
                "Finalizing video... almost there!"
            ];
            let messageIndex = 0;
            videoPreviewContainer.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i><p>${loadingMessages[messageIndex]}</p></div>`;
            const messageInterval = setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                const p = videoPreviewContainer.querySelector('p');
                if (p) p.textContent = loadingMessages[messageIndex];
            }, 8000);

            try {
                // Create a fresh client instance to ensure the latest key is used
                const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                const modelMap: { [key: string]: string } = {
                    'veo-standard': 'veo-3.1-fast-generate-preview',
                    'veo-cinematic': 'veo-3.1-generate-preview'
                };
                
                const payload: any = {
                    model: modelMap[selectedVideoModelPreset],
                    prompt: prompt,
                    config: {
                        numberOfVideos: 1,
                        resolution: '720p',
                        aspectRatio: '16:9'
                    }
                };
                
                if (firstFrameBase64) {
                    payload.image = { imageBytes: firstFrameBase64, mimeType: 'image/png' };
                    if (lastFrameBase64) {
                        payload.config.lastFrame = { imageBytes: lastFrameBase64, mimeType: 'image/png' };
                    }
                }
                
                let operation = await videoAi.models.generateVideos(payload);
                
                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    operation = await videoAi.operations.getVideosOperation({ operation: operation });
                }

                clearInterval(messageInterval);

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (downloadLink) {
                     const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                     const videoBlob = await response.blob();
                     const videoUrl = URL.createObjectURL(videoBlob);
                     videoPreviewContainer.innerHTML = `<video controls autoplay loop style="width:100%; height:100%; border-radius:10px; object-fit: cover;" src="${videoUrl}"></video>`;
                } else {
                    throw new Error("Video generation completed, but no download link was found.");
                }

            } catch (error: any) {
                 clearInterval(messageInterval);
                 console.error("Video generation failed:", error);
                 let errorMessage = "Video generation failed. Please check the console for details.";
                 if (error.message.includes("Requested entity was not found")) {
                     errorMessage = "API Key is invalid or expired. Please select a valid key.";
                     resetApiKeyGate();
                 }
                 videoPreviewContainer.innerHTML = `<div class="placeholder error" style="color: #ff8a80;"><i class="fas fa-exclamation-triangle"></i><p>${errorMessage}</p></div>`;
            }

        } else {
            // Simulation
            videoPreviewContainer.innerHTML = `<div class="placeholder"><i class="fas fa-spinner fa-spin"></i><p>Simulating generation with '${modelDisplayName}'...</p></div>`;
            showNotification(`Simulating video generation with ${modelDisplayName}...`);

            setTimeout(() => {
                 videoPreviewContainer.innerHTML = `<div class="placeholder" style="padding: 0; height: 100%;"><p style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: -1;">Simulation complete!</p><video controls autoplay loop style="width:100%; height:100%; border-radius:10px; object-fit: cover;"><source src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4"></source></video></div>`;
            }, 3000);
        }
    };


    // Initial setup
    renderSavedPrompts();
    renderPromptHistory();
    initApiKeyCheck();

    // Populate SFX presets
    const sfxPresets = ['Tense cinematic music', 'Futuristic synthwave', 'Heavy footsteps on metal', 'Explosion in the distance', 'Rain and thunder', 'Glitched digital sounds'];
    sfxPresets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'sfx-preset-btn';
        btn.textContent = preset;
        btn.onclick = () => addSoundEffect(preset);
        sfxPresetsContainer.appendChild(btn);
    });
    
    handleModelSelectionChange();
}

document.addEventListener('DOMContentLoaded', init);