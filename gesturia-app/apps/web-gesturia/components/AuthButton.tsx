"use client";
/** Compact auth control for page headers: a "Sign in" pill when logged out, or the user's avatar with
 *  live XP / hearts + a sign-out button when logged in. Drop into any header. */
import { useAuth } from "./AuthProvider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faHeart, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";

export default function AuthButton() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;

  if (!user) {
    return (
      <a href="/login" className="g-pill g-coral" style={{ fontWeight: 700 }}>Sign in</a>
    );
  }

  const initial = (user.display_name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span title={`${user.xp} XP`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "var(--gold,#C8890A)" }}>
        <FontAwesomeIcon icon={faBolt} /> {user.xp}
      </span>
      <span title={`${user.hearts} hearts`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "var(--coral,#E8553A)" }}>
        <FontAwesomeIcon icon={faHeart} /> {user.hearts}
      </span>
      <span title={user.display_name || user.email} style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
        color: "#fff", fontWeight: 800, fontSize: 13, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))" }}>{initial}</span>
      <button onClick={() => logout()} title="Sign out" className="g-icon"
        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted,#9C9179)" }}>
        <FontAwesomeIcon icon={faRightFromBracket} />
      </button>
    </div>
  );
}
