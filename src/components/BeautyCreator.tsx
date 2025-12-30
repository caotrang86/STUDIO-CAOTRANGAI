
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateBeautyImage, editImageWithPrompt } from '@/src/services/geminiService';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import Lightbox from './Lightbox';
import { 
    AppScreenHeader,
    ImageUploader,
    ResultsView,
    ImageForZip,
    OptionsPanel,
    type BeautyCreatorState,
    handleFileUpload,
    processAndDownloadAll,
    useAppControls,
    embedJsonInPng,
} from './uiUtils';
import { useLightbox, useVideoGeneration } from './uiHooks';

interface BeautyCreatorProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
    uploaderCaption: string;
    uploaderDescription: string;
    addImagesToGallery: (images: string[]) => void;
    appState: BeautyCreatorState;
    onStateChange: (newState: BeautyCreatorState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
    minIdeas: number;
    maxIdeas: number;
}

const BeautyCreator: React.FC<BeautyCreatorProps> = (props) => {
    const { 
        uploaderCaption, uploaderDescription, addImagesToGallery, 
        appState, onStateChange, onReset,
        logGeneration,
        ...headerProps 
    } = props;

    const { t, settings } = useAppControls();
    const { lightboxIndex, openLightbox, closeLightbox, navigateLightbox } = useLightbox();
    const { videoTasks, generateVideo } = useVideoGeneration();
    
    const generatedUrls = Object.values(appState.generatedImages as Record<string, any>)
        .map((img: any) => img.url)
        .filter((url): url is string => !!url);
        
    const lightboxImages = [appState.uploadedImage, appState.styleReferenceImage, ...generatedUrls, ...appState.historicalImages.map(h => h.url)].filter((img): img is string => !!img);

    const handleImageSelectedForUploader = (imageDataUrl: string) => {
        onStateChange({
            ...appState,
            stage: 'configuring',
            uploadedImage: imageDataUrl,
            generatedImages: {},
            historicalImages: [],
            error: null,
        });
        addImagesToGallery([imageDataUrl]);
    };

    const handleStyleReferenceImageChange = (imageDataUrl: string | null) => {
        onStateChange({
            ...appState,
            styleReferenceImage: imageDataUrl,
        });
        if (imageDataUrl) {
            addImagesToGallery([imageDataUrl]);
        }
    };

    const handleOptionChange = (field: keyof BeautyCreatorState['options'], value: string | boolean) => {
        onStateChange({
            ...appState,
            options: { ...appState.options, [field]: value }
        });
    };

    const executeInitialGeneration = async () => {
        if (!appState.uploadedImage) return;

        const ideasToUse = appState.selectedIdeas.length > 0 ? appState.selectedIdeas : [t('beautyCreator_randomConcept')];
        const preGenState = { ...appState };

        const newGeneratedImages = { ...appState.generatedImages };
        ideasToUse.forEach(idea => {
            newGeneratedImages[idea] = { status: 'pending' };
        });

        onStateChange({ 
            ...appState, 
            stage: 'generating', 
            generatedImages: newGeneratedImages,
            error: null 
        });

        ideasToUse.forEach(async (idea) => {
            try {
                let actualIdea = idea;
                const resultUrl = await generateBeautyImage(
                    appState.uploadedImage!, 
                    actualIdea, 
                    appState.options,
                    appState.styleReferenceImage
                );

                const settingsToEmbed = {
                    viewId: 'beauty-creator',
                    state: { ...appState, stage: 'configuring', generatedImages: {}, historicalImages: [], error: null },
                };
                const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
                logGeneration('beauty-creator', preGenState, urlWithMetadata);

                onStateChange((prevState) => ({
                    ...prevState,
                    generatedImages: {
                        ...prevState.generatedImages,
                        [idea]: { status: 'done', url: urlWithMetadata }
                    },
                    historicalImages: [
                        ...prevState.historicalImages,
                        { idea, url: urlWithMetadata }
                    ]
                }));
                addImagesToGallery([urlWithMetadata]);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Error generating image";
                onStateChange((prevState) => ({
                    ...prevState,
                    generatedImages: {
                        ...prevState.generatedImages,
                        [idea]: { status: 'error', error: errorMessage }
                    }
                }));
            }
        });
        
        onStateChange((prevState) => ({ ...prevState, stage: 'results' }));
    };

    const handleRegeneration = async (idea: string, prompt: string) => {
        const imageToEditState = appState.generatedImages[idea] as { status: string, url?: string } | undefined;
        if (!imageToEditState || imageToEditState.status !== 'done' || !imageToEditState.url) {
            return;
        }

        const imageUrlToEdit = imageToEditState.url;
        const preGenState = { ...appState };
        onStateChange({
            ...appState,
            generatedImages: {
                ...appState.generatedImages,
                [idea]: { status: 'pending', url: imageUrlToEdit }
            }
        });

        try {
             const resultUrl = await editImageWithPrompt(imageUrlToEdit, prompt, appState.options.aspectRatio, appState.options.removeWatermark);
             const settingsToEmbed = {
                viewId: 'beauty-creator',
                state: { ...appState, stage: 'configuring', generatedImages: {}, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('beauty-creator', preGenState, urlWithMetadata);

             onStateChange((prevState) => ({
                ...prevState,
                generatedImages: {
                    ...prevState.generatedImages,
                    [idea]: { status: 'done', url: urlWithMetadata }
                },
                historicalImages: [
                    ...prevState.historicalImages,
                    { idea, url: urlWithMetadata }
                ]
            }));
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error regenerating";
             onStateChange((prevState) => ({
                ...prevState,
                generatedImages: {
                    ...prevState.generatedImages,
                    [idea]: { status: 'error', error: errorMessage, url: imageUrlToEdit }
                }
            }));
        }
    };

    const handleUploadedImageChange = (newUrl: string | null) => {
        onStateChange({ ...appState, uploadedImage: newUrl, stage: newUrl ? 'configuring' : 'idle' });
        if (newUrl) {
            addImagesToGallery([newUrl]);
        }
    };

    const handleBackToOptions = () => {
        onStateChange({ ...appState, stage: 'configuring', error: null });
    };

    const handleDownloadAll = () => {
        const inputImages: ImageForZip[] = [];
        if (appState.uploadedImage) {
            inputImages.push({
                url: appState.uploadedImage,
                filename: 'anh-goc',
                folder: 'input',
            });
        }
        
        const results = Object.entries(appState.generatedImages as Record<string, any>)
            .filter(([_, val]) => val.status === 'done' && val.url)
            .map(([idea, val]) => ({ url: val.url!, idea }));
            
        processAndDownloadAll({
            inputImages,
            historicalImages: results,
            videoTasks,
            zipFilename: 'ket-qua-beauty.zip',
            baseOutputFilename: 'beauty',
        });
    };

    const isLoading = Object.values(appState.generatedImages as Record<string, any>).some(img => img.status === 'pending');

    return (
        <div className="flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
            <AnimatePresence>
                {(appState.stage === 'idle' || appState.stage === 'configuring') && (
                    <AppScreenHeader {...headerProps} />
                )}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center w-full flex-1">
                {appState.stage === 'idle' && (
                     <ImageUploader
                        onImageChange={handleImageSelectedForUploader}
                        uploaderCaption={uploaderCaption}
                        uploaderDescription={uploaderDescription}
                        placeholderType="person"
                    />
                )}

                {appState.stage === 'configuring' && appState.uploadedImage && (
                    <OptionsPanel>
                         <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-6">
                            <ActionablePolaroidCard
                                type="photo-input"
                                mediaUrl={appState.uploadedImage}
                                caption={t('common_originalImage')}
                                status="done"
                                onClick={() => openLightbox(0)}
                                onImageChange={handleUploadedImageChange}
                            />
                            
                            <ActionablePolaroidCard
                                type="style-input"
                                mediaUrl={appState.styleReferenceImage ?? undefined}
                                caption={t('beautyCreator_styleReferenceCaption')}
                                placeholderType="style"
                                status="done"
                                onImageChange={handleStyleReferenceImageChange}
                                onClick={appState.styleReferenceImage ? () => openLightbox(lightboxImages.indexOf(appState.styleReferenceImage!)) : undefined}
                            />
                        </div>

                         {!appState.styleReferenceImage && (
                             <div className="space-y-2">
                                <label className="base-font font-bold text-lg text-neutral-200">{t('beautyCreator_ideaLabel')}</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        className={`px-3 py-1 rounded-full text-sm border ${appState.selectedIdeas.includes(t('beautyCreator_randomConcept')) ? 'bg-yellow-400 text-black border-yellow-400' : 'text-neutral-300 border-neutral-600 hover:border-yellow-400'}`}
                                        onClick={() => onStateChange({ ...appState, selectedIdeas: [t('beautyCreator_randomConcept')] })}
                                    >
                                        {t('beautyCreator_randomConcept')}
                                    </button>
                                </div>
                             </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_aspectRatio')}</label>
                                <select 
                                    value={appState.options.aspectRatio} 
                                    onChange={(e) => handleOptionChange('aspectRatio', e.target.value)} 
                                    className="form-input"
                                >
                                    {['Giữ nguyên', '1:1', '3:4', '4:3', '9:16', '16:9'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                             </div>
                              <div className="flex items-center pt-8">
                                <input
                                    type="checkbox"
                                    id="remove-watermark"
                                    checked={appState.options.removeWatermark}
                                    onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                />
                                <label htmlFor="remove-watermark" className="ml-3 block text-sm font-medium text-neutral-300">
                                    {t('common_removeWatermark')}
                                </label>
                            </div>
                         </div>
                         
                         <div>
                            <label className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_additionalNotes')}</label>
                            <textarea
                                value={appState.options.notes}
                                onChange={(e) => handleOptionChange('notes', e.target.value)}
                                className="form-input h-20"
                                placeholder={t('beautyCreator_notesPlaceholder')}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-4 pt-4">
                            <button onClick={onReset} className="btn btn-secondary">
                                {t('common_changeImage')}
                            </button>
                            <button 
                                onClick={executeInitialGeneration} 
                                className="btn btn-primary"
                                disabled={isLoading || (!appState.styleReferenceImage && appState.selectedIdeas.length === 0)}
                            >
                                {isLoading ? t('common_creating') : t('beautyCreator_createButton')}
                            </button>
                        </div>
                    </OptionsPanel>
                )}
            </div>

            {(appState.stage === 'generating' || appState.stage === 'results') && (
                <ResultsView
                    stage={appState.stage}
                    originalImage={appState.uploadedImage}
                    onOriginalClick={() => openLightbox(0)}
                    error={appState.error}
                    actions={
                        <>
                             {Object.values(appState.generatedImages as Record<string, any>).some(img => img.status === 'done') && (
                                <button onClick={handleDownloadAll} className="btn btn-secondary">
                                    {t('common_downloadAll')}
                                </button>
                            )}
                            <button onClick={handleBackToOptions} className="btn btn-secondary">
                                {t('common_editOptions')}
                            </button>
                            <button onClick={onReset} className="btn btn-secondary">
                                {t('common_startOver')}
                            </button>
                        </>
                    }
                >
                    {Object.entries(appState.generatedImages as Record<string, any>).map(([idea, result], index) => (
                         <motion.div
                            className="w-full md:w-auto flex-shrink-0"
                            key={idea}
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.15 + index * 0.1 }}
                        >
                            <ActionablePolaroidCard
                                type="output"
                                caption={idea}
                                status={result.status}
                                mediaUrl={result.url}
                                error={result.error}
                                onClick={result.url ? () => openLightbox(lightboxImages.indexOf(result.url!)) : undefined}
                                onRegenerate={(prompt) => handleRegeneration(idea, prompt)}
                                onGenerateVideoFromPrompt={result.url ? (prompt) => generateVideo(result.url!, prompt) : undefined}
                                regenerationTitle={t('common_regenTitle')}
                                regenerationDescription={t('common_regenDescription')}
                                regenerationPlaceholder={t('beautyCreator_regenPlaceholder')}
                            />
                        </motion.div>
                    ))}
                    {appState.historicalImages.map(({ url: sourceUrl }) => {
                        const videoTask = videoTasks[sourceUrl];
                        if (!videoTask) return null;
                        return (
                            <motion.div
                                className="w-full md:w-auto flex-shrink-0"
                                key={`${sourceUrl}-video`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                            >
                                <ActionablePolaroidCard
                                    type="output"
                                    caption={t('common_video')}
                                    status={videoTask.status}
                                    mediaUrl={videoTask.resultUrl}
                                    error={videoTask.error}
                                    onClick={videoTask.resultUrl ? () => openLightbox(lightboxImages.indexOf(videoTask.resultUrl!)) : undefined}
                                    isMobile={isMobile}
                                />
                            </motion.div>
                        );
                    })}
                </ResultsView>
            )}

            <Lightbox
                images={lightboxImages}
                selectedIndex={lightboxIndex}
                onClose={closeLightbox}
                onNavigate={navigateLightbox}
            />
        </div>
    );
};

export default BeautyCreator;
