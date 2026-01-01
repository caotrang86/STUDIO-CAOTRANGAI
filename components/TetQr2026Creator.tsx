/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { generateTetQr2026Image, editImageWithPrompt } from '../services/geminiService';
import ActionablePolaroidCard from './ActionablePolaroidCard';
import Lightbox from './Lightbox';
import { 
    AppScreenHeader,
    ImageUploader,
    ResultsView,
    ImageForZip,
    AppOptionsLayout,
    OptionsPanel,
    type TetQr2026CreatorState,
    useLightbox,
    useVideoGeneration,
    processAndDownloadAll,
    useAppControls,
    embedJsonInPng,
    downloadImage,
} from './uiUtils';
import { getCurrentUsername, getUserCredits, decreaseUserCredits } from '../lib/credits';

// Common Vietnamese Banks for VietQR (BIN codes)
const VIET_QR_BANKS = [
    { code: '970436', shortName: 'Vietcombank', name: 'Vietcombank' },
    { code: '970415', shortName: 'VietinBank', name: 'VietinBank' },
    { code: '970407', shortName: 'Techcombank', name: 'Techcombank' },
    { code: '970422', shortName: 'MBBank', name: 'MB Bank' },
    { code: '970416', shortName: 'ACB', name: 'ACB' },
    { code: '970418', shortName: 'BIDV', name: 'BIDV' },
    { code: '970432', shortName: 'VPBank', name: 'VPBank' },
    { code: '970423', shortName: 'TPBank', name: 'TPBank' },
    { code: '970405', shortName: 'Agribank', name: 'Agribank' },
    { code: '970403', shortName: 'Sacombank', name: 'Sacombank' },
    { code: '970441', shortName: 'VIB', name: 'VIB' },
    { code: '970443', shortName: 'SHB', name: 'SHB' },
    { code: '970437', shortName: 'HDBank', name: 'HDBank' },
    { code: '970429', shortName: 'SCB', name: 'SCB' },
    { code: '970454', shortName: 'VietCapitalBank', name: 'BanViet' },
    { code: '970406', shortName: 'DongA Bank', name: 'DongA Bank' },
    { code: '970419', shortName: 'NCB', name: 'NCB' },
    { code: '970412', shortName: 'PVcomBank', name: 'PVcomBank' },
    { code: '970430', shortName: 'PGBank', name: 'PGBank' },
    { code: '970431', shortName: 'Eximbank', name: 'Eximbank' }
];

interface TetQr2026CreatorProps {
    mainTitle: string;
    subtitle: string;
    uploaderCaption: string;
    uploaderDescription: string;
    addImagesToGallery: (images: string[]) => void;
    appState: TetQr2026CreatorState;
    onStateChange: (newState: TetQr2026CreatorState) => void;
    onReset: () => void;
    onGoBack: () => void;
    logGeneration: (appId: string, preGenState: any, thumbnailUrl: string) => void;
}

const TetQr2026Creator: React.FC<TetQr2026CreatorProps> = (props) => {
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

    // If bankName is empty or just text, try to map it to a code if it was saved previously, or default to first
    useEffect(() => {
        if (!appState.options.bankName) {
            handleOptionChange('bankName', VIET_QR_BANKS[0].code);
        }
    }, []);

    useEffect(() => {
        setLocalNotes(appState.options.notes);
    }, [appState.options.notes]);

    const lightboxImages = [appState.uploadedImage, appState.generatedImage, appState.qrCodeUrl, ...appState.historicalImages].filter((img): img is string => !!img);

    const handleImageSelectedForUploader = (imageDataUrl: string) => {
        onStateChange({
            ...appState,
            stage: 'configuring',
            uploadedImage: imageDataUrl,
            generatedImage: null,
            qrCodeUrl: null,
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

    const handleOptionChange = (field: string, value: any) => {
        onStateChange({
            ...appState,
            options: { ...appState.options, [field]: value }
        });
    };

    // --- QR Code Generation & Styling Logic ---
    const generateRealStyledQrCode = async (): Promise<string> => {
        const { bankName, accountNumber, accountName, amount, message } = appState.options;
        
        // 1. Fetch VietQR Image
        const encodedName = encodeURIComponent(accountName.toUpperCase());
        const encodedMsg = encodeURIComponent(message || '');
        const amountParam = amount ? `&amount=${amount}` : '';
        
        // bankName here stores the BIN code from the dropdown
        const qrApiUrl = `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact.png?accountName=${encodedName}&addInfo=${encodedMsg}${amountParam}`;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                // 2. Style the QR (Rounded corners, Neon Border) using Canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Cannot create canvas context"));

                const size = 500;
                const padding = 25;
                const borderRadius = 20;
                
                canvas.width = size + padding * 2;
                canvas.height = size + padding * 2;

                // A. Draw Glow/Shadow
                ctx.shadowColor = "rgba(255, 215, 0, 0.7)"; // Gold glow
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // B. Draw Background (Rounded Rect)
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; // 90% opacity white
                ctx.beginPath();
                ctx.roundRect(padding, padding, size, size, borderRadius);
                ctx.fill();
                
                // Reset shadow for inner image to stay crisp
                ctx.shadowBlur = 0;
                
                // C. Draw QR Code Image (Clipped)
                ctx.save();
                ctx.clip(); // Clip to the round rect we just drew
                // Draw the fetched QR image centered
                ctx.drawImage(img, padding + 10, padding + 10, size - 20, size - 20);
                ctx.restore();

                // D. Draw Neon Border
                ctx.beginPath();
                ctx.roundRect(padding, padding, size, size, borderRadius);
                ctx.lineWidth = 8;
                ctx.strokeStyle = "#FFD700"; // Gold border
                ctx.stroke();
                
                // Add a subtle inner red border for Tet vibe
                ctx.beginPath();
                ctx.roundRect(padding + 6, padding + 6, size - 12, size - 12, borderRadius - 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(218, 37, 29, 0.6)"; // Tet Red
                ctx.stroke();

                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
                reject(new Error("Failed to generate QR code. Please check bank info."));
            };
            img.src = qrApiUrl;
        });
    };

    const executeGeneration = async () => {
        const { bankName, accountNumber, accountName } = appState.options;

        if (!bankName || !accountNumber || !accountName) {
            toast.error(t('qr2026.error_missing_fields'));
            return;
        }

        // --- Credit Check ---
        const username = getCurrentUsername();
        if (!username) { toast.error("Vui lòng đăng nhập."); return; }
        if (getUserCredits(username) <= 0) { 
            toast.error("Hết lượt tạo ảnh."); 
            return; 
        }
        // --------------------

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            // 1. Generate the REAL styled QR Code image first
            const styledQrUrl = await generateRealStyledQrCode();
            
            // 2. Generate AI Image, passing the QR code as an input for the model to hold
            // We pass styledQrUrl to the service
            const resultUrl = await generateTetQr2026Image(
                appState.uploadedImage, 
                { ...appState.options, qrImageBase64: styledQrUrl }
            );
            
            // Deduct Credit
            decreaseUserCredits(username);
            refreshCredits();
            toast.success(t('tetQr2026_status_ready'));

            const settingsToEmbed = {
                viewId: 'tet-qr-2026',
                state: { ...appState, stage: 'configuring', generatedImage: null, qrCodeUrl: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            
            logGeneration('tet-qr-2026', preGenState, urlWithMetadata);

            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                qrCodeUrl: styledQrUrl, // Save the generated QR to display separately
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata, styledQrUrl]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error generating content.";
            onStateChange({ ...appState, stage: 'results', error: errorMessage });
        }
    };

    const handleRegeneration = async (prompt: string) => {
        if (!appState.generatedImage) return;
        const username = getCurrentUsername();
        if (!username) { toast.error("Vui lòng đăng nhập."); return; }
        if (getUserCredits(username) <= 0) { 
             toast.error("Hết lượt tạo ảnh."); 
            return; 
        }

        const preGenState = { ...appState };
        onStateChange({ ...appState, stage: 'generating', error: null });

        try {
            const resultUrl = await editImageWithPrompt(appState.generatedImage, prompt);
            
            decreaseUserCredits(username);
            refreshCredits();
            toast.success(t('tetQr2026_status_ready'));

            const settingsToEmbed = {
                viewId: 'tet-qr-2026',
                state: { ...appState, stage: 'configuring', generatedImage: null, qrCodeUrl: null, historicalImages: [], error: null },
            };
            const urlWithMetadata = await embedJsonInPng(resultUrl, settingsToEmbed, settings.enableImageMetadata);
            logGeneration('tet-qr-2026', preGenState, urlWithMetadata);
            onStateChange({
                ...appState,
                stage: 'results',
                generatedImage: urlWithMetadata,
                historicalImages: [...appState.historicalImages, urlWithMetadata],
            });
            addImagesToGallery([urlWithMetadata]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error regenerating.";
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
                filename: 'anh-tham-chieu',
                folder: 'input',
            });
        }
        if (appState.qrCodeUrl) {
             inputImages.push({
                url: appState.qrCodeUrl,
                filename: 'qr-code-lixi',
                folder: 'output',
            });
        }
        
        processAndDownloadAll({
            inputImages,
            historicalImages: appState.historicalImages,
            videoTasks,
            zipFilename: 'anh-tet-qr-2026.zip',
            baseOutputFilename: 'tet-qr-2026',
        });
    };

    const isLoading = appState.stage === 'generating';

    // Helper for rendering selects
    const renderSelectGroup = (id: string, labelKey: string, options: {value: string, labelKey: string}[]) => (
        <div className="flex-1 min-w-[140px]">
            <label htmlFor={id} className="block text-left base-font font-bold text-sm text-neutral-300 mb-1">
                {t(labelKey)}
            </label>
            <select
                id={id}
                value={(appState.options as any)[id]}
                onChange={(e) => handleOptionChange(id as keyof TetQr2026CreatorState['options'], e.target.value)}
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

                {appState.stage === 'configuring' && (
                    <AppOptionsLayout>
                        {appState.uploadedImage && (
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
                        )}
                        <OptionsPanel>
                            <h2 className="base-font font-bold text-2xl text-yellow-400 border-b border-yellow-400/20 pb-2">{t('qr2026.form_title')}</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="bankName" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.bank_label')} *</label>
                                    <select
                                        id="bankName"
                                        value={appState.options.bankName}
                                        onChange={(e) => handleOptionChange('bankName', e.target.value)}
                                        className="form-input !py-2"
                                    >
                                        {VIET_QR_BANKS.map(bank => (
                                            <option key={bank.code} value={bank.code}>{bank.shortName} ({bank.name})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="accountNumber" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.account_label')} *</label>
                                    <input
                                        type="text"
                                        id="accountNumber"
                                        value={appState.options.accountNumber}
                                        onChange={(e) => handleOptionChange('accountNumber', e.target.value)}
                                        className="form-input"
                                        placeholder="0123456789"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="accountName" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.owner_label')} *</label>
                                    <input
                                        type="text"
                                        id="accountName"
                                        value={appState.options.accountName}
                                        onChange={(e) => handleOptionChange('accountName', e.target.value)}
                                        className="form-input"
                                        placeholder="NGUYEN VAN A"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.amount_label')}</label>
                                    <input
                                        type="number"
                                        id="amount"
                                        value={appState.options.amount}
                                        onChange={(e) => handleOptionChange('amount', e.target.value)}
                                        className="form-input"
                                        placeholder="VD: 68000"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.message_label')}</label>
                                <input
                                    type="text"
                                    id="message"
                                    value={appState.options.message}
                                    onChange={(e) => handleOptionChange('message', e.target.value)}
                                    className="form-input"
                                    placeholder="Lixi Tet 2026"
                                />
                            </div>

                            <div className="border-t border-neutral-700/50 my-4"></div>
                            
                            <h3 className="base-font font-bold text-lg text-yellow-400 mb-2">Tùy chọn Ảnh AI</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderSelectGroup('mode', 'qr2026.mode_label', [
                                    { value: 'adult', labelKey: 'qr2026.mode_adult' },
                                    { value: 'kid', labelKey: 'qr2026.mode_kid' },
                                ])}
                                {renderSelectGroup('gender', 'spring2026.gender_label', [
                                    { value: 'male', labelKey: 'spring2026.gender_male' },
                                    { value: 'female', labelKey: 'spring2026.gender_female' },
                                ])}
                                {renderSelectGroup('outfit', 'qr2026.outfit_label', [
                                    { value: 'red_traditional', labelKey: 'qr2026.outfit_red_traditional' },
                                    { value: 'blue_royal', labelKey: 'qr2026.outfit_blue_royal' },
                                    { value: 'gold_festival', labelKey: 'qr2026.outfit_gold_festival' },
                                    { value: 'suit', labelKey: 'qr2026.outfit_suit' },
                                    { value: 'ao_dai_modern_female', labelKey: 'qr2026.outfit_ao_dai_modern_female' },
                                    { value: 'ao_dai_cach_tan_female', labelKey: 'qr2026.outfit_ao_dai_cach_tan_female' },
                                    { value: 'vest_ceo_modern_male', labelKey: 'qr2026.outfit_vest_ceo_modern_male' },
                                    { value: 'vest_ceo_modern_female', labelKey: 'qr2026.outfit_vest_ceo_modern_female' },
                                    { value: 'kid_tet_boy', labelKey: 'qr2026.outfit_kid_tet_boy' },
                                    { value: 'kid_tet_girl', labelKey: 'qr2026.outfit_kid_tet_girl' },
                                    { value: 'custom', labelKey: 'qr2026.outfit_custom' },
                                ])}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">{t('common_aspectRatio')}</label>
                                    <select
                                        value={appState.options.aspectRatio}
                                        onChange={(e) => handleOptionChange('aspectRatio', e.target.value)}
                                        className="form-input !py-1.5 !text-sm"
                                    >
                                         <option value="3:4">3:4 (Chân dung)</option>
                                         <option value="9:16">9:16 (Story)</option>
                                         <option value="1:1">1:1 (Vuông)</option>
                                    </select>
                                </div>
                            </div>

                            {appState.options.outfit === 'custom' && (
                                <div className="mt-2">
                                     <input
                                        type="text"
                                        value={appState.options.customOutfit || ''}
                                        onChange={(e) => handleOptionChange('customOutfit', e.target.value)}
                                        className="form-input"
                                        placeholder={t('qr2026.outfit_custom_placeholder')}
                                    />
                                </div>
                            )}

                            <div className="mt-4">
                                <label htmlFor="greeting" className="block text-sm font-medium text-neutral-300 mb-1">{t('qr2026.greeting_label')}</label>
                                <input
                                    type="text"
                                    id="greeting"
                                    value={appState.options.greeting || ''}
                                    onChange={(e) => handleOptionChange('greeting', e.target.value)}
                                    className="form-input"
                                    placeholder={t('qr2026.greeting_placeholder')}
                                />
                            </div>

                            <div>
                                <label htmlFor="notes" className="block text-left base-font font-bold text-sm text-neutral-300 mb-1">{t('common_additionalNotesOptional')}</label>
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
                                    className="form-input h-16 !text-sm"
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center pt-2">
                                <input
                                    type="checkbox"
                                    id="remove-watermark-qr"
                                    checked={appState.options.removeWatermark}
                                    onChange={(e) => handleOptionChange('removeWatermark', e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-neutral-800"
                                    aria-label={t('common_removeWatermark')}
                                />
                                <label htmlFor="remove-watermark-qr" className="ml-3 block text-sm font-medium text-neutral-300">
                                    {t('common_removeWatermark')}
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button onClick={onReset} className="btn btn-secondary">{t('common_changeImage')}</button>
                                <button onClick={executeGeneration} className="btn btn-primary" disabled={isLoading}>{isLoading ? t('qr2026.status_generating') : t('tetQr2026_generate_button')}</button>
                            </div>
                        </OptionsPanel>
                    </AppOptionsLayout>
                )}
            </div>

             {(appState.stage === 'generating' || appState.stage === 'results') && (
                <ResultsView
                    stage={appState.stage}
                    originalImage={appState.uploadedImage}
                    onOriginalClick={() => appState.uploadedImage && openLightbox(lightboxImages.indexOf(appState.uploadedImage))}
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
                        key="generated-tet-portrait"
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
                    
                    {appState.qrCodeUrl && (
                        <motion.div
                            className="w-full md:w-auto flex-shrink-0"
                            key="generated-qr-code"
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.25 }}
                        >
                            <ActionablePolaroidCard
                                type="display"
                                caption={t('qr2026.qr_preview_title')}
                                status={isLoading ? 'pending' : 'done'}
                                mediaUrl={appState.qrCodeUrl}
                                onClick={() => openLightbox(lightboxImages.indexOf(appState.qrCodeUrl!))}
                                onDownload={() => downloadImage(appState.qrCodeUrl!, `Tet2026-QR-VietQR`)}
                            />
                             <p className="text-xs text-neutral-400 text-center mt-2 max-w-[250px] mx-auto">{t('qr2026.qr_preview_hint')}</p>
                        </motion.div>
                    )}
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

export default TetQr2026Creator;