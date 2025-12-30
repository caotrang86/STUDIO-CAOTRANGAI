/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const DEFAULT_NORMAL_CREDITS = 5;
const DEFAULT_VIP_CREDITS = 20;

export function getCurrentUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("caotrang_username");
}

export function getUserRole(username: string): "normal" | "vip" {
  if (typeof window === "undefined") return "normal";
  const role = localStorage.getItem("caotrang_role");
  return (role === "vip") ? "vip" : "normal";
}

export function getMaxCredits(username: string): number {
  if (typeof window === "undefined") return DEFAULT_NORMAL_CREDITS;
  
  // 1. Ưu tiên lấy từ cấu hình cụ thể đã lưu khi login
  const baseKey = `caotrang_base_credits_${username}`;
  const baseStored = localStorage.getItem(baseKey);
  
  if (baseStored) {
    const parsed = parseInt(baseStored, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  // 2. Fallback theo role nếu không có cấu hình cụ thể
  const role = getUserRole(username);
  return role === "vip" ? DEFAULT_VIP_CREDITS : DEFAULT_NORMAL_CREDITS;
}

export function getUserCredits(username: string): number {
  if (typeof window === "undefined") return DEFAULT_NORMAL_CREDITS;
  
  const key = `caotrang_credits_${username}`;
  const stored = localStorage.getItem(key);
  
  // Nếu đã có credit hiện tại (đã bị trừ hoặc chưa), trả về giá trị đó
  if (stored) {
    const value = parseInt(stored, 10);
    if (!Number.isNaN(value)) {
        return value;
    }
  }

  // Nếu chưa có (lần đầu hoặc bị xoá), khởi tạo bằng Max Credits của user đó
  const initial = getMaxCredits(username);
  localStorage.setItem(key, String(initial));
  return initial;
}

export function decreaseUserCredits(username: string): number {
  const current = getUserCredits(username);
  const next = Math.max(current - 1, 0);
  if (typeof window !== "undefined") {
    localStorage.setItem(`caotrang_credits_${username}`, String(next));
  }
  return next;
}

export function resetUserCredits(username: string, value?: number) {
  if (typeof window !== "undefined") {
    const resetValue = value !== undefined ? value : getMaxCredits(username);
    localStorage.setItem(`caotrang_credits_${username}`, String(resetValue));
  }
}
