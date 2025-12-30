/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const BASE_CREDITS = 5;

export function getCurrentUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("caotrang_username");
}

export function getUserCredits(username: string): number {
  if (typeof window === "undefined") return BASE_CREDITS;
  const stored = localStorage.getItem(`caotrang_credits_${username}`);
  if (!stored) {
    // chưa có thì set mặc định = BASE_CREDITS
    localStorage.setItem(`caotrang_credits_${username}`, String(BASE_CREDITS));
    return BASE_CREDITS;
  }
  const value = parseInt(stored, 10);
  if (Number.isNaN(value)) {
    localStorage.setItem(`caotrang_credits_${username}`, String(BASE_CREDITS));
    return BASE_CREDITS;
  }
  return value;
}

export function decreaseUserCredits(username: string): number {
  const current = getUserCredits(username);
  const next = Math.max(current - 1, 0);
  if (typeof window !== "undefined") {
    localStorage.setItem(`caotrang_credits_${username}`, String(next));
  }
  return next;
}

export function resetUserCredits(username: string, value = BASE_CREDITS) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`caotrang_credits_${username}`, String(value));
  }
}
