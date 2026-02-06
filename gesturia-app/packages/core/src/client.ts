// Gesturia API client — shared by every web + mobile app.
// Two auth realms: LMS (JWT, /v1/learn/*) and Translation (API key, /v1/translate/*).
import type {
  TokenResponse, UserProfile, CourseOut, CourseDetail, UnitOut, ExerciseOut, StatsResponse,
  LeaderboardEntry, AchievementOut, ShopItemOut, LessonCompleteResponse, SignDemoResponse,
  TranslationResponse, ClassroomOut, StudentProgress, AssignmentOut, ClassAnalytics,
  CertificateOut, Paginated,
} from "./types";

export interface TokenStore {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  del(key: string): void | Promise<void>;
}
/** In-memory fallback (SSR / tests). */
export const memoryStore = (): TokenStore => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), del: (k) => void m.delete(k) };
};

export interface ClientConfig {
  baseUrl?: string;        // default http://localhost:8000
  apiKey?: string;         // for /v1/translate/* (empty in dev = no auth)
  store?: TokenStore;      // token persistence
}

const ACCESS = "gesturia.access", REFRESH = "gesturia.refresh";

export function createGesturiaClient(cfg: ClientConfig = {}) {
  const baseUrl = (cfg.baseUrl || "http://localhost:8000").replace(/\/$/, "");
  const store = cfg.store || memoryStore();
  let access: string | null = null;

  async function token(): Promise<string | null> {
    if (access) return access;
    access = await store.get(ACCESS);
    return access;
  }

  async function req<T>(path: string, opts: RequestInit & { auth?: "jwt" | "apikey" | "none"; raw?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...(opts.headers as any) };
    if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const authMode = opts.auth ?? "jwt";
    if (authMode === "jwt") { const t = await token(); if (t) headers["Authorization"] = `Bearer ${t}`; }
    else if (authMode === "apikey" && cfg.apiKey) headers["X-API-Key"] = cfg.apiKey;

    let res = await fetch(`${baseUrl}${path}`, { ...opts, headers });
    if (res.status === 401 && authMode === "jwt") {
      if (await tryRefresh()) {
        const t = await token(); headers["Authorization"] = `Bearer ${t}`;
        res = await fetch(`${baseUrl}${path}`, { ...opts, headers });
      }
    }
    if (!res.ok) {
      let detail: any = res.statusText;
      try { detail = (await res.json()).detail ?? detail; } catch {}
      throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    if (opts.raw) return res as any;
    if (res.status === 204) return undefined as any;
    return res.json();
  }

  async function tryRefresh(): Promise<boolean> {
    const rt = await store.get(REFRESH);
    if (!rt) return false;
    try {
      const r = await fetch(`${baseUrl}/v1/learn/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!r.ok) return false;
      await saveTokens(await r.json());
      return true;
    } catch { return false; }
  }
  async function saveTokens(t: TokenResponse) {
    access = t.access_token;
    await store.set(ACCESS, t.access_token);
    await store.set(REFRESH, t.refresh_token);
  }

  const q = (o: Record<string, any>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) p.set(k, String(v));
    const s = p.toString(); return s ? `?${s}` : "";
  };

  return {
    baseUrl,
    // ── auth ──
    auth: {
      async register(email: string, password: string, display_name: string) {
        const t = await req<TokenResponse>("/v1/learn/auth/register", { method: "POST", auth: "none", body: JSON.stringify({ email, password, display_name }) });
        await saveTokens(t); return t;
      },
      async login(email: string, password: string) {
        const t = await req<TokenResponse>("/v1/learn/auth/login", { method: "POST", auth: "none", body: JSON.stringify({ email, password }) });
        await saveTokens(t); return t;
      },
      async logout() { try { await req("/v1/learn/auth/logout", { method: "POST" }); } finally { access = null; await store.del(ACCESS); await store.del(REFRESH); } },
      me: () => req<UserProfile>("/v1/learn/auth/me"),
      isAuthed: async () => !!(await token()),
    },
    // ── Gesturia (translation, API key) ──
    translate: {
      text: (text: string, opts: { sign_language?: "ASL" | "BSL"; include_poses?: boolean; pose_stride?: number } = {}) =>
        req<TranslationResponse>(`/v1/translate/text${q({ include_poses: opts.include_poses ?? true, pose_stride: opts.pose_stride })}`,
          { method: "POST", auth: "apikey", body: JSON.stringify({ text, sign_language: opts.sign_language ?? "ASL" }) }),
      audio: (file: Blob, opts: { pose_stride?: number } = {}) => {
        const fd = new FormData(); fd.append("file", file as any);
        return req<TranslationResponse>(`/v1/translate/audio${q({ pose_stride: opts.pose_stride })}`, { method: "POST", auth: "apikey", body: fd });
      },
      videoStart: (video_url: string, output_format: "overlay" | "side-by-side" = "overlay") =>
        req<{ task_id: string; status: string; status_url: string }>("/v1/translate/video", { method: "POST", auth: "apikey", body: JSON.stringify({ video_url, output_format }) }),
      videoStatus: (task_id: string) => req<any>(`/v1/translate/video/${task_id}/status`, { auth: "none" }),
      realtimeWsUrl: () => `${baseUrl.replace(/^http/, "ws")}/v1/translate/ws/realtime`,
    },
    // ── GestSolo (learning) ──
    learn: {
      courses: (p: { skip?: number; limit?: number; search?: string } = {}) => req<Paginated<CourseOut>>(`/v1/learn/courses${q(p)}`, { auth: "none" }),
      course: (id: number) => req<CourseDetail>(`/v1/learn/courses/${id}`),
      enroll: (id: number) => req<{ message: string }>(`/v1/learn/courses/${id}/enroll`, { method: "POST" }),
      lessonExercises: (lessonId: number) => req<ExerciseOut[]>(`/v1/learn/lessons/${lessonId}/exercises`),
      startLesson: (lessonId: number) => req<{ message: string; hearts: number; exercise_count: number }>(`/v1/learn/lessons/${lessonId}/start`, { method: "POST" }),
      completeLesson: (lessonId: number, time_spent: number) => req<LessonCompleteResponse>(`/v1/learn/lessons/${lessonId}/complete`, { method: "POST", body: JSON.stringify({ time_spent }) }),
      submitExercise: (exId: number, answer: string, time_spent: number) =>
        req<{ is_correct: boolean; correct_answer: string; xp_earned: number; hearts_remaining: number }>(`/v1/learn/exercises/${exId}/submit`, { method: "POST", body: JSON.stringify({ answer, time_spent }) }),
      stats: () => req<StatsResponse>("/v1/learn/profile/stats"),
      leaderboard: (p: { skip?: number; limit?: number } = {}) => req<LeaderboardEntry[]>(`/v1/learn/leaderboard${q(p)}`),
      achievements: (p: { skip?: number; limit?: number } = {}) => req<AchievementOut[]>(`/v1/learn/achievements${q(p)}`),
      shop: () => req<ShopItemOut[]>("/v1/learn/shop", { auth: "none" }),
      buy: (item_id: number) => req<{ message: string; gems_remaining: number }>("/v1/learn/shop/buy", { method: "POST", body: JSON.stringify({ item_id }) }),
      dailyChallenge: () => req<any>("/v1/learn/practice/daily-challenge"),
      certificates: () => req<CertificateOut[]>("/v1/learn/certificates"),
      // sign demo (avatar shows the sign for text/exercise)
      demo: (body: { text?: string; exercise_id?: number; lesson_id?: number; avatar?: "gest" | "uria"; speed?: number }) =>
        req<SignDemoResponse>("/v1/learn/learn/demo", { method: "POST", body: JSON.stringify({ avatar: "gest", speed: 1, ...body }) }),
    },
    // ── GestLea (schools) ──
    school: {
      myClassrooms: () => req<ClassroomOut[]>("/v1/learn/teacher/classrooms"),
      createClassroom: (b: { name: string; description?: string; grade_level?: string; academic_year?: string }) => req<ClassroomOut>("/v1/learn/teacher/classrooms", { method: "POST", body: JSON.stringify(b) }),
      classroomStudents: (id: number) => req<StudentProgress[]>(`/v1/learn/teacher/classrooms/${id}/students`),
      classroomAssignments: (id: number) => req<AssignmentOut[]>(`/v1/learn/teacher/classrooms/${id}/assignments`),
      classroomAnalytics: (id: number) => req<ClassAnalytics>(`/v1/learn/teacher/classrooms/${id}/analytics`),
      createAssignment: (id: number, b: { title: string; instructions?: string; lesson_id?: number; course_id?: number; due_date?: string; max_score?: number }) =>
        req<AssignmentOut>(`/v1/learn/teacher/classrooms/${id}/assignments`, { method: "POST", body: JSON.stringify({ max_score: 100, ...b }) }),
      // classroom-live (teacher broadcast)
      liveSignText: (text: string, avatar: "gest" | "uria" = "gest") => req<any>("/v1/learn/classroom-live/sign-text", { method: "POST", body: JSON.stringify({ text, avatar }) }),
      createSession: (b: { classroom_id: number; lesson_id?: number; title: string }) => req<any>("/v1/learn/classroom-live/sessions", { method: "POST", body: JSON.stringify(b) }),
      sessionWsUrl: (sessionId: number, jwt: string) => `${baseUrl.replace(/^http/, "ws")}/v1/learn/classroom-live/sessions/${sessionId}/ws?token=${jwt}`,
    },
    health: () => req<{ status: string }>("/health/live", { auth: "none" }),
    _saveTokens: saveTokens,
    _accessToken: token,
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}
export type GesturiaClient = ReturnType<typeof createGesturiaClient>;
