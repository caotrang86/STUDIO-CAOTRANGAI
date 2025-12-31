
import React from 'react';

// --- Common Types ---
export type ImageStatus = 'idle' | 'pending' | 'done' | 'error';

export interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

export interface AppConfig {
    id: string;
    titleKey: string;
    descriptionKey: string;
    icon: React.ReactNode;
    previewImageUrl?: string;
    supportsCanvasPreset?: boolean;
}

export interface Settings {
    home: {
        mainTitleKey: string;
        subtitleKey: string;
        useSmartTitleWrapping: boolean;
        smartTitleWrapWords: number;
    };
    apps: AppConfig[];
    enableWebcam?: boolean;
    enableImageMetadata?: boolean;
    [key: string]: any;
}

export interface GenerationHistoryEntry {
    id: string;
    appId: string;
    appName: string;
    thumbnailUrl: string;
    timestamp: number;
    settings: any;
}

export interface ImageForZip {
    url: string;
    filename: string;
    folder?: string;
    extension?: string;
}

export interface VideoTask {
    status: 'pending' | 'done' | 'error';
    operation?: any;
    resultUrl?: string;
    error?: string;
}

export interface ImageToEdit {
    url: string | null;
    onSave: (newUrl: string) => void;
}

// Restore themes to match index.css classes
export type Theme = 'sdvn' | 'vietnam' | 'skyline' | 'hidden-jaguar' | 'wide-matrix' | 'rainbow' | 'soundcloud' | 'amin';
export const THEMES: Theme[] = ['sdvn', 'vietnam', 'skyline', 'hidden-jaguar', 'wide-matrix', 'rainbow', 'soundcloud', 'amin'];
export const THEME_DETAILS: { id: Theme; name: string; colors: string[] }[] = [
    { id: 'sdvn', name: 'SDVN', colors: ['#5858e6', '#151523'] },
    { id: 'vietnam', name: 'Vietnam', colors: ['#DA251D', '#FFFF00'] },
    { id: 'skyline', name: 'Skyline', colors: ['#6FB1FC', '#0052D4'] },
    { id: 'hidden-jaguar', name: 'Hidden Jaguar', colors: ['#0fd850', '#f9f047'] },
    { id: 'wide-matrix', name: 'Wide Matrix', colors: ['#fcc5e4', '#020f75'] },
    { id: 'rainbow', name: 'Rainbow', colors: ['#00F260', '#0575E6'] },
    { id: 'soundcloud', name: 'SoundCloud', colors: ['#fe8c00', '#f83600'] },
    { id: 'amin', name: 'Amin', colors: ['#8E2DE2', '#4A00E0'] },
];

// --- App State Interfaces ---

export interface HomeState {
    stage: 'home';
}

export interface ArchitectureIdeatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        context: string;
        style: string;
        color: string;
        lighting: string;
        notes: string;
        removeWatermark: boolean;
    };
    error: string | null;
}

export interface AvatarCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImages: Record<string, GeneratedImage>;
    selectedIdeas: string[];
    historicalImages: { idea: string; url: string }[];
    options: {
        additionalPrompt: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface BabyPhotoCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImages: Record<string, GeneratedImage>;
    selectedIdeas: string[];
    historicalImages: { idea: string; url: string }[];
    options: {
        additionalPrompt: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface BeautyCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImages: Record<string, GeneratedImage>;
    selectedIdeas: string[];
    historicalImages: { idea: string; url: string }[];
    options: {
        notes: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface MidAutumnCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImages: Record<string, GeneratedImage>;
    selectedIdeas: string[];
    historicalImages: { idea: string; url: string }[];
    options: {
        additionalPrompt: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface EntrepreneurCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    styleReferenceImage: string | null;
    generatedImages: Record<string, GeneratedImage>;
    selectedIdeas: string[];
    historicalImages: { idea: string; url: string }[];
    options: {
        additionalPrompt: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface DressTheModelState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    modelImage: string | null;
    clothingImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        background: string;
        pose: string;
        style: string;
        aspectRatio: string;
        notes: string;
        removeWatermark: boolean;
    };
    error: string | null;
}

export interface PhotoRestorationState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        type: string;
        gender: string;
        age: string;
        nationality: string;
        notes: string;
        removeWatermark: boolean;
        removeStains: boolean;
        colorizeRgb: boolean;
    };
    error: string | null;
}

export interface SwapStyleState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    contentImage: string | null;
    styleImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        style: string;
        styleStrength: string;
        notes: string;
        removeWatermark: boolean;
        convertToReal: boolean;
    };
    error: string | null;
}

export interface MixStyleState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    contentImage: string | null;
    styleImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        styleStrength: string;
        notes: string;
        removeWatermark: boolean;
    };
    error: string | null;
}

export interface FreeGenerationState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    image1: string | null;
    image2: string | null;
    image3: string | null;
    image4: string | null;
    generatedImages: string[];
    historicalImages: string[];
    options: {
        prompt: string;
        removeWatermark: boolean;
        numberOfImages: number;
        aspectRatio: string;
    };
    error: string | null;
}

export interface ImageToRealState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        faithfulness: string;
        notes: string;
        removeWatermark: boolean;
    };
    error: string | null;
}

export interface ToyModelCreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    concept: string;
    options: {
        computerType: string;
        softwareType: string;
        boxType: string;
        background: string;
        keychainMaterial: string;
        keychainStyle: string;
        accompanyingItems: string;
        deskSurface: string;
        capsuleColor: string;
        modelFinish: string;
        capsuleContents: string;
        displayLocation: string;
        miniatureMaterial: string;
        baseMaterial: string;
        baseShape: string;
        lightingStyle: string;
        pokeballType: string;
        evolutionDisplay: string;
        modelStyle: string;
        modelType: string;
        blueprintType: string;
        characterMood: string;
        aspectRatio: string;
        notes: string;
        removeWatermark: boolean;
    };
    error: string | null;
}

export interface ImageInterpolationState {
    stage: 'idle' | 'configuring' | 'prompting' | 'generating' | 'results';
    analysisMode: 'general' | 'deep' | 'expert';
    inputImage: string | null;
    outputImage: string | null;
    referenceImage: string | null;
    generatedPrompt: string;
    promptSuggestions: string;
    additionalNotes: string;
    finalPrompt: string | null;
    generatedImage: string | null;
    historicalImages: { url: string; prompt: string }[];
    options: {
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

export interface Spring2026CreatorState {
    stage: 'idle' | 'configuring' | 'generating' | 'results';
    uploadedImage: string | null;
    generatedImage: string | null;
    historicalImages: string[];
    options: {
        gender: string;
        pose: string;
        outfit: string;
        scene: string;
        textOverlay: string;
        detailLevel: string;
        notes: string;
        removeWatermark: boolean;
        aspectRatio: string;
    };
    error: string | null;
}

// --- Storyboarding Types ---
export interface FrameState {
    description: string;
    status: 'idle' | 'pending' | 'done' | 'error';
    imageSource: 'reference' | string;
    imageUrl?: string;
    error?: string;
}

export interface SceneState {
    scene: number;
    startFrame: FrameState;
    animationDescription: string;
    videoPrompt?: string;
    endFrame: FrameState;
    videoStatus?: 'idle' | 'pending' | 'done' | 'error';
    videoUrl?: string;
    videoError?: string;
    videoOperation?: any;
}


// --- App Navigation & State Types ---
export type AnyAppState =
  | HomeState
  | ArchitectureIdeatorState
  | AvatarCreatorState
  | BabyPhotoCreatorState
  | BeautyCreatorState
  | MidAutumnCreatorState
  | EntrepreneurCreatorState
  | DressTheModelState
  | PhotoRestorationState
  | SwapStyleState
  | MixStyleState
  | FreeGenerationState
  | ImageToRealState
  | ToyModelCreatorState
  | ImageInterpolationState
  | Spring2026CreatorState;

export type HomeView = { viewId: 'home'; state: HomeState };
export type ArchitectureIdeatorView = { viewId: 'architecture-ideator'; state: ArchitectureIdeatorState };
export type AvatarCreatorView = { viewId: 'avatar-creator'; state: AvatarCreatorState };
export type BabyPhotoCreatorView = { viewId: 'baby-photo-creator'; state: BabyPhotoCreatorState };
export type BeautyCreatorView = { viewId: 'beauty-creator'; state: BeautyCreatorState };
export type MidAutumnCreatorView = { viewId: 'mid-autumn-creator'; state: MidAutumnCreatorState };
export type EntrepreneurCreatorView = { viewId: 'entrepreneur-creator'; state: EntrepreneurCreatorState };
export type DressTheModelView = { viewId: 'dress-the-model'; state: DressTheModelState };
export type PhotoRestorationView = { viewId: 'photo-restoration'; state: PhotoRestorationState };
export type SwapStyleView = { viewId: 'swap-style'; state: SwapStyleState };
export type FreeGenerationView = { viewId: 'free-generation'; state: FreeGenerationState };
export type ToyModelCreatorView = { viewId: 'toy-model-creator'; state: ToyModelCreatorState };
export type ImageInterpolationView = { viewId: 'image-interpolation'; state: ImageInterpolationState };
export type ImageToRealView = { viewId: 'image-to-real'; state: ImageToRealState };
export type Spring2026CreatorView = { viewId: 'spring2026Creator'; state: Spring2026CreatorState };

export type ViewState =
  | HomeView
  | ArchitectureIdeatorView
  | AvatarCreatorView
  | BabyPhotoCreatorView
  | BeautyCreatorView
  | MidAutumnCreatorView
  | EntrepreneurCreatorView
  | DressTheModelView
  | PhotoRestorationView
  | SwapStyleView
  | FreeGenerationView
  | ToyModelCreatorView
  | ImageInterpolationView
  | ImageToRealView
  | Spring2026CreatorView;

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
        default:
            return { stage: 'home' };
    }
};