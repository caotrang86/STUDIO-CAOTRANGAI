/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMotionValue } from 'framer-motion';
import { useAppControls } from '../uiUtils';
import { extractJsonFromPng } from '../uiFileUtilities';
import { 
    type Layer, 
    type CanvasSettings, 
    type Interaction, 
    type Point, 
    type Rect, 
    type Guide, 
    type MultiLayerAction, 
    getBoundingBoxForLayers, 
    type CanvasTool,
    type AIPreset
} from './LayerComposer.types';
import { generateFromMultipleImages } from '../../services/geminiService';
import { generateFromPreset } from '../../services/geminiService';
import { sendChatMessage } from '../../services/geminiService';
import { AILogMessage } from './AIProcessLogger';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';

export const useLayerComposerState = ({ isOpen, onClose, onHide }: { isOpen: boolean, onClose: () => void, onHide: () => void }) => {
    const { 
        imageGallery, 
        t, 
        addImagesToGallery,
        language,
        generationHistory 
    } = useAppControls();

    const [canvasInitialized, setCanvasInitialized] = useState(false);
    
    // --- Canvas State ---
    const [layers, setLayers] = useState<Layer[]>([]);
    const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>({
        width: 1024,
        height: 1024,
        background: '#121212',
        grid: { visible: true, snap: true, size: 20, color: 'rgba(255,255,255,0.1)' },
        guides: { enabled: true, color: '#FBBF24' },
    });
    const [isInfiniteCanvas, setIsInfiniteCanvas] = useState(false);
    
    // --- Interaction State ---
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>('select');
    const [interaction, setInteraction] = useState<Interaction | null>(null);
    const panX = useMotionValue(0);
    const panY = useMotionValue(0);
    const scale = useMotionValue(1);
    const [zoomDisplay, setZoomDisplay] = useState(100);
    const panStartRef = useRef<{ pan: {x: number, y: number}, pointer: Point } | null>(null);
    const [isSpacePanning, setIsSpacePanning] = useState(false);
    
    // --- History State ---
    const [history, setHistory] = useState<Layer[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    
    // --- AI State ---
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiPreset, setAiPreset] = useState('default');
    const [runningJobCount, setRunningJobCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isSimpleImageMode, setIsSimpleImageMode] = useState(false);
    const [aiProcessLog, setAiProcessLog] = useState<AILogMessage[]>([]);
    const [isLogVisible, setIsLogVisible] = useState(false);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    const [aiNumberOfImages, setAiNumberOfImages] = useState(1);
    const [aiAspectRatio, setAiAspectRatio] = useState('1:1');
    
    // --- Preset State ---
    const [loadedPreset, setLoadedPreset] = useState<any | null>(null);
    
    // --- Modal/UI State ---
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [isWebcamOpen, setIsWebcamOpen] = useState(false);
    const [isStartScreenDraggingOver, setIsStartScreenDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isConfirmingClose, setIsConfirmingClose] = useState(false);
    const [isConfirmingNew, setIsConfirmingNew] = useState(false);
    
    // --- Other State ---
    const [shapeFillColor, setShapeFillColor] = useState('#ffffff');

    // --- Computed State ---
    const selectedLayers = useMemo(() => layers.filter(l => selectedLayerIds.includes(l.id)), [layers, selectedLayerIds]);
    const selectedLayerId = selectedLayerIds.length === 1 ? selectedLayerIds[0] : null;
    
    // For Presets: which layers are used as inputs
    // If simple image mode (multi-input), we use the order of selection.
    // If batch mode, we iterate over each selected layer.
    const selectedLayersForPreset = selectedLayers; 
    
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    
    // Bounding Box for multi-selection
    const selectionBoundingBox = useMemo(() => getBoundingBoxForLayers(selectedLayers), [selectedLayers]);

    // --- History Management ---
    const pushHistory = useCallback((newLayers: Layer[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newLayers);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const handleUndo = useCallback(() => {
        if (canUndo) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setLayers(history[newIndex]);
            setSelectedLayerIds([]);
        }
    }, [canUndo, historyIndex, history]);

    const handleRedo = useCallback(() => {
        if (canRedo) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setLayers(history[newIndex]);
            setSelectedLayerIds([]);
        }
    }, [canRedo, historyIndex, history]);

    const beginInteraction = useCallback(() => {
        // Optional: Snapshot state before complex interaction if needed, 
        // but typically we snapshot on pointer up / end.
        // For now, this can be empty or used to set an interaction flag.
    }, []);

    // --- Layer Operations ---
    
    const addLayer = useCallback((layer: Omit<Layer, 'id'>) => {
        const newLayer = { ...layer, id: nanoid() };
        const newLayers = [...layers, newLayer];
        setLayers(newLayers);
        pushHistory(newLayers);
        setSelectedLayerIds([newLayer.id]);
    }, [layers, pushHistory]);

    const handleAddImage = useCallback((url: string) => {
        const img = new Image();
        img.onload = () => {
             // Calculate size to fit reasonably within canvas but not exceed 50%
            const maxW = canvasSettings.width * 0.5;
            const maxH = canvasSettings.height * 0.5;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (width > maxW || height > maxH) {
                const ratio = width / height;
                if (width > maxW) { width = maxW; height = width / ratio; }
                if (height > maxH) { height = maxH; width = height * ratio; }
            }

            addLayer({
                type: 'image',
                url: url,
                x: (canvasSettings.width - width) / 2,
                y: (canvasSettings.height - height) / 2,
                width: width,
                height: height,
                rotation: 0,
                opacity: 100,
                blendMode: 'source-over',
                isVisible: true,
                isLocked: false
            });
        };
        img.src = url;
        setIsGalleryOpen(false);
        setIsWebcamOpen(false);
    }, [addLayer, canvasSettings]);

    const handleAddText = useCallback(() => {
        addLayer({
            type: 'text',
            text: 'Text Layer',
            fontFamily: 'Be Vietnam Pro',
            fontSize: 40,
            fontWeight: '400',
            fontStyle: 'normal',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.2,
            x: canvasSettings.width / 2 - 100,
            y: canvasSettings.height / 2 - 25,
            width: 200,
            height: 50,
            rotation: 0,
            opacity: 100,
            blendMode: 'source-over',
            isVisible: true,
            isLocked: false
        });
    }, [addLayer, canvasSettings]);

    const updateLayers = useCallback((updates: { id: string, props: Partial<Layer> }[], isFinalChange: boolean) => {
        const newLayers = layers.map(l => {
            const update = updates.find(u => u.id === l.id);
            return update ? { ...l, ...update.props } : l;
        });
        setLayers(newLayers);
        if (isFinalChange) {
            pushHistory(newLayers);
        }
    }, [layers, pushHistory]);

    const handleLayerUpdate = (id: string, newProps: Partial<Layer>, isFinalChange: boolean) => {
        updateLayers([{ id, props: newProps }], isFinalChange);
    };

    const handleLayerDelete = (id: string) => {
        const newLayers = layers.filter(l => l.id !== id);
        setLayers(newLayers);
        pushHistory(newLayers);
        setSelectedLayerIds(prev => prev.filter(pid => pid !== id));
    };
    
    const deleteSelectedLayers = () => {
        if (selectedLayerIds.length === 0) return;
        const newLayers = layers.filter(l => !selectedLayerIds.includes(l.id));
        setLayers(newLayers);
        pushHistory(newLayers);
        setSelectedLayerIds([]);
    };

    const handleLayersReorder = (reorderedLayers: Layer[]) => {
        setLayers(reorderedLayers);
        pushHistory(reorderedLayers);
    };

    const duplicateLayer = (id: string): Layer => {
        const layer = layers.find(l => l.id === id);
        if (!layer) throw new Error("Layer not found");
        const newLayer = { ...layer, id: nanoid(), x: layer.x + 20, y: layer.y + 20 };
        const newLayers = [...layers, newLayer];
        setLayers(newLayers);
        pushHistory(newLayers);
        setSelectedLayerIds([newLayer.id]);
        return newLayer;
    };
    
    const duplicateSelectedLayers = (): Layer[] => {
        if (selectedLayers.length === 0) return [];
        
        let newLayers = [...layers];
        const newSelectedIds: string[] = [];
        
        // Find index of top-most selected layer to insert duplicates above
        const topMostSelectedIndex = layers.findIndex(l => l.id === selectedLayers[0].id);
        
        // Clone and insert
        // Reverse iteration to maintain relative order if inserting at a specific index
        const layersToDuplicate = [...selectedLayers].reverse(); 
        
        for(const layerToDup of layersToDuplicate) {
             const newLayer: Layer = Object.assign({}, layerToDup, { id: nanoid(), x: layerToDup.x + 20, y: layerToDup.y + 20 });
            newLayers.splice(topMostSelectedIndex, 0, newLayer);
            newSelectedIds.push(newLayer.id);
        }

        setLayers(newLayers);
        pushHistory(newLayers);
        setSelectedLayerIds(newSelectedIds);
        return newLayers.filter(l => newSelectedIds.includes(l.id));
    };

    const handleDuplicateForDrag = (): Layer[] => {
        // Logic similar to duplicate but specifically for drag-duplication (Alt+Drag)
        if (selectedLayers.length === 0) return [];
        
        const clones = selectedLayers.map(l => ({ ...l, id: nanoid() }));
        const newLayers = [...layers, ...clones]; // Add to end (top)
        
        setLayers(newLayers);
        // Don't push history yet, wait for drag end
        setSelectedLayerIds(clones.map(c => c.id));
        return clones;
    };

    const handleResizeSelectedLayers = (dimension: 'width' | 'height', newValue: number) => {
        if (selectedLayers.length === 0) return;
        const updates = selectedLayers.map(l => ({ id: l.id, props: { [dimension]: newValue } }));
        updateLayers(updates, true);
    };

    // --- Multi-Layer Actions ---
    const handleMultiLayerAction = (action: MultiLayerAction) => {
        if (selectedLayers.length < 2) return;
        
        let updates: { id: string; props: Partial<Layer> }[] = [];
        
        switch (action) {
            case 'align-left':
                const minX = Math.min(...selectedLayers.map(l => l.x));
                updates = selectedLayers.map(l => ({ id: l.id, props: { x: minX } }));
                break;
            case 'align-center':
                // Align centers horizontally
                // Center point is average of centers? Or center of bounding box? Usually center of BB.
                if (selectionBoundingBox) {
                    const centerX = selectionBoundingBox.x + selectionBoundingBox.width / 2;
                    updates = selectedLayers.map(l => ({ id: l.id, props: { x: centerX - l.width / 2 } }));
                }
                break;
            case 'align-right':
                 if (selectionBoundingBox) {
                    const maxX = selectionBoundingBox.x + selectionBoundingBox.width;
                    updates = selectedLayers.map(l => ({ id: l.id, props: { x: maxX - l.width } }));
                }
                break;
            case 'align-top':
                const minY = Math.min(...selectedLayers.map(l => l.y));
                updates = selectedLayers.map(l => ({ id: l.id, props: { y: minY } }));
                break;
            case 'align-middle':
                 if (selectionBoundingBox) {
                    const centerY = selectionBoundingBox.y + selectionBoundingBox.height / 2;
                    updates = selectedLayers.map(l => ({ id: l.id, props: { y: centerY - l.height / 2 } }));
                }
                break;
            case 'align-bottom':
                if (selectionBoundingBox) {
                    const maxY = selectionBoundingBox.y + selectionBoundingBox.height;
                    updates = selectedLayers.map(l => ({ id: l.id, props: { y: maxY - l.height } }));
                }
                break;
            case 'distribute-horizontal':
                 // Sort by X
                 const sortedH = [...selectedLayers].sort((a, b) => a.x - b.x);
                 if (sortedH.length > 2) {
                     const totalWidth = sortedH[sortedH.length - 1].x - sortedH[0].x;
                     const gap = totalWidth / (sortedH.length - 1);
                     updates = sortedH.map((l, i) => ({ id: l.id, props: { x: sortedH[0].x + gap * i } }));
                 }
                break;
            case 'distribute-vertical':
                 const sortedV = [...selectedLayers].sort((a, b) => a.y - b.y);
                 if (sortedV.length > 2) {
                     const totalHeight = sortedV[sortedV.length - 1].y - sortedV[0].y;
                     const gap = totalHeight / (sortedV.length - 1);
                     updates = sortedV.map((l, i) => ({ id: l.id, props: { y: sortedV[0].y + gap * i } }));
                 }
                break;
             case 'merge':
                handleMergeLayers();
                return; // Updates handled in merge function
             case 'delete':
                deleteSelectedLayers();
                return;
             case 'duplicate':
                duplicateSelectedLayers();
                return;
             case 'export':
                handleExportSelectedLayers();
                return;
        }

        if (updates.length > 0) {
            updateLayers(updates, true);
        }
    };
    
    // --- Canvas Operations ---

    const captureLayer = async (layer: Layer): Promise<string> => {
        if (layer.type === 'image' && layer.url) {
            return layer.url;
        }
        // For text/shape, render to canvas then export
        // Simplified: use html2canvas or similar, or just render to a temp canvas
        // Here we'll simulate by returning a placeholder or empty string if it's not an image
        // In a real app, you'd render the layer to an offscreen canvas
        return ""; 
    };

    const handleExportSelectedLayer = async () => {
        if (selectedLayers.length !== 1 || selectedLayers[0].type !== 'image' || !selectedLayers[0].url) return;
        const link = document.createElement('a');
        link.href = selectedLayers[0].url;
        link.download = `layer-${selectedLayers[0].id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportSelectedLayers = async () => {
         // Create a temporary canvas containing just the selected layers
         // Similar to 'merge' but downloads instead of adding to canvas
         if (selectedLayers.length === 0 || !selectionBoundingBox) return;

         const canvas = document.createElement('canvas');
         canvas.width = selectionBoundingBox.width;
         canvas.height = selectionBoundingBox.height;
         const ctx = canvas.getContext('2d');
         if (!ctx) return;
         
         // Sort selected layers by z-index (array order in 'layers')
         // We need to find their original indices
         const sortedSelection = layers
             .filter(l => selectedLayerIds.includes(l.id))
             // layers array is top-to-bottom visually (last element is on top)? 
             // Actually, usually last element is top. Let's assume standard render order.
             // If layers[0] is bottom, we iterate normally.
         
         for (const layer of sortedSelection) {
             // Draw logic similar to LayerItem or ImageEditorCanvas
             // This requires actual rendering logic for text/shapes which is complex to duplicate here
             // For images it's easy.
             if (layer.type === 'image' && layer.url) {
                 const img = new Image();
                 img.crossOrigin = "anonymous";
                 await new Promise<void>((resolve) => {
                     img.onload = () => resolve();
                     img.src = layer.url!;
                 });
                 
                 ctx.save();
                 // Translate to origin (0,0) of the bounding box
                 const x = layer.x - selectionBoundingBox.x;
                 const y = layer.y - selectionBoundingBox.y;
                 
                 // Apply rotation around center
                 const cx = x + layer.width / 2;
                 const cy = y + layer.height / 2;
                 
                 ctx.translate(cx, cy);
                 ctx.rotate(layer.rotation * Math.PI / 180);
                 ctx.translate(-cx, -cy);
                 
                 ctx.globalAlpha = layer.opacity / 100;
                 ctx.drawImage(img, x, y, layer.width, layer.height);
                 ctx.restore();
             }
             // ... handle text/shape rendering
         }
         
         const dataUrl = canvas.toDataURL('image/png');
         const link = document.createElement('a');
         link.href = dataUrl;
         link.download = `merged-layers-${Date.now()}.png`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
    };

    const handleBakeSelectedLayer = async () => {
         // Rasterize text/shape to image layer
         if (selectedLayers.length !== 1) return;
         // Implementation omitted for brevity, would involve rendering to canvas and replacing layer
         toast("Tính năng đang phát triển");
    };
    
    const handleMergeLayers = async () => {
        // Similar to export but adds new layer and removes selected
        toast("Tính năng gộp layer đang phát triển");
    };

    // --- AI Generation ---
    const addLog = (message: string, type: 'info' | 'prompt' | 'success' | 'error' | 'spinner' = 'info') => {
        setAiProcessLog(prev => [...prev, { id: Date.now(), message, type }]);
        if (type === 'prompt' || type === 'error') setIsLogVisible(true);
    };

    const onGenerateAILayer = async () => {
        if (aiPreset !== 'default') {
            // Handled by preset logic if preset is selected
            if (loadedPreset) {
                // Already loaded, just run logic?
                // The preset UI usually handles this. If we are triggering from sidebar:
                // We need to ensure loadedPreset is sync'd with aiPreset selection
                // But sidebar logic for `onGenerateAILayer` usually implies text-to-image or img2img via main prompt
            }
            // Fallthrough to generic generation if no specific preset logic in this function
        }

        setRunningJobCount(prev => prev + 1);
        addLog(`Đang tạo ${aiNumberOfImages} ảnh từ prompt...`, 'spinner');
        try {
            let inputImageUrls: string[] = [];
            
            // Collect images if needed
            if (selectedLayers.length > 0) {
                 // Simple mode: use first layer as input
                 // Batch mode: use all selected layers
                 // Here we assume standard text-to-image or img2img with first selected layer
                 if (selectedLayers[0].type === 'image' && selectedLayers[0].url) {
                     inputImageUrls.push(selectedLayers[0].url);
                 }
            }

            const resultUrls = await generateFromMultipleImages(
                inputImageUrls,
                aiPrompt,
                aiAspectRatio, // Use aspect ratio from state
                false // removeWatermark
            );
            
            // Add results to canvas
            resultUrls.forEach(url => {
                 addLayer({
                    type: 'image',
                    url: url,
                    x: canvasSettings.width / 2 - 150, // Center roughly
                    y: canvasSettings.height / 2 - 150,
                    width: 300, 
                    height: 300, // Placeholder size, will adjust on load if we had async image loading logic
                    rotation: 0,
                    opacity: 100,
                    blendMode: 'source-over',
                    isVisible: true,
                    isLocked: false
                });
                addImagesToGallery([url]);
            });
            
            addLog(`Đã tạo thành công ${resultUrls.length} ảnh.`, 'success');

        } catch (err) {
            const msg = err instanceof Error ? err.message : "Generation failed";
            setError(msg);
            addLog(msg, 'error');
        } finally {
            setRunningJobCount(prev => prev - 1);
        }
    };
    
    // --- Preset Handling ---
    const onPresetFileLoad = async (file: File) => {
         try {
            let presetData;
            if (file.type === 'image/png') {
                presetData = await extractJsonFromPng(file);
            } else if (file.type === 'application/json') {
                presetData = JSON.parse(await file.text());
            }

            if (presetData && presetData.viewId && presetData.state) {
                setLoadedPreset(presetData);
                setAiPreset(presetData.viewId); // Sync UI
                addLog(`Đã tải preset: ${presetData.viewId}`, 'info');
            } else {
                toast.error("File preset không hợp lệ.");
            }
        } catch (e) {
            console.error("Failed to load preset", e);
            toast.error("Lỗi đọc file preset.");
        }
    };

    const onGenerateFromPreset = async () => {
        if (!loadedPreset) return;
        setRunningJobCount(prev => prev + 1);
        addLog(`Đang chạy preset ${loadedPreset.viewId}...`, 'spinner');
        
        try {
             // Logic to handle "Random" concepts is inside generateFromPreset usually or handled here?
             // The `generateFromPreset` service handles the logic.
             // We just need to pass the selected layers (inputs).
             
             let layersToProcess: Layer[][] = [];
             
             if (isSimpleImageMode) {
                 // Multi-input mode: pass all selected layers as a single set of inputs
                 layersToProcess.push(selectedLayers);
             } else {
                 // Batch mode: treat each selected layer as a separate input set
                 selectedLayers.forEach(l => layersToProcess.push([l]));
             }
             
             if (layersToProcess.length === 0 && loadedPreset.state.uploadedImage) {
                 // Preset has embedded image, use it if no selection
                 layersToProcess.push([]);
             }

             const results: string[] = [];
             for (const layerSet of layersToProcess) {
                 const urls = layerSet.map(l => l.url!).filter(Boolean);
                 const generated = await generateFromPreset(loadedPreset, urls);
                 results.push(...generated);
             }
             
             results.forEach(url => {
                addLayer({
                    type: 'image',
                    url: url,
                    x: 100, y: 100,
                    width: 300, height: 300,
                    rotation: 0, opacity: 100,
                    blendMode: 'source-over',
                    isVisible: true, isLocked: false
                });
                addImagesToGallery([url]);
             });
             
             addLog(`Preset hoàn tất. Tạo ${results.length} ảnh.`, 'success');

        } catch (err) {
             const msg = err instanceof Error ? err.message : "Preset generation failed";
            setError(msg);
            addLog(msg, 'error');
        } finally {
            setRunningJobCount(prev => prev - 1);
        }
    };

    // --- File Handling ---
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach((file: any) => { // Using any for File/Blob to avoid strict typing issues in this context
                if (file.type && file.type.startsWith('image/')) {
                     const reader = new FileReader();
                     reader.onloadend = () => {
                         if (typeof reader.result === 'string') handleAddImage(reader.result);
                     };
                     reader.readAsDataURL(file as Blob);
                } else if (file.name && (file.name.endsWith('.json') || file.type === 'application/json' || file.type === 'image/png')) {
                    // Try loading as preset first if in start screen or dropped on preset area
                    // But if dropped on canvas, could be canvas state?
                    // For now, let's assume JSON/PNG with metadata on canvas is a preset load or canvas load?
                    // If it's a full canvas state save:
                    // ... implementation for loading canvas state
                }
            });
        }
    };
    
    // --- Setup & Lifecycle ---
    const handleCreateNew = () => {
        setLayers([]);
        setHistory([]);
        setHistoryIndex(-1);
        setCanvasInitialized(true);
    };

    const handleConfirmNew = () => {
        handleCreateNew();
        setIsConfirmingNew(false);
    };

    const handleCloseAndReset = () => {
        setCanvasInitialized(false);
        setLayers([]);
        setHistory([]);
        setHistoryIndex(-1);
        onClose();
    };

    // --- Drag & Drop ---
    const handleStartScreenDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsStartScreenDraggingOver(true); };
    const handleStartScreenDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsStartScreenDraggingOver(false); };
    const handleStartScreenDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsStartScreenDraggingOver(false);
        if (e.dataTransfer.files) {
             // Handle files
             // For start screen, maybe auto-create canvas and add images
             handleCreateNew();
             // Then process files
             Array.from(e.dataTransfer.files).forEach((file: any) => { // Use any to bypass TS checks for File vs Blob
                 const reader = new FileReader();
                 reader.onloadend = () => { if (typeof reader.result === 'string') handleAddImage(reader.result); };
                 reader.readAsDataURL(file as Blob);
             });
        }
    };

    // --- Presets Data ---
    // In a real app, these would come from the apps config
    const presets: AIPreset[] = [
        { id: 'default', name: { vi: 'Mặc định', en: 'Default' }, description: { vi: 'Tạo ảnh từ prompt', en: 'Generate from prompt' }, requiresImageContext: false, refine: false, promptTemplate: { vi: '', en: '' } },
        // ... Populate from settings.apps
    ];

    return {
        // State
        canvasInitialized, layers, setLayers, canvasSettings, setCanvasSettings, isInfiniteCanvas, setIsInfiniteCanvas,
        selectedLayerIds, setSelectedLayerIds, selectedLayers, selectedLayerId, selectionBoundingBox,
        activeCanvasTool, setActiveCanvasTool, interaction, setInteraction, panX, panY, scale, zoomDisplay, setZoomDisplay, panStartRef, isSpacePanning,
        historyIndex, history,
        aiPrompt, setAiPrompt, aiPreset, setAiPreset, runningJobCount, error, isSimpleImageMode, setIsSimpleImageMode, aiProcessLog, isLogVisible, setIsLogVisible, isChatbotOpen, setIsChatbotOpen, aiNumberOfImages, setAiNumberOfImages, aiAspectRatio, setAiAspectRatio,
        loadedPreset, setLoadedPreset,
        isGalleryOpen, setIsGalleryOpen, isWebcamOpen, setIsWebcamOpen, isStartScreenDraggingOver, fileInputRef,
        isConfirmingClose, setIsConfirmingClose, isConfirmingNew, setIsConfirmingNew,
        shapeFillColor, setShapeFillColor,
        // Derived
        canUndo, canRedo, selectedLayersForPreset,
        // Actions
        handleCreateNew, handleConfirmNew, handleCloseAndReset,
        handleAddImage, handleAddText, addLayer,
        updateLayers, handleLayerUpdate, handleLayerDelete, deleteSelectedLayers,
        handleLayersReorder, duplicateLayer, duplicateSelectedLayers, handleDuplicateForDrag, handleResizeSelectedLayers,
        handleMultiLayerAction, handleUndo, handleRedo,
        captureLayer, handleExportSelectedLayer, handleExportSelectedLayers, handleBakeSelectedLayer, handleMergeLayers,
        onGenerateAILayer, onCancelGeneration: () => { /* Implement cancel */ },
        onPresetFileLoad, onGenerateFromPreset,
        handleFileSelected,
        handleStartScreenDragOver, handleStartScreenDragLeave, handleStartScreenDrop,
        handleUploadClick: () => fileInputRef.current?.click(),
        
        // UI Helpers
        t, language, presets, imageGallery, generationHistory,
        openImageEditor: () => {}, // Placeholder, pass actual opener if needed or use context inside components
        
        // Chatbot
        onOpenChatbot: () => setIsChatbotOpen(true),
        handleCloseChatbot: () => setIsChatbotOpen(false),
    };
};
