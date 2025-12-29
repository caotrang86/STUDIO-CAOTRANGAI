/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import { useAppControls } from './uiContexts';
import { ImageThumbnailActions } from './ImageThumbnailActions';
import { downloadJson } from './uiFileUtilities';
import { AvatarCreatorState, BabyPhotoCreatorState } from './uiTypes';
export * from './SearchableSelect';
export { RegenerationModal, GalleryPicker, WebcamCaptureModal } from './ActionablePolaroidCard';

/**
 * Renders a title with optional smart wrapping to keep a specified number of last words together.
 * This prevents orphaned words on a new line.
 * @param title The title string.
 * @param enabled A boolean to enable/disable the smart wrapping logic.
 * @param wordsToKeep The number of words to keep on the same line at the end.
 * @returns A React.ReactNode element for the title.
 */
export const renderSmartlyWrappedTitle = (title: string, enabled: boolean, wordsToKeep: number): React.ReactNode => {
    const numWordsToKeep = (typeof wordsToKeep === 'number' && wordsToKeep > 0) ? wordsToKeep : 2;

    if (!enabled) {
        return title;
    }

    const words = title.split(' ');
    if (words.length > numWordsToKeep) {
        const partToKeepTogether = words.splice(-numWordsToKeep).join(' ');
        const firstPart = words.join(' ');
        return (
            <>
                {firstPart}{' '}
                <span className="whitespace-nowrap">{partToKeepTogether}</span>
            </>
        );
    }
    
    return title;
};

interface PromptRegenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (modificationPrompt: string) => void;
    itemToModify: string | null;
    title?: string;
    description?: string;
    placeholder?: string;
}

export const PromptRegenerationModal: React.FC<PromptRegenerationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    itemToModify,
    title = "Tạo lại Prompt",
    description = "Nhập yêu cầu để AI viết lại prompt cho",
    placeholder = "Ví dụ: thêm chi tiết về cảm xúc nhân vật, mô tả bối cảnh ban đêm..."
}) => {
    const [modificationPrompt, setModificationPrompt] = useState('');

    useEffect(() => {
        if (isOpen) {
            setModificationPrompt('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onConfirm(modificationPrompt);
    };

    if (!isOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && itemToModify && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="modal-overlay z-[70]"
                    aria-modal="true"
                    role="dialog"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="modal-content"
                    >
                        <h3 className="base-font font-bold text-2xl text-yellow-400">{title}</h3>
                        <p className="text-neutral-300">
                            {description} <span className="font-bold text-white">"{itemToModify}"</span>.
                        </p>
                        <textarea
                            value={modificationPrompt}
                            onChange={(e) => setModificationPrompt(e.target.value)}
                            placeholder={placeholder}
                            className="modal-textarea"
                            rows={3}
                            aria-label="Yêu cầu chỉnh sửa prompt"
                        />
                        <div className="flex justify-end items-center gap-4 mt-2">
                            <button onClick={onClose} className="btn btn-secondary btn-sm">
                                Hủy
                            </button>
                            <button onClick={handleConfirm} className="btn btn-primary btn-sm">
                                Tạo lại Prompt
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

// --- Slider Component ---

interface SliderProps {
    label: string;
    options: readonly string[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({ label, options, value, onChange, disabled = false }) => {
    const valueIndex = options.indexOf(value);
    const sliderValue = valueIndex >= 0 ? valueIndex : 0;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const newIndex = parseInt(e.target.value, 10);
        if (options[newIndex]) {
            onChange(options[newIndex]);
        }
    };

    return (
        <div>
            <label className="block text-left base-font font-bold text-lg text-neutral-200 mb-2">
                {label}
            </label>
            <div className="slider-container">
                <input
                    type="range"
                    min="0"
                    max={options.length - 1}
                    value={sliderValue}
                    onChange={handleSliderChange}
                    className="slider-track"
                    aria-label={label}
                    disabled={disabled}
                />
                <div className="slider-labels">
                    {options.map((option, index) => (
                        <span 
                            key={index} 
                            className={cn(
                                "slider-label",
                                { 'slider-label-active': index === sliderValue && !disabled }
                            )}
                        >
                            {option}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Prompt Result Card ---
interface PromptResultCardProps {
    title: string;
    promptText: string;
    className?: string;
}

export const PromptResultCard: React.FC<PromptResultCardProps> = ({ title, promptText, className }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(promptText);
        toast.success("Đã sao chép prompt!");
    };

    return (
        <div className={cn("prompt-card", className)}>
             <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="base-font font-bold text-lg text-neutral-800">{title}</h3>
                <button
                    onClick={handleCopy}
                    className="p-2 bg-black/10 rounded-full text-neutral-600 hover:bg-black/20 hover:text-black focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-colors"
                    aria-label="Sao chép prompt"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
            <div className="prompt-card-content">
                <p className="base-font text-sm text-neutral-700 whitespace-pre-wrap">{promptText}</p>
            </div>
        </div>
    );
};

export const Switch: React.FC<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ id, checked, onChange, disabled }) => (
    <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-neutral-800",
            "disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-yellow-400" : "bg-neutral-600"
        )}
    >
        <span
            aria-hidden="true"
            className={cn(
                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                checked ? "translate-x-[8px]" : "-translate-x-[8px]"
            )}
        />
    </button>
);

// --- Reusable UI Components ---

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