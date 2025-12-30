/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateToyModelImage, editImageWithPrompt } from '@/src/services/geminiService';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import Lightbox from './Lightbox';
import { 
    AppScreenHeader,
    ImageUploader,
    ResultsView,
    type ImageForZip,
    OptionsPanel,
    type ToyModelCreatorState,
    handleFileUpload,
    processAndDownloadAll,
    SearchableSelect,
    useAppControls,
    embedJsonInPng,
} from './uiUtils';
import { useLightbox, useVideoGeneration } from './uiHooks';

interface ToyModelCreatorProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
    uploaderCaption: string;
    uploaderDescription: string;
    addImagesToGallery: (images: string[]) => void;
    appState: ToyModelCreatorState;
    onStateChange: (newState: ToyModelCreatorState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}

// Define concepts data locally if not available globally
const CONCEPTS_DATA = {
    desktop_model: {
        label: "Mô hình để bàn",
        options: [
            { id: "computerType", label: "Loại máy tính", options: ["iMac", "Gaming PC", "Laptop", "Màn hình cong"] },
            { id: "softwareType", label: "Phần mềm", options: ["Blender", "Maya", "ZBrush", "Photoshop", "Unreal Engine"] },
            { id: "boxType", label: "Loại hộp", options: ["Hộp bìa cứng", "Hộp nhựa trong", "Hộp gỗ", "Không có hộp"] },
            { id: "background", label: "Phông nền", options: ["Sân vận động", "Thành phố", "Rừng rậm", "Vũ trụ"] }
        ]
    },
    keychain: {
        label: "Móc khoá",
        options: [
            { id: "keychainMaterial", label: "Chất liệu", options: ["Nhựa", "Kim loại", "Gỗ", "Mica"] },
            { id: "keychainStyle", label: "Phong cách", options: ["Chibi", "Realistic", "Pixel Art"] },
            { id: "accompanyingItems", label: "Vật dụng đi kèm", options: ["Chìa khóa", "Ví", "Balo", "Điện thoại"] },
            { id: "deskSurface", label: "Bề mặt bàn", options: ["Gỗ", "Đá", "Kính", "Vải"] }
        ]
    },
    gachapon: {
        label: "Gachapon",
        options: [
            { id: "capsuleColor", label: "Màu viên nang", options: ["Trong suốt", "Đỏ", "Xanh", "Vàng"] },
            { id: "modelFinish", label: "Hoàn thiện mô hình", options: ["Bóng", "Mờ", "Kim loại"] },
            { id: "capsuleContents", label: "Nội dung viên nang", options: ["Mô hình nhân vật", "Phụ kiện", "Sticker"] },
            { id: "displayLocation", label: "Nơi trưng bày", options: ["Máy bán hàng tự động", "Kệ trưng bày", "Bàn làm việc"] }
        ]
    },
    miniature: {
        label: "Tượng nhỏ",
        options: [
            { id: "miniatureMaterial", label: "Chất liệu tượng", options: ["Resin", "Đất sét", "Đồng", "Đá"] },
            { id: "baseMaterial", label: "Chất liệu đế", options: ["Gỗ", "Đá cẩm thạch", "Kim loại"] },
            { id: "baseShape", label: "Hình dạng đế", options: ["Tròn", "Vuông", "Lục giác"] },
            { id: "lightingStyle", label: "Ánh sáng", options: ["Studio", "Tự nhiên", "Kịch tính"] }
        ]
    },
    pokemon_model: {
        label: "Mô hình Pokémon",
        options: [
            { id: "pokeballType", label: "Loại Pokéball", options: ["Poké Ball", "Great Ball", "Ultra Ball", "Master Ball"] },
            { id: "evolutionDisplay", label: "Hiển thị tiến hóa", options: ["Không hiển thị", "Một dạng tiến hoá", "Toàn bộ chuỗi tiến hoá"] },
            { id: "modelStyle", label: "Phong cách mô hình", options: ["Realistic", "Cartoon", "Low-poly"] }
        ]
    },
    crafting_model: {
        label: "Mô hình chế tác",
        options: [
            { id: "modelType", label: "Loại mô hình", options: ["Tượng", "Lắp ráp", "Điêu khắc"] },
            { id: "blueprintType", label: "Loại bản vẽ", options: ["Giấy xanh", "Kỹ thuật số", "Phác thảo tay"] },
            { id: "characterMood", label: "Tâm trạng nhân vật", options: ["Tập trung", "Vui vẻ", "Tự hào"] }
        ]
    }
};

const ToyModelCreator: React.FC<ToyModelCreatorProps> = (props) => {
    const { 
        uploaderCaption, uploaderDescription, addImagesToGallery, 
        appState, onStateChange, onReset, onGoBack,
        logGeneration,
        ...headerProps 
    } = props;
    
    const { t, settings } = useAppControls();
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
    
    const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e, handleImageSelectedForUploader);
    }, [appState, onStateChange]);
    
    const handleOptionChange = (field: string, value: string | boolean) => {
        onStateChange({
            ...appState,
            options: {
                ...appState.options,
                [field]: value
            }
        });
    };
    
    const handleConceptChange = (concept: string) => {
        // Reset options relevant to the new concept if needed, or keep shared ones
        onStateChange({
            ...appState,
            concept,
            // You might want to reset specific options here based on the concept
        });
    };

    const executeInitialGeneration = async () => {
        if (!appState.uploadedImage) return;
        
        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await generateToyModelImage(appState.uploadedImage, appState.concept, appState.options);
            const settingsToEmbed = { 
                viewId: 'toy-model-creator', 
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('toy-model-creator', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };

    const handleRegeneration = async (prompt: string) => {
        if (!appState.generatedImage) return;

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await editImageWithPrompt(appState.generatedImage, prompt);
             const settingsToEmbed = { 
                viewId: 'toy-model-creator', 
                state: { ...appState, stage: 'configuring', generatedImage: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('toy-model-creator', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
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
            zipFilename: 'ket-qua-mo-hinh-do-choi.zip',
            baseOutputFilename: 'mo-hinh-do-choi',
        });
    };
    
    const isLoading = appState.stage === 'generating';

    const currentConceptData: any = CONCEPTS_DATA[appState.concept as keyof typeof CONCEPTS_DATA] || CONCEPTS_DATA.desktop_model;

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
                        placeholderType="magic"
                    />
                )}

                {appState.stage === 'configuring' && appState.uploadedImage && (
                    <motion.div
                        className="flex flex-col items-center gap-8 w-full max-w-6xl py-6 overflow-y-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex-shrink-0">
                            <ActionablePolaroidCard
                                type="content-input"
                                mediaUrl={appState.uploadedImage}
                                caption={t('common_originalImage')}
                                status="done"
                                onClick={() => openLightbox(0)}
                                onImageChange={handleUploadedImageChange}
                            />
                        </div>

                        <OptionsPanel>
                            <h2 className="base-font font-bold text-2xl text-yellow-400 border-b border-yellow-400/20 pb-2">{t('common_options')}</h2>
                            
                            <div>
                                <label htmlFor="concept" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('toyModelCreator_conceptLabel')}</label>
                                <select 
                                    id="concept" 
                                    value={appState.concept} 
                                    onChange={(e) => handleConceptChange(e.target.value)} 
                                    className="form-input"
                                >
                                    {Object.entries(CONCEPTS_DATA).map(([key, data]) => (
                                        <option key={key} value={key}>{data.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                {currentConceptData.options.map((opt: any) => (
                                    <SearchableSelect
                                        key={opt.id}
                                        id={opt.id}
                                        label={opt.label}
                                        options={opt.options}
                                        value={(appState.options as any)[opt.id] || ''}
                                        onChange={(value) => handleOptionChange(opt.id, value)}
                                        placeholder={`Chọn ${opt.label.toLowerCase()}...`}
                                    />
                                ))}
                            </div>

                             <div>
                                <label htmlFor="aspect-ratio" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_aspectRatio')}</label>
                                <select 
                                    value={appState.options.aspectRatio} 
                                    onChange={(e) => handleOptionChange('aspectRatio', e.target.value)} 
                                    className="form-input"
                                >
                                    {['Giữ nguyên', '1:1', '3:4', '4:3', '9:16', '16:9'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                             </div>

                            <div className="pt-2">
                                <label htmlFor="notes" className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">{t('common_additionalNotes')}</label>
                                <textarea
                                    id="notes"
                                    value={localNotes}
                                    onChange={(e) => setLocalNotes(e.target.value)}
                                    onBlur={() => {
                                        if (localNotes !== appState.options.notes) {
                                            handleOptionChange('notes', localNotes);
                                        }
                                    }}
                                    placeholder={t('toyModelCreator_notesPlaceholder')}
                                    className="form-input h-24"
                                    rows={3}
                                />
                            </div>
                             <div className="flex items-center pt-2">
                                <input
                                    type="checkbox"
                                    id="remove-watermark-toy"
                                    checked={appState.options.removeWatermark}
                                    onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                    aria-label={t('common_removeWatermark')}
                                />
                                <label htmlFor="remove-watermark-toy" className="ml-3 block text-sm font-medium text-neutral-300">
                                    {t('common_removeWatermark')}
                                </label>
                            </div>
                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button onClick={onReset} className="btn btn-secondary">
                                    {t('common_changeImage')}
                                </button>
                                <button 
                                    onClick={executeInitialGeneration} 
                                    className="btn btn-primary"
                                    disabled={isLoading}
                                >
                                    {isLoading ? t('common_creating') : t('toyModelCreator_createButton')}
                                </button>
                            </div>
                        </OptionsPanel>
                    </motion.div>
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
                            {appState.generatedImage && !appState.error && (
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
                    <motion.div
                        className="w-full md:w-auto flex-shrink-0"
                        key="generated-toy"
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
                            onClick={!appState.error && appState.generatedImage ? () => openLightbox(lightboxImages.indexOf(appState.generatedImage!)) : undefined}
                            onImageChange={handleGeneratedImageChange}
                            onRegenerate={handleRegeneration}
                            onGenerateVideoFromPrompt={(prompt) => appState.generatedImage && generateVideo(appState.generatedImage, prompt)}
                            regenerationTitle={t('common_regenTitle')}
                            regenerationDescription={t('common_regenDescription')}
                            regenerationPlaceholder={t('toyModelCreator_regenPlaceholder')}
                        />
                    </motion.div>
                    {appState.historicalImages.map(sourceUrl => {
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

export default ToyModelCreator;