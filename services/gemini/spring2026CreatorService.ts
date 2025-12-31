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

interface Spring2026Options {
    gender: string;
    pose: string;
    outfit: string;
    scene: string;
    textOverlay: string;
    detailLevel: string;
    notes?: string;
    removeWatermark?: boolean;
    aspectRatio?: string;
}

/**
 * Generates a Spring 2026 themed image based on a user photo.
 * @param imageDataUrl The data URL of the user's photo.
 * @param options Configuration options.
 * @returns A promise resolving to the generated image data URL.
 */
export async function generateSpring2026Image(
    imageDataUrl: string,
    options: Spring2026Options
): Promise<string> {
    const { mimeType, data: base64Data } = parseDataUrl(imageDataUrl);
    const imagePart = { inlineData: { mimeType, data: base64Data } };

    // Base Prompt Construction
    const promptParts = [
        'Vietnamese New Year 2026 studio portrait, elegant asian subject wearing traditional costume, soft warm studio lighting, bright red festive background, red lanterns, lucky envelopes, firecrackers, kumquat tree and peach blossoms, cinematic composition, 8k resolution, sharp focus, happy spring festival atmosphere.'
    ];

    // Gender & Subject
    const genderMap: Record<string, string> = {
        'female': 'elegant young woman',
        'male': 'handsome young man',
        'girl': 'cute little girl',
        'boy': 'cute little boy'
    };
    const subject = genderMap[options.gender] || 'person';
    promptParts.push(`Subject: ${subject}.`);

    // Outfit
    const outfitMap: Record<string, string> = {
        'ao_dai_classic': 'wearing traditional red ao dai with embroidered golden patterns',
        'ao_dai_crane': 'wearing luxurious red ao dai embroidered with white cranes and lotus flowers',
        'ao_dai_dragon': 'wearing majestic red ao dai with golden dragon and phoenix embroidery',
        'ao_dai_kid': 'wearing cute traditional red festive outfit (ao dai cach tan) for kids'
    };
    if (options.outfit && outfitMap[options.outfit]) {
        promptParts.push(`Outfit: ${outfitMap[options.outfit]}.`);
    }

    // Pose
    const poseMap: Record<string, string> = {
        'fan_single': 'holding a red folding paper fan in one hand, elegant pose',
        'fan_double': 'holding two folding fans, one in each hand, artistic pose',
        'closeup': 'close-up portrait face shot, looking at camera, winking or smiling',
        'side_smile': 'standing slightly sideways, looking back over shoulder, smiling brightly'
    };
    if (options.pose && poseMap[options.pose]) {
        promptParts.push(`Pose: ${poseMap[options.pose]}.`);
    }

    // Scene / Background details
    const sceneMap: Record<string, string> = {
        'studio_red': 'Background: Professional red studio backdrop with soft spotlight',
        'lanterns': 'Background: Filled with hanging red lanterns, flying paper confetti, lucky money envelopes',
        'flowers': 'Background: Surrounded by blooming peach blossoms (hoa dao), yellow apricot blossoms (hoa mai) and kumquat trees',
        'lucky_decor': 'Background: Decorated with traditional calligraphy (Cau Doi Do), gold ingots, and Lucky Fu (Phuc) symbols'
    };
    if (options.scene && sceneMap[options.scene]) {
        promptParts.push(`${sceneMap[options.scene]}.`);
    }

    // Text Overlay
    if (options.textOverlay === 'hny_en') {
        promptParts.push('Add golden text "Happy New Year 2026" in an elegant font in the top right or center area.');
    } else if (options.textOverlay === 'hny_vi') {
        promptParts.push('Add golden calligraphy text "Chúc Mừng Năm Mới 2026" in the top area.');
    }

    // Detail Level
    if (options.detailLevel === 'ultra') {
        promptParts.push('Quality: Ultra-detailed, 8k, Masterpiece, Ray tracing, HDR.');
    } else if (options.detailLevel === 'high') {
        promptParts.push('Quality: High resolution, detailed textures, professional photography.');
    }

    // Aspect Ratio specific instructions
    if (options.aspectRatio && options.aspectRatio !== 'Giữ nguyên') {
        promptParts.push(`**Layout Requirement:** The result MUST be exactly aspect ratio ${options.aspectRatio}.`);
    }

    // Identity Preservation
    promptParts.push('**Important Instruction:** Keep the face of the person in the input image exactly the same (100% facial preservation). Blend the face naturally with the new body and outfit.');

    // User extra notes
    if (options.notes) {
        promptParts.push(`User extra details: ${options.notes}`);
    }

    // Negative Prompt
    if (options.removeWatermark) {
        promptParts.push('Negative Prompt: text (unless specified), watermark, signature, logo, low quality, bad anatomy, distorted face, ugly, blurry.');
    }

    const prompt = promptParts.join('\n');
    const textPart = { text: prompt };

    const config: any = {};
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '4:5', '3:2', '5:4', '21:9'];
    if (options.aspectRatio && options.aspectRatio !== 'Giữ nguyên' && validRatios.includes(options.aspectRatio)) {
        config.imageConfig = { aspectRatio: options.aspectRatio };
    }

    try {
        console.log("Generating Spring 2026 image with prompt:", prompt);
        const response = await callGeminiWithRetry([imagePart, textPart], config);
        return processGeminiResponse(response);
    } catch (error) {
        const processedError = processApiError(error);
        console.error("Error generating Spring 2026 image:", processedError);
        throw processedError;
    }
}