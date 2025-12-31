/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { generateSpring2026Image, editImageWithPrompt } from '../services/geminiService';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import Lightbox from './Lightbox';
import { 
    AppScreenHeader,
    ImageUploader,
    ResultsView,
    ImageForZip,
    AppOptionsLayout,
    OptionsPanel,
    type Spring2026CreatorState,
    useLightbox,
    useVideoGeneration,
    processAndDownloadAll,
    useAppControls,
    embedJsonInPng,
} from './uiUtils';
import { getCurrentUsername, getUserCredits, decreaseUserCredits } from '../lib/credits';

interface Spring2026CreatorProps {
    mainTitle: string;
    subtitle: string;
    uploaderCaption: string;
    uploaderDescription: string;
    addImagesToGallery: (images: string[]) => void;
    appState: Spring2026CreatorState;
    onStateChange: (newState: Spring2026CreatorState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}

const Spring2026Creator: React.FC<Spring2026CreatorProps> = (props) => {
    const { 
        mainTitle, subtitle, uploaderCaption, uploaderDescription,
        addImagesToGallery,
        appState, onStateChange, onReset,
        logGeneration,
    } = props;
    
    const { t, settings, refreshCredits } = useAppControls();
    const { lightboxIndex, openLightbox, closeLightbox, navigateLightbox } = useLightbox();
    const { videoTasks, generateVideo } = useVideoGeneration();
    const [localNotes, setLocalNotes] = useState(appState.options.notes);

    useEffect(() => {
        setLocalNotes(appState.options.notes);
    }, [appState.options.notes]);

    const lightboxImages = [appState.uploadedImage, ...appState.historicalImages].filter((img): img is string => !!img);

    const handleImageSelectedForUploader = (imageDataUrl: string) => {
        onStateChange({
            ...appState,
            stage: 'configuring',
            uploadedImage: imageDataUrl,
            generatedImage: null,
            historicalImages: [],
            error: null,
        });
        addImagesToGallery([imageDataUrl]);
    };

    const handleUploadedImageChange = (newUrl: string | null) => {
        onStateChange({ ...appState, uploadedImage: newUrl, stage: newUrl ? 'configuring' : 'idle' });
        if (newUrl) {
            addImagesToGallery([newUrl]);
        }
    };

    const handleGeneratedImageChange = (newUrl: string) => {
        const newHistorical = [...appState.historicalImages, newUrl];
        onStateChange({ ...appState, stage: 'results', generatedImage: newUrl, historicalImages: newHistorical });
        addImagesToGallery([newUrl]);
    };

    const handleOptionChange = (field: keyof Spring2026CreatorState['options'], value: string | boolean) => {
        onStateChange({
            ...appState,
            options: { ...appState.options, [field]: value }
        });
    };

    const executeInitialGeneration = async () => {
        if (!appState.uploadedImage) return;

        // --- Credit Check ---
        const username = getCurrentUsername();
        if (!username) { toast.error("Vui lòng đăng nhập."); return; }
        if (getUserCredits(username) <= 0) { 
            toast.error(t('spring2026.error_no_credits')); 
            return; 
        }
        // --------------------

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await generateSpring2026Image(appState.uploadedImage, appState.options);
            
            // Deduct Credit
            decreaseUserCredits(username);
            refreshCredits();
            toast.success(t('spring2026.status_ready'));

            const settingsToEmbed = {
                viewId: 'spring2026Creator',
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            
            logGeneration('spring2026Creator', preGenState, urlWithMetadata);
            
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('spring2026.error_generic');
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };

    const handleRegeneration = async (prompt: string) => {
        if (!appState.generatedImage) return;

        const username = getCurrentUsername();
        if (!username) { toast.error("Vui lòng đăng nhập."); return; }
        if (getUserCredits(username) <= 0) { 
            toast.error(t('spring2026.error_no_credits')); 
            return; 
        }

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await editImageWithPrompt(appState.generatedImage, prompt);
            
            decreaseUserCredits(username);
            refreshCredits();
            toast.success(t('spring2026.status_ready'));

            const settingsToEmbed = {
                viewId: 'spring2026Creator',
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('spring2026Creator', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('spring2026.error_generic');
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
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
        
        processAndDownloadAll({
            inputImages,
            historicalImages: appState.historicalImages,
            videoTasks,
            zipFilename: 'anh-xuan-2026.zip',
            baseOutputFilename: 'xuan-2026',
        });
    };

    const isLoading = appState.stage === 'generating';

    // Helper for rendering selects to reduce clutter
    const renderSelectGroup = (id: string, labelKey: string, options: {value: string, labelKey: string}[]) => (
        <div className="flex-1 min-w-[140px]">
            <label htmlFor={id} className="block text-left base-font font-bold text-sm text-neutral-300 mb-1">
                {t(labelKey)}
            </label>
            <select
                id={id}
                value={(appState.options as any)[id]}
                onChange={(e) => handleOptionChange(id as any, e.target.value)}
                className="form-input !py-1.5 !text-sm"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
            <AnimatePresence>
                {(appState.stage === 'idle' || appState.stage === 'configuring') && (
                    <AppScreenHeader 
                        mainTitle={mainTitle}
                        subtitle={subtitle}
                        useSmartTitleWrapping={true}
                        smartTitleWrapWords={2}
                    />
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
                    <AppOptionsLayout>
                        <div className="flex-shrink-0">
                             <ActionablePolaroidCard
                                type="content-input"
                                mediaUrl={appState.uploadedImage}
                                caption={t('common_originalImage')}
                                status="done"
                                onClick={() => openLightbox(lightboxImages.indexOf(appState.uploadedImage!))}
                                onImageChange={handleUploadedImageChange}
                            />
                        </div>
                        <OptionsPanel>
                            <h2 className="base-font font-bold text-2xl text-yellow-400 border-b border-yellow-400/20 pb-2">{t('spring2026.options_title')}</h2>
                            
                            {/* Row 1: Gender & Pose */}
                            <div className="flex flex-wrap gap-4">
                                {renderSelectGroup('gender', 'spring2026.gender_label', [
                                    { value: 'female', labelKey: 'spring2026.gender_female' },
                                    { value: 'male', labelKey: 'spring2026.gender_male' },
                                    { value: 'girl', labelKey: 'spring2026.gender_girl' },
                                    { value: 'boy', labelKey: 'spring2026.gender_boy' }
                                ])}
                                {renderSelectGroup('pose', 'spring2026.pose_label', [
                                    { value: 'fan_single', labelKey: 'spring2026.pose_fan_single' },
                                    { value: 'fan_double', labelKey: 'spring2026.pose_fan_double' },
                                    { value: 'closeup', labelKey: 'spring2026.pose_closeup' },
                                    { value: 'side_smile', labelKey: 'spring2026.pose_side_smile' }
                                ])}
                            </div>

                            {/* Row 2: Outfit & Scene */}
                            <div className="flex flex-wrap gap-4">
                                {renderSelectGroup('outfit', 'spring2026.outfit_label', [
                                    { value: 'ao_dai_classic', labelKey: 'spring2026.outfit_ao_dai_classic' },
                                    { value: 'ao_dai_crane', labelKey: 'spring2026.outfit_ao_dai_crane' },
                                    { value: 'ao_dai_dragon', labelKey: 'spring2026.outfit_ao_dai_dragon' },
                                    { value: 'ao_dai_kid', labelKey: 'spring2026.outfit_ao_dai_kid' }
                                ])}
                                {renderSelectGroup('scene', 'spring2026.scene_label', [
                                    { value: 'studio_red', labelKey: 'spring2026.scene_studio_red' },
                                    { value: 'lanterns', labelKey: 'spring2026.scene_lanterns' },
                                    { value: 'flowers', labelKey: 'spring2026.scene_flowers' },
                                    { value: 'lucky_decor', labelKey: 'spring2026.scene_lucky_decor' }
                                ])}
                            </div>

                            {/* Row 3: Text & Aspect Ratio */}
                            <div className="flex flex-wrap gap-4">
                                {renderSelectGroup('textOverlay', 'spring2026.text_overlay_label', [
                                    { value: 'none', labelKey: 'spring2026.text_overlay_none' },
                                    { value: 'hny_en', labelKey: 'spring2026.text_overlay_hny_en' },
                                    { value: 'hny_vi', labelKey: 'spring2026.text_overlay_hny_vi' }
                                ])}
                                {renderSelectGroup('aspectRatio', 'spring2026.aspect_ratio_label', [
                                    { value: '3:4', labelKey: 'spring2026.aspect_ratio_3_4' },
                                    { value: '2:3', labelKey: 'spring2026.aspect_ratio_2_3' },
                                    { value: '16:9', labelKey: 'spring2026.aspect_ratio_16_9' },
                                    { value: 'Giữ nguyên', labelKey: 'common_aspectRatio' }
                                ])}
                            </div>

                            {/* Row 4: Detail Level */}
                             <div className="flex flex-wrap gap-4">
                                {renderSelectGroup('detailLevel', 'spring2026.detail_label', [
                                    { value: 'normal', labelKey: 'spring2026.detail_normal' },
                                    { value: 'high', labelKey: 'spring2026.detail_high' },
                                    { value: 'ultra', labelKey: 'spring2026.detail_ultra' }
                                ])}
                            </div>

                            <div>
                                <label htmlFor="notes" className="block text-left base-font font-bold text-sm text-neutral-300 mb-1">{t('spring2026.prompt_label')}</label>
                                <textarea
                                    id="notes"
                                    value={localNotes}
                                    onChange={(e) => setLocalNotes(e.target.value)}
                                    onBlur={() => {
                                        if (localNotes !== appState.options.notes) {
                                            handleOptionChange('notes', localNotes);
                                        }
                                    }}
                                    placeholder={t('spring2026.prompt_placeholder')}
                                    className="form-input h-20 !text-sm"
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center pt-2">
                                <input
                                    type="checkbox"
                                    id="remove-watermark-spring"
                                    checked={appState.options.removeWatermark}
                                    onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                    aria-label={t('common_removeWatermark')}
                                />
                                <label htmlFor="remove-watermark-spring" className="ml-3 block text-sm font-medium text-neutral-300">
                                    {t('common_removeWatermark')}
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button onClick={onReset} className="btn btn-secondary">{t('common_changeImage')}</button>
                                <button onClick={executeInitialGeneration} className="btn btn-primary" disabled={isLoading}>{isLoading ? t('spring2026.status_generating') : t('spring2026.button_generate')}</button>
                            </div>
                        </OptionsPanel>
                    </AppOptionsLayout>
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
                            {appState.generatedImage && !appState.error && (<button onClick={handleDownloadAll} className="btn btn-secondary">{t('common_downloadAll')}</button>)}
                            <button onClick={handleBackToOptions} className="btn btn-secondary">{t('common_editOptions')}</button>
                            <button onClick={onReset} className="btn btn-secondary">{t('common_startOver')}</button>
                        </>
                    }
                >
                    <motion.div
                        className="w-full md:w-auto flex-shrink-0"
                        key="generated-spring"
                        initial={{ opacity: 0, scale: 0.5, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.15 }}
                    >
                        <ActionablePolaroidCard
                            type="output"
                            caption={t('common_result')}
                            status={isLoading ? 'pending' : (appState.error ? 'error' : 'done')}
                            mediaUrl={appState.generatedImage ?? undefined}
                            error={appState.error ?? undefined}
                            onImageChange={handleGeneratedImageChange}
                            onRegenerate={handleRegeneration}
                            onGenerateVideoFromPrompt={(prompt) => appState.generatedImage && generateVideo(appState.generatedImage, prompt)}
                            regenerationTitle={t('common_regenTitle')}
                            regenerationDescription={t('common_regenDescription')}
                            regenerationPlaceholder={t('spring2026.regen_placeholder')}
                            onClick={!appState.error && appState.generatedImage ? () => openLightbox(lightboxImages.indexOf(appState.generatedImage!)) : undefined}
                        />
                    </motion.div>
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

export default Spring2026Creator;