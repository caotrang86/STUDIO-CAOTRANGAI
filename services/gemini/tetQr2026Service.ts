/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { 
    processApiError, 
    parseDataUrl, 
    callGeminiWithRetry, 
    processGeminiResponse 
} from './baseService';

interface TetQr2026Options {
    gender: string; 
    mode: 'adult' | 'kid';
    outfit: string;
    customOutfit?: string;
    greeting?: string; // Text overlay on image
    style?: string; 
    notes?: string;
    removeWatermark?: boolean;
    aspectRatio?: string;
    qrImageBase64?: string; // The generated styled QR code image
}

/**
 * Generates a Tet 2026 QR portrait image based on a user photo and a QR code.
 * @param imageDataUrl The data URL of the user's photo (optional).
 * @param options Configuration options.
 * @returns A promise resolving to the generated image data URL.
 */
export async function generateTetQr2026Image(
    imageDataUrl: string | null,
    options: TetQr2026Options
): Promise<string> {
    const parts: any[] = [];
    
    // --- 1. Images First (Priority: Face -> QR) ---
    
    // Reference Face Image - Priority #1 for identity
    if (imageDataUrl) {
        const { mimeType, data: base64Data } = parseDataUrl(imageDataUrl);
        parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    // QR Code Image - Priority #2 for object consistency
    if (options.qrImageBase64) {
        const { mimeType, data } = parseDataUrl(options.qrImageBase64);
        parts.push({ inlineData: { mimeType, data } });
    }

    // --- 2. Prompt Construction ---
    const promptParts: string[] = [];

    // --- Outfit Logic ---
    let outfitDesc = '';
    if (options.outfit === 'custom' && options.customOutfit) {
        outfitDesc = options.customOutfit;
    } else {
        const outfitMap: Record<string, string> = {
            'blue_royal': 'light blue traditional ao dai with gold brocade patterns',
            'red_traditional': 'traditional bright red Ao Dai, symbol of luck',
            'gold_festival': 'shimmering golden royal Ao Dai',
            'suit': 'modern luxury business suit (vest)',
            'child_tet': 'cute festive Tet outfit (Ao Dai cach tan) with bright colors',
            'ao_dai_modern_female': "modern Vietnamese ao dai dress, elegant and fashionable",
            'ao_dai_cach_tan_female': "contemporary, creative Vietnamese ao dai with modern patterns",
            'vest_ceo_modern_male': "modern CEO-style suit, sharp, professional, luxury fabric",
            'vest_ceo_modern_female': "modern businesswoman suit, stylish and confident",
            'kid_tet_boy': "Tet festival outfit for boys, cute and joyful",
            'kid_tet_girl': "Tet festival outfit for girls, cute and joyful"
        };
        outfitDesc = outfitMap[options.outfit] || outfitMap['blue_royal'];
    }

    // --- Base Prompt with Identity Link ---
    let subjectDescription = "Portrait of the same Vietnamese person from the reference photo";
    if (options.mode === 'kid') {
        subjectDescription = "Portrait of the same Vietnamese child from the reference photo";
    }

    promptParts.push(
        `${subjectDescription},`,
        `wearing ${outfitDesc},`,
        `holding a glowing framed area for the QR code in front of their chest,`,
        `eye-level, gentle smile,`,
        `festive Vietnamese New Year (Tet) background, vibrant yellow Mai flowers, red firecrackers, glowing lanterns, traditional Banh Chung, gift boxes, golden ingots, prominent 3D golden text 'HAPPY NEW YEAR 2026', rich color palette, gold, red, yellow, blue, green, warm studio lighting, shallow depth of field, bokeh, joyful, celebratory, traditional, prosperous, highly detailed, high resolution, photographic.`
    );

    // --- QR Instruction ---
    if (options.qrImageBase64) {
        promptParts.push(
            '**CORE INSTRUCTION - QR CODE:** The subject is holding the **exact** glowing QR code frame provided in the second input image. Blend this QR code object naturally into the scene (hands holding it) but **DO NOT DISTORT the QR pattern**. It must look like a real, scannable object held by the person. with a real QR code overlayed in the framed area (added programmatically after generation).'
        );
    }

    // --- Greeting Text Overlay ---
    if (options.greeting && options.greeting.trim()) {
        promptParts.push(
            `**Modification - Text:** Add Vietnamese New Year greeting text on the poster: '${options.greeting}', in a gold, glowing calligraphy style, readable but not blocking the face or the QR code.`
        );
    }

    // --- Strong Identity Preservation Block ---
    if (imageDataUrl) {
        promptParts.push(
            '**CRITICAL - IDENTITY PRESERVATION:**',
            'Use the uploaded reference face as the main identity anchor.',
            'Preserve the person’s identity from the reference photo:',
            'same face shape, jawline, eyes, nose, lips, hairline and skin tone.',
            'Very high facial similarity to the reference image.',
            'Do not change age or gender compared to the reference photo.'
        );
    }

    if (options.notes) {
        promptParts.push(`**User Extra Details:** ${options.notes}`);
    }
    
    // --- Negative Prompt ---
    promptParts.push(
        '**Negative Prompt:**',
        'Do not change the face identity.',
        'Avoid face reshaping, face slimming, or face beautification filters.',
        'Avoid anime, illustration or caricature style.',
        'No unrealistic skin smoothing or plastic skin.',
        'text (except specified), watermark, signature, blurry, distorted QR, bad hands, deformed fingers, low resolution, ugly, deformed.'
    );

    const prompt = promptParts.join('\n');
    parts.push({ text: prompt });

    const config: any = {};
    
    let targetRatio = options.aspectRatio;
    if (!targetRatio || targetRatio === 'Giữ nguyên') {
         targetRatio = '3:4'; // Default for portraits
    }

    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '4:5', '3:2', '5:4', '21:9'];
    if (targetRatio && validRatios.includes(targetRatio)) {
        config.imageConfig = { aspectRatio: targetRatio };
    }

    try {
        console.log("Generating Tet QR 2026 with identity-focused prompt:", prompt);
        // Ensure the prompt part is last in the array if mixing text and images, although logic handles it.
        const response = await callGeminiWithRetry(parts, config);
        return processGeminiResponse(response);
    } catch (error) {
        const processedError = processApiError(error);
        console.error("Error generating Tet QR 2026 image:", processedError);
        throw processedError;
    }
}