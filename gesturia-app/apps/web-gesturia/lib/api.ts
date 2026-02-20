"use client";
import { createGesturiaClient, type TokenStore } from "@gesturia/core";

const browserStore: TokenStore = {
  get: (k) => (typeof window === "undefined" ? null : window.localStorage.getItem(k)),
  set: (k, v) => { if (typeof window !== "undefined") window.localStorage.setItem(k, v); },
  del: (k) => { if (typeof window !== "undefined") window.localStorage.removeItem(k); },
};

export const api = createGesturiaClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  apiKey: process.env.NEXT_PUBLIC_API_KEY || "", // dev backend = no API auth
  store: browserStore,
});
