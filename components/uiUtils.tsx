

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This file is an aggregator for UI utilities, contexts, hooks, and components.
// It's designed to be split into smaller, more manageable files for better organization
// while maintaining a single import point for other parts of the application.

export * from './uiTypes';
export * from './uiFileUtilities';
export * from './uiHooks';
export * from './uiContexts';
export * from './uiComponents';
export { default as ExtraTools } from './ExtraTools';
export { default as ImageLayoutModal } from './ImageLayoutModal';
export { default as BeforeAfterModal } from './BeforeAfterModal';
export { default as AppCoverCreatorModal } from './AppCoverCreatorModal';
export * from './storyboarding';
export { StoryboardingModal } from './StoryboardingModal';
export { LayerComposerModal } from './LayerComposerModal';

import { getInitialStateForApp as baseGetInitialStateForApp, type AnyAppState } from './uiTypes';

// Re-export this function with updated implementation for Tet QR 2026
export const getInitialStateForApp = (viewId: string): AnyAppState => {
    switch (viewId) {
        case 'home':
            return { stage: 'home' };
        case 'architecture-ideator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImage: null, historicalImages: [], options: { context: '', style: '', color: '', lighting: '', notes: '', removeWatermark: false }, error: null };
        case 'avatar-creator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImages: {}, historicalImages: [], selectedIdeas: [], options: { additionalPrompt: '', removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'baby-photo-creator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImages: {}, historicalImages: [], selectedIdeas: [], options: { additionalPrompt: '', removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'beauty-creator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImages: {}, historicalImages: [], selectedIdeas: [], options: { notes: '', removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'mid-autumn-creator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImages: {}, historicalImages: [], selectedIdeas: [], options: { additionalPrompt: '', removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'entrepreneur-creator':
            return { stage: 'idle', uploadedImage: null, styleReferenceImage: null, generatedImages: {}, historicalImages: [], selectedIdeas: [], options: { additionalPrompt: '', removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'dress-the-model':
            return { stage: 'idle', modelImage: null, clothingImage: null, generatedImage: null, historicalImages: [], options: { background: '', pose: '', style: '', aspectRatio: 'Giữ nguyên', notes: '', removeWatermark: false }, error: null };
        case 'photo-restoration':
            return { stage: 'idle', uploadedImage: null, generatedImage: null, historicalImages: [], options: { type: 'Chân dung', gender: 'Tự động', age: '', nationality: '', notes: '', removeWatermark: false, removeStains: true, colorizeRgb: true }, error: null };
        case 'swap-style':
            return { stage: 'idle', contentImage: null, styleImage: null, generatedImage: null, historicalImages: [], options: { style: '', styleStrength: 'Rất mạnh', notes: '', removeWatermark: false, convertToReal: false }, error: null };
        case 'free-generation':
            return { stage: 'configuring', image1: null, image2: null, image3: null, image4: null, generatedImages: [], historicalImages: [], options: { prompt: '', removeWatermark: false, numberOfImages: 1, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'image-to-real':
            return { stage: 'idle', uploadedImage: null, generatedImage: null, historicalImages: [], options: { faithfulness: 'Tự động', notes: '', removeWatermark: false }, error: null };
        case 'toy-model-creator':
            return { 
                stage: 'idle', 
                uploadedImage: null, 
                generatedImage: null, 
                historicalImages: [],
                concept: 'desktop_model', 
                options: { 
                    computerType: '', 
                    softwareType: '', 
                    boxType: '', 
                    background: '', 
                    keychainMaterial: '', 
                    keychainStyle: '', 
                    accompanyingItems: '', 
                    deskSurface: '',
                    capsuleColor: '', 
                    modelFinish: '', 
                    capsuleContents: '', 
                    displayLocation: '',
                    miniatureMaterial: '', 
                    baseMaterial: '', 
                    baseShape: '', 
                    lightingStyle: '',
                    pokeballType: '', 
                    evolutionDisplay: '', 
                    modelStyle: '',
                    modelType: '',
                    blueprintType: '',
                    characterMood: '',
                    aspectRatio: 'Giữ nguyên', 
                    notes: '', 
                    removeWatermark: false 
                }, 
                error: null 
            };
        case 'image-interpolation':
             return { stage: 'idle', analysisMode: 'general', inputImage: null, outputImage: null, referenceImage: null, generatedPrompt: '', promptSuggestions: '', additionalNotes: '', finalPrompt: null, generatedImage: null, historicalImages: [], options: { removeWatermark: false, aspectRatio: 'Giữ nguyên' }, error: null };
        case 'spring2026Creator':
            return {
                stage: 'idle',
                uploadedImage: null,
                generatedImage: null,
                historicalImages: [],
                options: {
                    gender: 'female',
                    pose: 'fan_single',
                    outfit: 'ao_dai_classic',
                    scene: 'studio_red',
                    textOverlay: 'none',
                    detailLevel: 'high',
                    notes: '',
                    removeWatermark: false,
                    aspectRatio: '3:4'
                },
                error: null
            };
        case 'tet-qr-2026':
            return {
                stage: 'idle',
                uploadedImage: null,
                generatedImage: null,
                qrCodeUrl: null,
                historicalImages: [],
                options: {
                    bankName: '',
                    accountName: '',
                    accountNumber: '',
                    amount: '',
                    message: '',
                    mode: 'adult',
                    outfit: 'red_traditional',
                    customOutfit: '',
                    greeting: '',
                    gender: 'male',
                    style: 'standard',
                    notes: '',
                    removeWatermark: false,
                    aspectRatio: '3:4'
                },
                error: null
            };
        default:
            return { stage: 'home' };
    }
};
