/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useCallback, ChangeEvent, memo, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import PolaroidCard from './PolaroidCard';
import { handleFileUpload, downloadImage, downloadJson } from './uiFileUtilities';
import { RegenerationModal, GalleryPicker, WebcamCaptureModal, renderSmartlyWrappedTitle } from './uiComponents';
import { useImageEditor, useAppControls } from './uiContexts';
import { AvatarCreatorState, BabyPhotoCreatorState } from './uiTypes';

// NEW: More descriptive card types to centralize logic
type CardType =
  | 'uploader'          // Generic uploader placeholder for any image type
  | 'photo-input'       // An input that is specifically a user's photograph (e.g., for an avatar)
  | 'sketch-input'      // An input that is a sketch or architectural drawing
  | 'clothing-input'    // An input for a clothing item
  | 'content-input'     // A generic content image for styling or transformation
  | 'style-input'       // An image used for its artistic style
  | 'multi-input'       // A flexible input used in free-form generation
  | 'output'            // A generated result from the AI
  | 'display';          // A read-only card with no actions

interface ActionablePolaroidCardProps {
    // Core PolaroidCard props
    mediaUrl?: string;
    caption: string;
    status: 'pending' | 'done' | 'error';
    error?: string;
    placeholderType?: 'person' | 'architecture' | 'clothing' | 'magic' | 'style';
    isMobile?: boolean;
    onClick?: () => void;
    
    // Role-based prop to determine which buttons to show
    type: CardType;

    // Callbacks for actions
    onImageChange?: (imageDataUrl: string | null) => void;
    onRegenerate?: (prompt: string) => void;
    onGenerateVideoFromPrompt?: (prompt: string) => void;
    
    // Props for modals
    regenerationTitle?: string;
    regenerationDescription?: string;
    regenerationPlaceholder?: string;
}


export const ActionablePolaroidCard: React.FC<ActionablePolaroidCardProps> = memo(({
    mediaUrl,
    caption,
    status,
    error,
    placeholderType,
    isMobile,
    onClick,
    type,
    onImageChange,
    onRegenerate,
    onGenerateVideoFromPrompt,
    regenerationTitle,
    regenerationDescription,
    regenerationPlaceholder,
}) => {
    const { openImageEditor } = useImageEditor();
    const { imageGallery, t, settings } = useAppControls();
    const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
    const [isGalleryPickerOpen, setGalleryPickerOpen] = useState(false);
    const [isWebcamModalOpen, setWebcamModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // --- Determine button visibility based on the card's role (type) ---
    const isDownloadable = type === 'output';
    const isEditable = type !== 'uploader' && type !== 'display';
    const isClearable = type !== 'output' && type !== 'display' && !!mediaUrl && onImageChange;
    const isSwappable = type !== 'output' && type !== 'display';
    const isRegeneratable = type === 'output';
    const isGallerySelectable = type !== 'output' && type !== 'display';
    const isWebcamSelectable = settings?.enableWebcam && type !== 'output' && type !== 'display';
    
    const handleFileSelected = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (onImageChange) {
            const onUploadWrapper = (newUrl: string) => {
                onImageChange(newUrl);
            };
            handleFileUpload(e, onUploadWrapper);
        }
    }, [onImageChange]);

    const handleFile = useCallback((file: File) => {
        if (onImageChange && file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    onImageChange(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    }, [onImageChange]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const handleSwapClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleEditClick = useCallback(() => {
        if (mediaUrl && onImageChange) {
            const onSaveWrapper = (newUrl: string) => {
                onImageChange(newUrl);
            };
            openImageEditor(mediaUrl, onSaveWrapper);
        }
    }, [mediaUrl, onImageChange, openImageEditor]);
    
    const handleClearClick = useCallback(() => {
        if (onImageChange) {
            onImageChange(null);
        }
    }, [onImageChange]);
    
    const handleRegenerateClick = useCallback(() => {
        setIsRegenModalOpen(true);
    }, []);

    const handleConfirmImage = useCallback((prompt: string) => {
        setIsRegenModalOpen(false);
        if (onRegenerate) {
            onRegenerate(prompt);
        }
    }, [onRegenerate]);

    const handleConfirmVideo = useCallback((prompt: string) => {
        setIsRegenModalOpen(false);
        if (onGenerateVideoFromPrompt) {
            onGenerateVideoFromPrompt(prompt);
        }
    }, [onGenerateVideoFromPrompt]);

    const handleDownloadClick = useCallback(() => {
        if (mediaUrl) {
            const filename = `${caption.replace(/[\s()]/g, '-')}`;
            downloadImage(mediaUrl, filename);
        }
    }, [mediaUrl, caption]);

    const handleOpenGalleryPicker = useCallback(() => {
        setGalleryPickerOpen(true);
    }, []);

    const handleGalleryImageSelect = (selectedImageUrl: string) => {
        if (onImageChange) {
            onImageChange(selectedImageUrl);
        }
        setGalleryPickerOpen(false);
    };

    const handleOpenWebcam = useCallback(() => {
        setWebcamModalOpen(true);
    }, []);

    const handleWebcamCapture = (imageDataUrl: string) => {
        if (onImageChange) {
            onImageChange(imageDataUrl);
        }
        setWebcamModalOpen(false);
    };

    // Determine the primary click action for the card.
    // If it's an uploader, or has no media, its main job is to trigger the file input.
    // Otherwise, use the provided onClick handler (e.g., for opening a lightbox).
    const effectiveOnClick = !mediaUrl || type === 'uploader' ? handleSwapClick : onClick;

    const showButtons = status === 'done' && mediaUrl;
    const canDoSomething = isRegeneratable || !!onGenerateVideoFromPrompt;

    return (
        <>
            {(isSwappable || isGallerySelectable) && (
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelected}
                    // Reset value to allow re-uploading the same file
                    onClick={(e) => (e.currentTarget.value = '')}
                />
            )}
            <PolaroidCard
                mediaUrl={mediaUrl}
                caption={caption}
                status={status}
                error={error}
                placeholderType={placeholderType}
                isMobile={isMobile}
                onClick={effectiveOnClick}
                onDownload={showButtons && isDownloadable ? handleDownloadClick : undefined}
                onEdit={showButtons && isEditable ? handleEditClick : undefined}
                onClear={isClearable ? handleClearClick : undefined}
                onSwapImage={isSwappable ? handleSwapClick : undefined}
                onSelectFromGallery={isGallerySelectable ? handleOpenGalleryPicker : undefined}
                onCaptureFromWebcam={isWebcamSelectable ? handleOpenWebcam : undefined}
                onShake={showButtons && canDoSomething ? handleRegenerateClick : undefined}
                isDraggingOver={isDraggingOver}
                onDragOver={isSwappable ? handleDragOver : undefined}
                onDragLeave={isSwappable ? handleDragLeave : undefined}
                onDrop={isSwappable ? handleDrop : undefined}
            />
            {canDoSomething && (
                <RegenerationModal
                    isOpen={isRegenModalOpen}
                    onClose={() => setIsRegenModalOpen(false)}
                    onConfirmImage={handleConfirmImage}
                    onConfirmVideo={onGenerateVideoFromPrompt ? handleConfirmVideo : undefined}
                    itemToModify={caption}
                    title={regenerationTitle || t('regenerationModal_title')}
                    description={regenerationDescription || t('regenerationModal_description')}
                    placeholder={regenerationPlaceholder || t('regenerationModal_placeholder')}
                />
            )}
            <GalleryPicker
                isOpen={isGalleryPickerOpen}
                onClose={() => setGalleryPickerOpen(false)}
                onSelect={handleGalleryImageSelect}
                images={imageGallery}
            />
            <WebcamCaptureModal
                isOpen={isWebcamModalOpen}
                onClose={() => setWebcamModalOpen(false)}
                onCapture={handleWebcamCapture}
            />
        </>
    );
});

export default ActionablePolaroidCard;

// --- Moved Components from uiComponents.tsx ---

interface AppScreenHeaderProps {
    mainTitle: string;
    subtitle: string;
    useSmartTitleWrapping: boolean;
    smartTitleWrapWords: number;
}

export const AppScreenHeader: React.FC<AppScreenHeaderProps> = ({ mainTitle, subtitle, useSmartTitleWrapping, smartTitleWrapWords }) => (
     <motion.div
        className="text-center mb-8"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
    >
        <h1 className="text-5xl/[1.3] md:text-7xl/[1.3] title-font font-bold text-white [text-shadow:1px_1px_3px_rgba(0,0,0,0.4)] tracking-wider">
            {renderSmartlyWrappedTitle(mainTitle, useSmartTitleWrapping, smartTitleWrapWords)}
        </h1>
        <p className="sub-title-font font-bold text-neutral-200 mt-2 text-xl tracking-wide">{subtitle}</p>
    </motion.div>
);

interface ImageUploaderProps {
    onImageChange: (imageDataUrl: string) => void;
    uploaderCaption: string;
    uploaderDescription: string;
    placeholderType?: 'person' | 'architecture' | 'clothing' | 'magic' | 'style';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageChange, uploaderCaption, uploaderDescription, placeholderType = 'person' }) => {
    return (
        <div className="flex flex-col items-center justify-center w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                 <ActionablePolaroidCard
                    type="uploader"
                    caption={uploaderCaption}
                    status="done"
                    mediaUrl={undefined}
                    placeholderType={placeholderType}
                    onImageChange={onImageChange}
                />
            </motion.div>
            <p className="mt-8 base-font font-bold text-neutral-300 text-center max-w-lg text-lg">
                {uploaderDescription}
            </p>
        </div>
    );
};


interface ResultsViewProps {
    stage: 'generating' | 'results';
    originalImage?: string | null;
    onOriginalClick?: () => void;
    inputImages?: { url: string; caption: string; onClick: () => void; }[];
    children: React.ReactNode;
    actions: React.ReactNode;
    isMobile?: boolean;
    error?: string | null;
    hasPartialError?: boolean;
}


export const ResultsView: React.FC<ResultsViewProps> = ({ stage, originalImage, onOriginalClick, inputImages, children, actions, isMobile, error, hasPartialError }) => {
    const { currentView, t, viewHistory } = useAppControls();

    useEffect(() => {
        if (hasPartialError && stage === 'results') {
            toast.error("Một hoặc nhiều ảnh đã không thể tạo thành công.");
        }
    }, [hasPartialError, stage]);
    
    const finalInputImages = useMemo(() => {
        if (inputImages && inputImages.length > 0) {
            return inputImages;
        }
        if (originalImage) {
            return [{ url: originalImage, caption: t('common_originalImage'), onClick: onOriginalClick || (() => {}) }];
        }
        return [];
    }, [inputImages, originalImage, onOriginalClick, t]);


    const getExportableState = (state: any) => {
        const exportableState = JSON.parse(JSON.stringify(state));

        // NEW: Intelligently find the pre-generation state to ensure "Random" is correctly saved.
        if (currentView.viewId === 'avatar-creator' || currentView.viewId === 'baby-photo-creator') {
            // Find the last 'configuring' state in the view history, which represents the user's choices *before* generation.
            const preGenState = [...viewHistory].reverse().find(
                (view) => view.viewId === currentView.viewId && view.state.stage === 'configuring'
            )?.state;
            
            // FIX: Use a type guard ('in') to safely access 'selectedIdeas' on the preGenState union type.
            if (preGenState && 'selectedIdeas' in preGenState) {
                // If we find the pre-generation state, use its selected ideas. This is the most reliable source.
                exportableState.selectedIdeas = (preGenState as AvatarCreatorState | BabyPhotoCreatorState).selectedIdeas;
            } else if (!exportableState.selectedIdeas || exportableState.selectedIdeas.length === 0) {
                // Fallback for safety: if no pre-gen state is found (e.g., page reload on results screen)
                // and the current state has no ideas, assume it was a "Random" run.
                const camelCaseViewId = currentView.viewId.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
                const randomConceptKey = `${camelCaseViewId}_randomConcept`;
                const randomConceptString = t(randomConceptKey);
                if (randomConceptString) {
                    exportableState.selectedIdeas = [randomConceptString];
                }
            }
        }

        const keysToRemove = [
            'generatedImage', 'generatedImages', 'historicalImages', 
            'finalPrompt', 'error',
        ];

        if (currentView.viewId !== 'image-interpolation') {
            keysToRemove.push('generatedPrompt', 'promptSuggestions');
        }

        const removeKeys = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) return;
            for (const key of keysToRemove) {
                if (key in obj) delete obj[key];
            }
            if ('stage' in obj && (obj.stage === 'generating' || obj.stage === 'results' || obj.stage === 'prompting')) {
                if (currentView.viewId === 'free-generation') obj.stage = 'configuring';
                else if ( ('uploadedImage' in obj && obj.uploadedImage) || ('modelImage' in obj && obj.modelImage && 'clothingImage' in obj && obj.clothingImage) || ('contentImage' in obj && obj.contentImage && 'styleImage' in obj && obj.styleImage) || ('inputImage' in obj && obj.inputImage && 'outputImage' in obj && obj.outputImage) ) {
                     obj.stage = 'configuring';
                } else {
                    obj.stage = 'idle';
                }
            }
            for (const key in obj) {
                if (typeof obj[key] === 'object') removeKeys(obj[key]);
            }
        };

        removeKeys(exportableState);
        return exportableState;
    };
    
    return (
        <div className="w-full flex-1 flex flex-col items-center justify-between pt-12">
            <AnimatePresence>
                {stage === 'results' && (
                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                    >
                        {error ? (
                            <>
                                <h2 className="base-font font-bold text-3xl text-red-400">Đã xảy ra lỗi</h2>
                                <p className="text-neutral-300 mt-1 max-w-md mx-auto">{error}</p>
                            </>
                        ) : (
                            <>
                                <h2 className="base-font font-bold text-3xl text-neutral-100">Đây là kết quả của bạn!</h2>
                                {hasPartialError ? (
                                    <p className="text-yellow-300 mt-1">Một vài ảnh đã gặp lỗi. Bạn có thể thử tạo lại chúng.</p>
                                ) : (
                                    <p className="text-neutral-300 mt-1">Bạn có thể tạo lại từng ảnh hoặc tải về máy.</p>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-full flex-1 flex items-start justify-start overflow-y-auto overflow-x-auto py-4 results-scroll-container">
                <motion.div
                    layout
                    className="flex flex-col md:flex-row md:flex-nowrap items-center md:items-stretch gap-6 md:gap-8 px-4 md:px-8 w-full md:w-max mx-auto py-4"
                >
                    {finalInputImages.map((input, index) => (
                        <motion.div
                            key={`input-${index}-${input.url.slice(-10)}`}
                            className="w-full md:w-auto flex-shrink-0"
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 80, damping: 15, delay: index * -0.05 }}
                            whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
                        >
                             <ActionablePolaroidCard
                                type="display"
                                mediaUrl={input.url}
                                caption={input.caption}
                                status="done"
                                onClick={input.onClick}
                                isMobile={isMobile}
                            />
                        </motion.div>
                    ))}
                    {children}
                </motion.div>
            </div>

            <div className="w-full px-4 my-6 flex items-center justify-center">
                {stage === 'results' && (
                    <motion.div
                        className="results-actions"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <button
                          className="btn btn-secondary"
                          onClick={() => downloadJson({ viewId: currentView.viewId, state: getExportableState(currentView.state) }, `aPix-${currentView.viewId}-settings.json`)}
                          title={t('common_exportSettings_tooltip')}
                        >
                            {t('common_exportSettings')}
                        </button>
                        {actions}
                    </motion.div>
                )}
            </div>
        </div>
    );
};


// --- Reusable Layout Components for App Screens ---

interface AppOptionsLayoutProps {
    children: React.ReactNode;
}

export const AppOptionsLayout: React.FC<AppOptionsLayoutProps> = ({ children }) => (
    <motion.div
        className="flex flex-col items-center gap-8 w-full max-w-6xl py-6 overflow-y-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
    >
        {children}
    </motion.div>
);

interface OptionsPanelProps {
    children: React.ReactNode;
    className?: string;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({ children, className }) => (
     <div className={cn("w-full max-w-3xl bg-black/20 p-6 rounded-lg border border-white/10 space-y-4", className)}>
        {children}
    </div>
);