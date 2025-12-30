/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppControls } from './uiUtils';
import { 
    createScriptSummaryFromIdea, 
    createScriptSummaryFromText, 
    createScriptSummaryFromAudio, 
    developScenesFromSummary, 
    generateVideoPromptFromScenes,
    refineSceneDescription,
    refineSceneTransition,
    type ScriptSummary
} from '../services/geminiService';
import { generateFreeImage } from '../services/geminiService';
import { GalleryPicker, WebcamCaptureModal } from './uiUtils';
import {
    StoryboardingInput,
    StoryboardingSummary,
    StoryboardingScenes
} from './storyboarding';
import { CloseIcon, CloudUploadIcon, LoadingSpinnerIcon } from './icons';
import type { SceneState } from './uiTypes';
import toast from 'react-hot-toast';

interface StoryboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onHide: () => void;
}

export const StoryboardingModal: React.FC<StoryboardingModalProps> = ({ isOpen, onClose, onHide }) => {
    const { t, imageGallery, addImagesToGallery, settings } = useAppControls();
    
    // --- State ---
    const [step, setStep] = useState<'input' | 'summary' | 'scenes'>('input');
    const [activeInput, setActiveInput] = useState<'prompt' | 'text' | 'audio'>('prompt');
    const [idea, setIdea] = useState('');
    const [scriptText, setScriptText] = useState('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    
    // Options
    const [style, setStyle] = useState('');
    const [numberOfScenes, setNumberOfScenes] = useState(0); // 0 = Auto
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [notes, setNotes] = useState('');
    const [storyboardLanguage, setStoryboardLanguage] = useState<'vi' | 'en' | 'zh'>('vi');
    const [scriptType, setScriptType] = useState<'auto' | 'dialogue' | 'action'>('auto');
    const [keepClothing, setKeepClothing] = useState(false);
    const [keepBackground, setKeepBackground] = useState(false);

    // Results
    const [scriptSummary, setScriptSummary] = useState<ScriptSummary | null>(null);
    const [scenes, setScenes] = useState<SceneState[]>([]);
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);
    const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
    const [isDraggingRef, setIsDraggingRef] = useState(false);
    
    const audioInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    const STYLE_OPTIONS = t('storyboarding_styleOptions');
    const ASPECT_RATIO_OPTIONS = t('storyboarding_aspectRatioOptions');

    // --- Handlers ---

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'text' | 'audio') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (type === 'text') {
                const reader = new FileReader();
                reader.onload = (ev) => setScriptText(ev.target?.result as string);
                reader.readAsText(file);
            } else {
                setAudioFile(file);
            }
        }
    };

    const handleRefDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(true); };
    const handleRefDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false); };
    const handleRefDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // FIX: Explicitly cast file to check type
            const files = Array.from(e.dataTransfer.files).filter((file: any) => file.type.startsWith('image/'));
            const remainingSlots = 4 - referenceImages.length;
            const filesToAdd = files.slice(0, remainingSlots);
            filesToAdd.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => { setReferenceImages(prev => [...prev, reader.result as string]); };
                reader.readAsDataURL(file as Blob);
            });
        }
    };

    const handleGallerySelect = (imageUrl: string) => {
        if (referenceImages.length < 4) {
            setReferenceImages(prev => [...prev, imageUrl]);
        }
        setIsGalleryPickerOpen(false);
    };

    const handleSubmitIdea = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const refImagesData = await Promise.all(referenceImages.map(async (url) => {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise<{ mimeType: string, data: string }>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = (reader.result as string).split(',')[1];
                        resolve({ mimeType: blob.type, data: base64data });
                    };
                    reader.readAsDataURL(blob);
                });
            }));

            const options = { style, numberOfScenes, aspectRatio, notes, keepClothing, keepBackground };
            let summary: ScriptSummary;

            if (activeInput === 'prompt') {
                if (!idea.trim()) throw new Error(t('storyboarding_error_noIdea'));
                summary = await createScriptSummaryFromIdea(idea, refImagesData, options, storyboardLanguage, scriptType);
            } else if (activeInput === 'text') {
                if (!scriptText.trim()) throw new Error(t('storyboarding_error_noText'));
                summary = await createScriptSummaryFromText(scriptText, refImagesData, options, storyboardLanguage, scriptType);
            } else {
                if (!audioFile) throw new Error(t('storyboarding_error_noAudio'));
                const reader = new FileReader();
                const audioData = await new Promise<{ mimeType: string, data: string }>((resolve) => {
                    reader.onloadend = () => {
                        const base64data = (reader.result as string).split(',')[1];
                        resolve({ mimeType: audioFile.type, data: base64data });
                    };
                    reader.readAsDataURL(audioFile);
                });
                summary = await createScriptSummaryFromAudio(audioData, refImagesData, options, storyboardLanguage, scriptType);
            }

            setScriptSummary(summary);
            setStep('summary');
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : t('storyboarding_error_scenario'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDevelopScenes = async () => {
        if (!scriptSummary) return;
        setIsLoading(true);
        setError(null);
        try {
            const fullScenario = await developScenesFromSummary(scriptSummary, storyboardLanguage, scriptType);
            const initialScenes: SceneState[] = fullScenario.scenes.map(s => ({
                scene: s.scene,
                startFrame: { description: s.startFrameDescription, status: 'idle', imageSource: 'reference' },
                animationDescription: s.animationDescription,
                endFrame: { description: s.endFrameDescription, status: 'idle', imageSource: 'reference' },
                videoStatus: 'idle'
            }));
            setScenes(initialScenes);
            setStep('scenes');
        } catch (err) {
            console.error(err);
            setError(t('storyboarding_error_develop'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateImage = async (index: number, frameType: 'start' | 'end') => {
        const scene = scenes[index];
        const frame = frameType === 'start' ? scene.startFrame : scene.endFrame;
        
        // Update status to pending
        const updateFrameStatus = (status: 'pending' | 'done' | 'error', imageUrl?: string, errorMsg?: string) => {
            setScenes(prev => {
                const newScenes = [...prev];
                const targetFrame = frameType === 'start' ? newScenes[index].startFrame : newScenes[index].endFrame;
                targetFrame.status = status;
                if (imageUrl) targetFrame.imageUrl = imageUrl;
                if (errorMsg) targetFrame.error = errorMsg;
                return newScenes;
            });
        };

        updateFrameStatus('pending');

        try {
            let refImage: string | undefined;
            
            // Determine reference image based on source selection
            if (frame.imageSource === 'reference') {
                refImage = referenceImages.length > 0 ? referenceImages[0] : undefined;
            } else if (frame.imageSource.startsWith('data:image')) {
                 refImage = frame.imageSource;
            } else {
                // Parse "sceneIndex-frameType" format (e.g., "0-start")
                const [sourceIndexStr, sourceFrame] = frame.imageSource.split('-');
                const sourceIndex = parseInt(sourceIndexStr);
                if (!isNaN(sourceIndex) && scenes[sourceIndex]) {
                    const sourceScene = scenes[sourceIndex];
                    refImage = sourceFrame === 'start' ? sourceScene.startFrame.imageUrl : sourceScene.endFrame.imageUrl;
                }
            }

            // If we have a reference image, use it (img2img), otherwise text2img
            const resultUrls = await generateFreeImage(
                frame.description, 
                1, 
                aspectRatio, 
                refImage,
                undefined, undefined, undefined, // Other image slots empty
                false // removeWatermark
            );

            if (resultUrls && resultUrls.length > 0) {
                updateFrameStatus('done', resultUrls[0]);
                addImagesToGallery([resultUrls[0]]);
            } else {
                throw new Error(t('storyboarding_error_noImage'));
            }
        } catch (err) {
            console.error(err);
            updateFrameStatus('error', undefined, err instanceof Error ? err.message : t('storyboarding_error_imageGen'));
        }
    };

    const handleGenerateVideoPrompt = async (index: number, promptMode: 'auto' | 'start-end' | 'json') => {
        const scene = scenes[index];
        if (!scene.startFrame.description || !scene.endFrame.description || !scene.animationDescription) {
             toast.error("Thiếu thông tin mô tả để tạo prompt video.");
             return;
        }

        try {
            const videoPrompt = await generateVideoPromptFromScenes(
                scene.startFrame.description, 
                scene.animationDescription, 
                scene.endFrame.description,
                storyboardLanguage,
                promptMode,
                scriptType
            );
            
            setScenes(prev => {
                const newScenes = [...prev];
                newScenes[index].videoPrompt = videoPrompt;
                return newScenes;
            });
        } catch (error) {
             console.error("Failed to generate video prompt:", error);
             toast.error("Không thể tạo prompt video.");
        }
    };

    const handleGenerateVideo = async (index: number) => {
        const scene = scenes[index];
        if (!scene.startFrame.imageUrl || !scene.videoPrompt) {
            toast.error(t('storyboarding_error_videoInputs'));
            return;
        }

        toast.loading("Đang bắt đầu tạo video...", { id: `video-gen-${index}` });

        setScenes(prev => {
            const newScenes = [...prev];
            newScenes[index].videoStatus = 'pending';
            return newScenes;
        });

        // NOTE: This functionality requires the `useVideoGeneration` hook logic but adapted for manual control inside the modal.
        // For simplicity and to avoid huge refactors, we will emit a toast for now as Video Generation is complex and async.
        // A full implementation would require integrating `startVideoGeneration` here similar to `useVideoGeneration`.
        
        // Placeholder for future implementation
        setTimeout(() => {
             toast.dismiss(`video-gen-${index}`);
             toast(t('storyboarding_videoPlatforms_note'), { icon: 'ℹ️', duration: 5000 });
             setScenes(prev => {
                const newScenes = [...prev];
                newScenes[index].videoStatus = 'idle'; // Reset for now
                return newScenes;
            });
        }, 2000);
    };

    const handleEditSceneDescription = (index: number, frameType: 'start' | 'end', newDescription: string) => {
        setScenes(prev => {
            const newScenes = [...prev];
            if (frameType === 'start') newScenes[index].startFrame.description = newDescription;
            else newScenes[index].endFrame.description = newDescription;
            return newScenes;
        });
    };

    const handleEditSceneAnimation = (index: number, newAnimation: string) => {
        setScenes(prev => {
            const newScenes = [...prev];
            newScenes[index].animationDescription = newAnimation;
            return newScenes;
        });
    };
    
    const handleEditSceneVideoPrompt = (index: number, newPrompt: string) => {
        setScenes(prev => {
            const newScenes = [...prev];
            newScenes[index].videoPrompt = newPrompt;
            return newScenes;
        });
    };

    const handleImageSourceChange = (index: number, frameType: 'start' | 'end', newSource: string) => {
        setScenes(prev => {
            const newScenes = [...prev];
            if (frameType === 'start') newScenes[index].startFrame.imageSource = newSource;
            else newScenes[index].endFrame.imageSource = newSource;
            return newScenes;
        });
    };

    const handleSelectCustomImage = (index: number, frameType: 'start' | 'end') => {
        // We need a way to pass the selection back. We'll use a temporary state or callback.
        // For simplicity, we assume `GalleryPicker` is available globally or we open a local one.
        // Here we reuse the local `isGalleryPickerOpen` but need to know WHICH frame requested it.
        // This requires more complex state management.
        // Simplified: Alert user to drag and drop for now or implement a specific picker flow.
        alert("Tính năng chọn ảnh từ thư viện cho từng khung hình đang được cập nhật. Vui lòng sử dụng Kéo & Thả hoặc Tải lên.");
    };

    const handleUploadCustomImage = (index: number, frameType: 'start' | 'end') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                 const reader = new FileReader();
                 reader.onload = (ev) => {
                     const result = ev.target?.result as string;
                     setScenes(prev => {
                        const newScenes = [...prev];
                        const targetFrame = frameType === 'start' ? newScenes[index].startFrame : newScenes[index].endFrame;
                        targetFrame.imageUrl = result;
                        targetFrame.status = 'done';
                        targetFrame.imageSource = result; // Store as data URL
                        return newScenes;
                     });
                     addImagesToGallery([result]);
                 };
                 reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleImageFileDrop = (file: File, index: number, frameType: 'start' | 'end') => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
             setScenes(prev => {
                const newScenes = [...prev];
                const targetFrame = frameType === 'start' ? newScenes[index].startFrame : newScenes[index].endFrame;
                targetFrame.imageUrl = result;
                targetFrame.status = 'done';
                targetFrame.imageSource = result;
                return newScenes;
             });
             addImagesToGallery([result]);
        };
        reader.readAsDataURL(file);
    };

    const handleClearImage = (index: number, frameType: 'start' | 'end') => {
        setScenes(prev => {
            const newScenes = [...prev];
            const targetFrame = frameType === 'start' ? newScenes[index].startFrame : newScenes[index].endFrame;
            targetFrame.imageUrl = undefined;
            targetFrame.status = 'idle';
            return newScenes;
        });
    };
    
    // --- New Action Handlers ---
    const handleAddScene = () => {
        setScenes(prev => [
            ...prev,
            {
                scene: prev.length + 1,
                startFrame: { description: '', status: 'idle', imageSource: 'reference' },
                animationDescription: '',
                endFrame: { description: '', status: 'idle', imageSource: 'reference' },
                videoStatus: 'idle'
            }
        ]);
    };

    const handleDeleteScene = (index: number) => {
        setScenes(prev => {
            const newScenes = prev.filter((_, i) => i !== index);
            // Renumber scenes
            return newScenes.map((s, i) => ({ ...s, scene: i + 1 }));
        });
    };

    const handleMoveScene = (index: number, direction: 'up' | 'down') => {
        setScenes(prev => {
            const newScenes = [...prev];
            if (direction === 'up' && index > 0) {
                [newScenes[index], newScenes[index - 1]] = [newScenes[index - 1], newScenes[index]];
            } else if (direction === 'down' && index < newScenes.length - 1) {
                [newScenes[index], newScenes[index + 1]] = [newScenes[index + 1], newScenes[index]];
            }
            return newScenes.map((s, i) => ({ ...s, scene: i + 1 }));
        });
    };
    
    // Stub functions for image actions
    const handleEditImage = (index: number, frameType: 'start' | 'end') => {
        // Implement image editor integration here
        toast("Tính năng chỉnh sửa ảnh sẽ sớm ra mắt!");
    };
    const handlePreviewImage = (index: number, frameType: 'start' | 'end') => {
        // Could open a lightbox
    };
    const handleDownloadImage = (index: number, frameType: 'start' | 'end') => {
         const scene = scenes[index];
         const url = frameType === 'start' ? scene.startFrame.imageUrl : scene.endFrame.imageUrl;
         if (url) {
             const link = document.createElement('a');
             link.href = url;
             link.download = `scene-${scene.scene}-${frameType}.png`;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
         }
    };
    
    const handleRegenerateScenePrompt = async (index: number, frameType: 'start' | 'end', modificationPrompt: string) => {
        const scene = scenes[index];
        const originalDescription = frameType === 'start' ? scene.startFrame.description : scene.endFrame.description;
        
        try {
            const refinedDescription = await refineSceneDescription(originalDescription, modificationPrompt, storyboardLanguage);
            handleEditSceneDescription(index, frameType, refinedDescription);
            toast.success("Đã cập nhật prompt!");
        } catch (err) {
            console.error(err);
            toast.error("Không thể tạo lại prompt.");
        }
    };

    const handleRegenerateAnimation = async (index: number, modificationPrompt: string) => {
         const scene = scenes[index];
         try {
             const refinedAnimation = await refineSceneTransition(scene.animationDescription, modificationPrompt, storyboardLanguage);
             handleEditSceneAnimation(index, refinedAnimation);
             toast.success("Đã cập nhật mô tả chuyển động!");
         } catch (err) {
             console.error(err);
             toast.error("Không thể tạo lại mô tả chuyển động.");
         }
    };


    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onHide}
                className="modal-overlay z-[60]"
                aria-modal="true"
                role="dialog"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="modal-content !max-w-[95vw] !w-[95vw] !h-[95vh] flex flex-row !p-0 relative"
                >
                    {/* Sidebar */}
                    <aside className="w-1/4 max-w-sm flex flex-col bg-neutral-900/50 p-6 border-r border-white/10 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h3 className="base-font font-bold text-2xl text-yellow-400">Storyboard</h3>
                            <button onClick={onHide} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Đóng">
                                <CloseIcon className="h-6 w-6" strokeWidth={2} />
                            </button>
                        </div>

                        {step === 'input' && (
                            <StoryboardingInput
                                activeInput={activeInput}
                                setActiveInput={setActiveInput}
                                idea={idea}
                                setIdea={setIdea}
                                scriptText={scriptText}
                                setScriptText={setScriptText}
                                audioFile={audioFile}
                                audioInputRef={audioInputRef}
                                textInputRef={textInputRef}
                                handleFileSelect={handleFileSelect}
                                referenceImages={referenceImages}
                                isDraggingRef={isDraggingRef}
                                handleRefDragOver={handleRefDragOver}
                                handleRefDragLeave={handleRefDragLeave}
                                handleRefDrop={handleRefDrop}
                                setReferenceImages={setReferenceImages}
                                setIsGalleryPickerOpen={setIsGalleryPickerOpen}
                                style={style}
                                setStyle={setStyle}
                                styleOptions={STYLE_OPTIONS}
                                numberOfScenes={numberOfScenes}
                                setNumberOfScenes={setNumberOfScenes}
                                aspectRatio={aspectRatio}
                                setAspectRatio={setAspectRatio}
                                aspectRatioOptions={ASPECT_RATIO_OPTIONS}
                                notes={notes}
                                setNotes={setNotes}
                                storyboardLanguage={storyboardLanguage}
                                setStoryboardLanguage={setStoryboardLanguage}
                                scriptType={scriptType}
                                setScriptType={setScriptType}
                                keepClothing={keepClothing}
                                setKeepClothing={setKeepClothing}
                                keepBackground={keepBackground}
                                setKeepBackground={setKeepBackground}
                            />
                        )}

                        {step === 'summary' && scriptSummary && (
                            <StoryboardingSummary
                                scriptSummary={scriptSummary}
                                onSummaryChange={(field, value) => setScriptSummary(prev => prev ? ({ ...prev, [field]: value }) : null)}
                            />
                        )}
                        
                        {step === 'scenes' && (
                             <div className="space-y-4">
                                <div className="text-sm text-neutral-400">
                                    <p>Đã tạo {scenes.length} cảnh.</p>
                                    <p>Tùy chỉnh và tạo ảnh cho từng cảnh ở bên phải.</p>
                                </div>
                                <button onClick={() => setStep('input')} className="btn btn-secondary w-full">
                                    {t('storyboarding_editInput')}
                                </button>
                                <button onClick={handleDevelopScenes} className="btn btn-secondary w-full">
                                    {t('storyboarding_redevelopScenes')}
                                </button>
                            </div>
                        )}

                        <div className="mt-auto pt-6 border-t border-white/10">
                            {error && <p className="text-red-400 text-center text-sm mb-2">{error}</p>}
                            {step === 'input' && (
                                <button onClick={handleSubmitIdea} className="btn btn-primary w-full" disabled={isLoading}>
                                    {isLoading ? <LoadingSpinnerIcon className="animate-spin h-5 w-5 mx-auto"/> : t('storyboarding_idea_submit')}
                                </button>
                            )}
                            {step === 'summary' && (
                                <div className="flex gap-2">
                                     <button onClick={() => setStep('input')} className="btn btn-secondary flex-1" disabled={isLoading}>{t('common_cancel')}</button>
                                     <button onClick={handleDevelopScenes} className="btn btn-primary flex-1" disabled={isLoading}>
                                        {isLoading ? <LoadingSpinnerIcon className="animate-spin h-5 w-5 mx-auto"/> : t('storyboarding_developScenes')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col p-6 overflow-hidden bg-neutral-900/30">
                        <div className="flex-grow overflow-y-auto">
                            {step === 'input' && (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                                    <p className="text-xl mb-4">{t('storyboarding_scenes_placeholder')}</p>
                                    <div className="w-1/3 aspect-video bg-neutral-800 rounded-lg opacity-50"></div>
                                </div>
                            )}
                            {step === 'summary' && (
                                <div className="h-full flex flex-col items-center justify-center">
                                     <div className="max-w-2xl text-center space-y-6">
                                        <h2 className="text-3xl font-bold text-yellow-400">Tóm tắt Kịch bản</h2>
                                        <div className="bg-neutral-800 p-6 rounded-xl text-left space-y-4">
                                            <p><span className="font-bold text-neutral-400">Tiêu đề:</span> {scriptSummary?.title}</p>
                                            <p><span className="font-bold text-neutral-400">Logline:</span> {scriptSummary?.content}</p>
                                            <p><span className="font-bold text-neutral-400">Nhân vật:</span> {scriptSummary?.characters}</p>
                                            <p><span className="font-bold text-neutral-400">Bối cảnh:</span> {scriptSummary?.setting}</p>
                                             <p><span className="font-bold text-neutral-400">Phong cách:</span> {scriptSummary?.style}</p>
                                        </div>
                                        <p className="text-neutral-400">Xem lại thông tin tóm tắt và nhấn "Triển khai cảnh" để tiếp tục.</p>
                                     </div>
                                </div>
                            )}
                            {step === 'scenes' && (
                                <StoryboardingScenes
                                    scenes={scenes}
                                    referenceImages={referenceImages}
                                    onGenerateImage={handleGenerateImage}
                                    onGenerateVideo={handleGenerateVideo}
                                    onEditSceneDescription={handleEditSceneDescription}
                                    onEditSceneAnimation={handleEditSceneAnimation}
                                    onImageSourceChange={handleImageSourceChange}
                                    onSelectCustomImage={handleSelectCustomImage}
                                    onUploadCustomImage={handleUploadCustomImage}
                                    onClearImage={handleClearImage}
                                    onImageFile={handleImageFileDrop}
                                    onEditImage={handleEditImage}
                                    onPreviewImage={handlePreviewImage}
                                    onDownloadImage={handleDownloadImage}
                                    onAddScene={handleAddScene}
                                    onDeleteScene={handleDeleteScene}
                                    onMoveScene={handleMoveScene}
                                    onGenerateVideoPrompt={handleGenerateVideoPrompt}
                                    onEditSceneVideoPrompt={handleEditSceneVideoPrompt}
                                    onRegenerateScenePrompt={handleRegenerateScenePrompt}
                                    onRegenerateAnimation={handleRegenerateAnimation}
                                    aspectRatio={aspectRatio}
                                />
                            )}
                        </div>
                    </main>
                </motion.div>
            </motion.div>
            <GalleryPicker
                isOpen={isGalleryPickerOpen}
                onClose={() => setIsGalleryPickerOpen(false)}
                onSelect={handleGallerySelect}
                images={imageGallery}
            />
        </>,
        document.body
    );
};