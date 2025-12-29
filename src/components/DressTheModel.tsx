/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDressedModelImage, editImageWithPrompt } from '../services/geminiService';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import Lightbox from './Lightbox';
import { 
    AppScreenHeader,
    handleFileUpload,
    ImageForZip,
    ResultsView,
    type DressTheModelState,
    OptionsPanel,
    processAndDownloadAll,
    SearchableSelect,
    useAppControls,
    embedJsonInPng,
    getInitialStateForApp,
} from './uiUtils';
import { useLightbox, useVideoGeneration, useMediaQuery } from './uiHooks';

interface DressTheModelProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
    uploaderCaptionModel: string;
    uploaderDescriptionModel: string;
    uploaderCaptionClothing: string;
    uploaderDescriptionClothing: string;
    addImagesToGallery: (images: string[]) => void;
    appState: DressTheModelState;
    onStateChange: (newState: DressTheModelState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}


const DressTheModel: React.FC<DressTheModelProps> = (props) => {
    const { 
        uploaderCaptionModel, uploaderDescriptionModel,
        uploaderCaptionClothing, uploaderDescriptionClothing,
        addImagesToGallery,
        appState, onStateChange, onReset,
        logGeneration,
        ...headerProps
    } = props;
    
    const { t, settings } = useAppControls();
    const { lightboxIndex, openLightbox, closeLightbox, navigateLightbox } = useLightbox();
    const { videoTasks, generateVideo } = useVideoGeneration();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [localNotes, setLocalNotes] = useState(appState.options.notes);

    useEffect(() => {
        setLocalNotes(appState.options.notes);
    }, [appState.options.notes]);
    
    const BACKGROUND_OPTIONS = t('dressTheModel_backgroundOptions');
    const POSE_OPTIONS = t('dressTheModel_poseOptions');
    const PHOTO_STYLE_OPTIONS = t('dressTheModel_photoStyleOptions');
    const ASPECT_RATIO_OPTIONS = t('aspectRatioOptions');

    const lightboxImages = [appState.modelImage, appState.clothingImage, ...appState.historicalImages].filter((img): img is string => !!img);

    const handleModelImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, (imageDataUrl) => {
            onStateChange({
                ...appState,
                stage: appState.clothingImage ? 'configuring' : 'idle',
                modelImage: imageDataUrl,
                generatedImage: null,
                historicalImages: [],
                error: null,
            });
            addImagesToGallery([imageDataUrl]);
        });
    };

    const handleClothingImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, (imageDataUrl) => {
            onStateChange({
                ...appState,
                stage: appState.modelImage ? 'configuring' : 'idle',
                clothingImage: imageDataUrl,
                generatedImage: null,
                historicalImages: [],
                error: null,
            });
            addImagesToGallery([imageDataUrl]);
        });
    };
    
    const handleModelImageChange = (newUrl: string | null) => {
        onStateChange({
            ...appState,
            stage: newUrl && appState.clothingImage ? 'configuring' : 'idle',
            modelImage: newUrl,
        });
        if (newUrl) {
            addImagesToGallery([newUrl]);
        }
    };
    const handleClothingImageChange = (newUrl: string | null) => {
        onStateChange({
            ...appState,
            stage: newUrl && appState.modelImage ? 'configuring' : 'idle',
            clothingImage: newUrl,
        });
        if (newUrl) {
            addImagesToGallery([newUrl]);
        }
    };
    const handleGeneratedImageChange = (newUrl: string) => {
        const newHistorical = [...appState.historicalImages, newUrl];
        onStateChange({ ...appState, stage: 'results', generatedImage: newUrl, historicalImages: newHistorical });
        addImagesToGallery([newUrl]);
    };

    const handleOptionChange = (field: keyof DressTheModelState['options'], value: string | boolean) => {
        onStateChange({ ...appState, options: { ...appState.options, [field]: value } });
    };

    const executeInitialGeneration = async () => {
        if (!appState.modelImage || !appState.clothingImage) return;
        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });
        try {
            // No need to transform options, the service handles '' and 'Tự động' correctly
            const resultUrl = await generateDressedModelImage(appState.modelImage, appState.clothingImage, appState.options);
            const settingsToEmbed = {
                viewId: 'dress-the-model',
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('dress-the-model