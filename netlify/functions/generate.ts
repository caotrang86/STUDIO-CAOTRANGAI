import type { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
// Import Buffer to fix "Cannot find name 'Buffer'" errors in Node.js environment
import { Buffer } from 'buffer';

interface ParsedBody {
  mode: string;
  name: string;
  job: string;
  phone: string;
  outfit: string;
  portraitStyle: string;
  faceBuffer: Buffer | null;
  faceMimeType: string | null;
}

function json(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(payload),
  };
}

function parseMultipart(bodyBase64: string, contentType: string): ParsedBody {
  const result: ParsedBody = {
    mode: "nameplate",
    name: "",
    job: "",
    phone: "",
    outfit: "",
    portraitStyle: "",
    faceBuffer: null,
    faceMimeType: null,
  };

  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match ? (match[1] || match[2]) : null;
  if (!boundary) return result;

  const bodyBuffer = Buffer.from(bodyBase64, "base64");
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let lastIndex = 0;

  while (true) {
    const startIndex = bodyBuffer.indexOf(boundaryBuffer, lastIndex);
    if (startIndex === -1) break;

    const afterBoundary = startIndex + boundaryBuffer.length;
    const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, afterBoundary + 2);
    if (nextBoundaryIndex === -1) break;

    const partBuffer = bodyBuffer.slice(afterBoundary + 2, nextBoundaryIndex - 2);
    const doubleCRLF = Buffer.from("\r\n\r\n");
    const headerEndIndex = partBuffer.indexOf(doubleCRLF);
    if (headerEndIndex !== -1) {
      const headerText = partBuffer.slice(0, headerEndIndex).toString("utf-8");
      const content = partBuffer.slice(headerEndIndex + 4);
      const nameMatch = headerText.match(/name="([^"]+)"/);
      const fieldName = nameMatch ? nameMatch[1] : "";

      if (fieldName === "face") {
        result.faceBuffer = content;
        const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        result.faceMimeType = (typeMatch?.[1] || "image/jpeg").trim();
      } else if (fieldName === "mode") result.mode = content.toString("utf-8");
      else if (fieldName === "name") result.name = content.toString("utf-8");
      else if (fieldName === "job") result.job = content.toString("utf-8");
      else if (fieldName === "phone") result.phone = content.toString("utf-8");
      else if (fieldName === "outfit") result.outfit = content.toString("utf-8");
      else if (fieldName === "portraitStyle") result.portraitStyle = content.toString("utf-8");
    }
    lastIndex = nextBoundaryIndex;
  }
  return result;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, "");
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Correctly initialize GoogleGenAI using the process.env.API_KEY directly as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const contentType = event.headers["content-type"] || "";
    // Handle body encoding correctly
    const bodyBase64 = event.isBase64Encoded ? event.body! : Buffer.from(event.body!, "utf-8").toString("base64");
    const parsed = parseMultipart(bodyBase64, contentType);

    if (!parsed.faceBuffer) return json(400, { error: "Thiếu ảnh chân dung." });

    let prompt = "";

    if (parsed.mode === "calendar") {
      prompt = `
Use the uploaded face photo as the primary reference. Preserve facial structure, expression, and natural skin tone exactly as in the original image. Do not stylize, beautify, or alter the face. 
If only the face is visible in the uploaded image, complete the subject’s appearance in a natural, modest, and realistic way. 
Clothing must be simple, calm, and appropriate for a real-life setting, without logos, dramatic fashion elements, or stylized costumes. 
The result must feel like an authentic photograph of a real person. 
Place the subject in a candid seated position at an outdoor café at night. 
The subject is seated naturally at a small table, body slightly turned, not facing the camera directly. 
Posture is relaxed and thoughtful, as if captured unintentionally, not posed. 
Create a realistic urban night café environment with subtle depth. 
Foreground includes a simple café table and chair. 
Background shows distant city lights and urban landscape, calm and unobtrusive, with realistic night ambience. 
Lighting is soft ambient night lighting with balanced contrast, consistent with real photography. 
No cinematic glow, no dramatic rim light, no artificial effects. 
Position the subject on the right side of the frame. 
Reserve clear negative space on the left side for a 12-month calendar layout for 2026. 
The calendar is integrated as a design element, not a panel or UI. 
Use soft edges and translucent tones so the calendar blends naturally into the scene. 
Calendar Note: January 1st, 2026 is a Thursday. Ensure the 12-month calendar for the year 2026 is legible and correctly formatted on the left side.
      `.trim();
    } else {
      const jobLine = parsed.job ? `Line2: "${parsed.job}" -> Font style: Elegant Cursive / Calligraphy Script.` : `Line2: (LEAVE BLANK)`;
      prompt = `
Ultra hyper-realistic, close-up cinematic 3D shot of a luxury dark mahogany wooden nameplate on a premium leather executive desk pad.
- LEFT PORTRAIT STYLE: "3D Polychrome Relief" (Phù điêu màu 3D). The person is sculpted sticking out of the wood board, painted with REALISTIC COLORS matching photo. Must match EXACT facial identity.
- RIGHT TEXT STYLE (Gold Embossed Metal):
  1. Line 1 (Name): "${parsed.name}" -> Font style: Bold Serif.
  2. ${jobLine}
  3. Line 3 (Phone): "${parsed.phone}" -> Font style: Simple Serif.
- Must render Vietnamese text correctly.
- Outfit: "${parsed.outfit}", Style: "${parsed.portraitStyle}".
- Background: Blurred high-end corporate office.
- Negative prompt: flat print, monochrome wood face, messy text, cartoon, anime.
      `.trim();
    }

    // Generate content using gemini-3-pro-image-preview
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: parsed.faceMimeType || "image/jpeg", data: parsed.faceBuffer.toString("base64") } },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: parsed.mode === 'calendar' ? "4:3" : "3:4",
          // imageSize is supported only for gemini-3-pro-image-preview
          imageSize: "1K",
        },
      },
    });

       // Extracting image output from the response candidates (an toàn cho TypeScript)
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data);

    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      return json(502, { error: "AI không tạo được ảnh." });
    }

    const imageBase64 = imagePart.inlineData.data as string;

    return json(200, {
      image_base64: imageBase64,
      request_id: `trend-${Date.now()}`,
    });
  } catch (err: any) {
    return json(500, { error: err?.message || "Lỗi hệ thống." });
  }
};
