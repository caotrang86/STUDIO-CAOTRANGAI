export interface HistoryItem {
  id: string;
  url: string; // base64 or https
  timestamp: number;
  name: string;
}

export interface GenerateResponse {
  image_base64?: string;
  image_url?: string;
  request_id: string;
  prompt_used?: string;
  error?: string;
}
