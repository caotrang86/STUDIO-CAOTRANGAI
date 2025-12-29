/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useCallback, ChangeEvent, memo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import PolaroidCard from './PolaroidCard';
import { handleFileUpload, downloadImage } from './uiFileUtilities';
import { useImageEditor, useAppControls } from './uiContexts';
import { useLightbox } from './uiHooks';
import { ImageThumbnail } from './ImageThumbnail';
import { GalleryToolbar } from './GalleryToolbar';
import Lightbox from './Lightbox';
import { CloudUploadIcon } from './icons';

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

// --- Local Modal Definitions ---

interface RegenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmImage: (prompt: string) => void;
    onConfirmVideo?: (prompt: string) => void;
    itemToModify: string | null;
    title?: string;
    description?: string;
    placeholder?: string;
}

export const RegenerationModal: React.FC<RegenerationModalProps> = ({
    isOpen,
    onClose,
    onConfirmImage,
    onConfirmVideo,
    itemToModify,
    title = "Tinh chỉnh hoặc Tạo video",
    description = "Thêm yêu cầu để tinh chỉnh ảnh, hoặc dùng nó để tạo video cho",
    placeholder = "Ví dụ: tông màu ấm, phong cách phim xưa..."
}) => {
    const [customPrompt, setCustomPrompt] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCustomPrompt('');
        }
    }, [isOpen]);

    const handleConfirmImage = () => {
        onConfirmImage(customPrompt);
    };

    const handleConfirmVideo = () => {
        if (onConfirmVideo) {
            onConfirmVideo(customPrompt);
        }
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
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder={placeholder}
                            className="modal-textarea"
                            rows={3}
                            aria-label="Yêu cầu chỉnh sửa bổ sung"
                        />
                        <div className="flex justify-end items-center gap-4 mt-2">
                            <button onClick={onClose} className="btn btn-secondary btn-sm">
                                Hủy
                            </button>
                            {onConfirmVideo && (
                                <button onClick={handleConfirmVideo} className="btn btn-secondary btn-sm">
                                    Tạo video
                                </button>
                            )}
                            <button onClick={handleConfirmImage} className="btn btn-primary btn-sm">
                                Tạo lại ảnh
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

interface GalleryPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (imageUrl: string) => void;
    images: string[];
}

export const GalleryPicker: React.FC<GalleryPickerProps> = ({ isOpen, onClose, onSelect, images }) => {
    const { addImagesToGallery, removeImageFromGallery, replaceImageInGallery, t } = useAppControls();
    const { openImageEditor } = useImageEditor();
    const { 
        lightboxIndex, 
        openLightbox, 
        closeLightbox, 
        navigateLightbox 
    } = useLightbox();
    
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const isDroppingRef = useRef(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    useEffect(() => {
        closeLightbox();
        if (!isOpen) {
            setIsSelectionMode(false);
            setSelectedIndices([]);
        }
    }, [isOpen, closeLightbox]);
    
    const handleToggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIndices([]);
    };

    const handleDeleteSelected = () => {
        if (selectedIndices.length === 0) return;
        const sortedIndices = [...selectedIndices].sort((a, b) => b - a);
        sortedIndices.forEach(index => removeImageFromGallery(index));
        setSelectedIndices([]);
        setIsSelectionMode(false);
    };

    const handleThumbnailClick = (index: number) => {
        if (isSelectionMode) {
            setSelectedIndices(prev =>
                prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
            );
        } else {
            onSelect(images[index]);
        }
    };
    
    const handleEditImage = (indexToEdit: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const urlToEdit = images[indexToEdit];
        if (!urlToEdit || urlToEdit.startsWith('blob:')) {
            alert('Không thể chỉnh sửa video.');
            return;
        }

        openImageEditor(urlToEdit, (newUrl) => {
            replaceImageInGallery(indexToEdit, newUrl);
        });
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        isDroppingRef.current = true;
        setIsDraggingOver(false);

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const imageFiles = Array.from(files).filter(file => (file as File).type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        const readImageAsDataURL = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read file.'));
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        };

        try {
            const imageDataUrls = await Promise.all(imageFiles.map(readImageAsDataURL));
            addImagesToGallery(imageDataUrls);
        } catch (error) {
            console.error("Error reading dropped files:", error);
        } finally {
            isDroppingRef.current = false;
        }
    }, [addImagesToGallery]);
    
    if (!isOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="modal-overlay z-[75]" // Higher z-index
                        aria-modal="true"
                        role="dialog"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="modal-content !max-w-3xl !h-[80vh] flex flex-col"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <GalleryToolbar 
                                isSelectionMode={isSelectionMode}
                                selectedCount={selectedIndices.length}
                                imageCount={images.length}
                                title={t('galleryModal_title') || "Chọn từ thư viện"}
                                onToggleSelectionMode={handleToggleSelectionMode}
                                onDeleteSelected={handleDeleteSelected}
                                onClose={onClose}
                            />
                            {images.length > 0 ? (
                                <div className="gallery-grid">
                                    {images.map((img, index) => (
                                        <ImageThumbnail
                                            key={`${img.slice(-20)}-${index}`}
                                            index={index}
                                            imageUrl={img}
                                            isSelectionMode={isSelectionMode}
                                            isSelected={selectedIndices.includes(index)}
                                            onSelect={handleThumbnailClick}
                                            onEdit={handleEditImage}
                                            onDelete={(index, e) => {
                                                e.stopPropagation();
                                                removeImageFromGallery(index);
                                            }}
                                            onQuickView={(index, e) => {
                                                e.stopPropagation();
                                                openLightbox(index);
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                 <div className="text-center text-neutral-400 py-8 flex-1 flex items-center justify-center">
                                    <p>{t('galleryModal_empty')}</p>
                                </div>
                            )}
                             <AnimatePresence>
                                {isDraggingOver && (
                                    <motion.div
                                        className="absolute inset-0 z-10 bg-black/70 border-4 border-dashed border-yellow-400 rounded-lg flex flex-col items-center justify-center pointer-events-none"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <CloudUploadIcon className="h-16 w-16 text-yellow-400 mb-4" strokeWidth={1} />
                                        <p className="text-2xl font-bold text-yellow-400">{t('galleryModal_dropPrompt')}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <Lightbox images={images} selectedIndex={lightboxIndex} onClose={closeLightbox} onNavigate={navigateLightbox} />
        </>,
        document.body
    );
};

interface WebcamCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageDataUrl: string) => void;
}

export const WebcamCaptureModal: React.FC<WebcamCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
    const { t } = useAppControls();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const startCamera = async () => {
                setError(null);
                try {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    setStream(mediaStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                    }
                } catch (err) {
                    console.error("Error accessing webcam:", err);
                    if (err instanceof DOMException && err.name === "NotAllowedError") {
                        setError(t('webcam_error_permission'));
                    } else {
                        setError(t('webcam_error_device'));
                    }
                }
            };
            startCamera();
        } else {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        }
    }, [isOpen, t]);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            onCapture(canvas.toDataURL('image/png'));
            onClose();
        }
    };
    
    if (!isOpen) {
        return null;
    }
    
    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="modal-overlay z-[80]" aria-modal="true" role="dialog" >
                    <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="modal-content !max-w-xl" >
                        <h3 className="base-font font-bold text-2xl text-yellow-400">{t('webcam_title')}</h3>
                        <div className="aspect-video bg-neutral-900 rounded-md overflow-hidden relative">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                             {error && (
                                <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70">
                                    <p className="text-red-400 text-center">{error}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end items-center gap-4 mt-2">
                            <button onClick={onClose} className="btn btn-secondary btn-sm">{t('webcam_close')}</button>
                            <button onClick={handleCapture} className="btn btn-primary btn-sm" disabled={!stream || !!error}>{t('webcam_submit')}</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

// --- ActionablePolaroidCard Component ---

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
