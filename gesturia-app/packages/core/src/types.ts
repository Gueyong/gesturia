// Shared API types — the contract with the Gesturia FastAPI backend (src/api).
// Keep in sync with src/lms/schemas.py and src/api/routes.

// ─── Sign animation (consumed by the 3D <Signer>) ───────────────────────────
/** Per-frame pose = 288 floats; per-frame facial = 70 blendshape weights; fps default 30. */
export interface SignAnimation {
  gloss: string;
  gloss_tokens?: string[];
  poses: number[][];          // [frame][288]
  blend_weights?: number[][]; // [frame][70]
  n_frames: number;
  fps: number;
  duration_seconds?: number;
  sentence_type?: string;
  facial_tags?: string[];
  avatar?: "gest" | "uria";
  pipeline_path?: string;
  confidence?: number;
}

export interface TranslationResponse extends SignAnimation {
  text: string;
  duration?: number;
  latency_ms?: number;
  cached?: boolean;
  model_version?: string;
}

// ─── Auth / user ────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}
export type UserRole =
  | "student" | "teacher" | "school_admin" | "district_admin" | "content_creator" | "super_admin";
export interface UserProfile {
  id: number; email: string; display_name: string; avatar_url?: string;
  xp: number; level: number; gems: number; hearts: number;
  streak_count: number; streak_last_date?: string; preferred_language?: string;
  role?: UserRole; is_admin?: boolean; created_at?: string;
}

// ─── GestSolo (learning) ────────────────────────────────────────────────────
export interface CourseOut {
  id: number; title: string; description?: string; language?: string;
  difficulty?: string; icon_url?: string; is_published?: boolean;
}
export interface LessonOut {
  id: number; order: number; title: string; type?: string;
  xp_reward: number; is_locked?: boolean; is_completed?: boolean;
}
export interface UnitOut { id: number; order: number; title: string; description?: string; lessons: LessonOut[]; }
export interface CourseDetail extends CourseOut { units: UnitOut[]; }
export interface ExerciseOut {
  id: number; order: number; type: string; prompt: string;
  options?: string[]; media_url?: string; hint?: string;
}
export interface StatsResponse {
  xp: number; level: number; gems: number; hearts: number;
  streak_count: number; streak_last_date?: string; league?: string; rank?: number;
}
export interface LeaderboardEntry { rank: number; display_name: string; xp_this_week: number; avatar_url?: string; }
export interface AchievementOut {
  id: number; name: string; description?: string; icon_url?: string;
  xp_reward: number; unlocked: boolean; unlocked_at?: string;
}
export interface ShopItemOut { id: number; name: string; description?: string; cost_gems: number; type: string; }
export interface LessonCompleteResponse {
  xp_earned: number; total_xp: number; level: number; streak_count: number;
  gems_earned: number; achievements_unlocked: string[];
  course_completed?: boolean; certificate?: CertificateOut;
}
export interface CertificateOut {
  id?: number; certificate_number: string; title: string; course_title?: string;
  issued_at: string; score?: number; signed_by?: string; is_valid?: boolean;
}
export interface SignDemoResponse extends SignAnimation { }

// ─── GestLea (schools) ──────────────────────────────────────────────────────
export interface ClassroomOut {
  id: number; name: string; description?: string; grade_level?: string;
  academic_year?: string; student_count: number; invite_code?: string; is_active: boolean;
}
export interface StudentProgress {
  user_id: number; display_name: string; email: string; xp: number; level: number;
  streak_count: number; lessons_completed: number; last_active?: string;
}
export interface AssignmentOut {
  id: number; title: string; instructions?: string; course_id?: number; lesson_id?: number;
  due_date?: string; max_score: number; created_at?: string; submission_count?: number; avg_score?: number;
}
export interface ClassAnalytics {
  total_students: number; avg_xp: number; avg_level: number; avg_streak: number;
  total_lessons_completed: number; active_this_week: number; completion_rate: number; top_students?: any[];
}

export interface Paginated<T> { items: T[]; total: number; skip: number; limit: number; }
