import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "lf_session_token";

export async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}
export async function setToken(token: string): Promise<void> {
  await storage.secureSet<string>(TOKEN_KEY, token);
}
export async function clearToken(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data as T;
}

export const api = {
  createSession: (session_id: string) => request<any>("/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }, false),
  sendPhoneOtp: (phone: string) => request<any>("/auth/phone/send-otp", { method: "POST", body: JSON.stringify({ phone }) }, false),
  verifyPhoneOtp: (phone: string, code: string, name?: string, referral_code?: string) => request<any>("/auth/phone/verify-otp", { method: "POST", body: JSON.stringify({ phone, code, name, referral_code }) }, false),
  linkPhone: (phone: string, code: string) => request<any>("/auth/phone/link", { method: "POST", body: JSON.stringify({ phone, code }) }),
  me: () => request<any>("/auth/me"),
  logout: () => request<any>("/auth/logout", { method: "POST" }),
  getReferral: () => request<any>("/referral"),
  applyReferral: (referral_code: string) => request<any>("/referral/apply", { method: "POST", body: JSON.stringify({ referral_code }) }),
  updateProfile: (payload: any) => request<any>("/profile", { method: "PUT", body: JSON.stringify(payload) }),
  addXp: (amount: number, reason: string, minutes = 0) => request<any>("/xp", { method: "POST", body: JSON.stringify({ amount, reason, minutes }) }),
  home: () => request<any>("/home"),
  lessonCategories: () => request<any>("/lessons/categories"),
  lessons: (categoryId?: string) => request<any>(`/lessons${categoryId ? `?category_id=${categoryId}` : ""}`),
  lesson: (id: string) => request<any>(`/lessons/${id}`),
  completeLesson: (lesson_id: string) => request<any>("/lessons/complete", { method: "POST", body: JSON.stringify({ lesson_id }) }),
  lessonProgress: () => request<any>("/lessons/progress/all"),
  vocab: () => request<any>("/vocab"),
  wordOfTheDay: () => request<any>("/vocab/word-of-the-day"),
  saveWord: (word_id: string) => request<any>("/vocab/save", { method: "POST", body: JSON.stringify({ word_id }) }),
  unsaveWord: (word_id: string) => request<any>("/vocab/unsave", { method: "POST", body: JSON.stringify({ word_id }) }),
  challenges: () => request<any>("/challenges"),
  completeChallenge: (id: string) => request<any>(`/challenges/${id}/complete`, { method: "POST" }),
  quiz: () => request<any>("/quiz"),
  speakingTest: (payload: any) => request<any>("/speaking-test", { method: "POST", body: JSON.stringify(payload) }),
  testHistory: () => request<any>("/speaking-test/history"),
  match: (gender: string) => request<any>(`/match?gender=${gender}`, { method: "POST" }),
  logCall: (payload: any) => request<any>("/calls", { method: "POST", body: JSON.stringify(payload) }),
  callHistory: () => request<any>("/calls"),
  sendFriendRequest: (to_name: string, to_avatar: string) => request<any>("/friends/request", { method: "POST", body: JSON.stringify({ to_name, to_avatar }) }),
  friendRequests: () => request<any>("/friends/requests"),
  report: (target_name: string, reason: string) => request<any>("/reports", { method: "POST", body: JSON.stringify({ target_name, reason }) }),
  block: (target_name: string) => request<any>("/block", { method: "POST", body: JSON.stringify({ target_name, reason: "blocked" }) }),
  rooms: () => request<any>("/rooms"),
  createRoom: (payload: any) => request<any>("/rooms", { method: "POST", body: JSON.stringify(payload) }),
  joinRoom: (room_id: string) => request<any>("/rooms/join", { method: "POST", body: JSON.stringify({ room_id }) }),
  leaderboard: () => request<any>("/leaderboard"),
  weeklyLeaderboard: () => request<any>("/leaderboard"),
  achievements: () => request<any>("/achievements"),
  subscriptionPlans: () => request<any>("/subscription/plans"),
  createCheckout: (plan: string, origin_url: string) => request<any>("/subscription/checkout", { method: "POST", body: JSON.stringify({ plan, origin_url }) }),
  pollCheckout: (session_id: string) => request<any>(`/subscription/status/${session_id}`),
  getZegoToken: (room_id: string) => request<any>("/zego/token", { method: "POST", body: JSON.stringify({ room_id }) }),
};
