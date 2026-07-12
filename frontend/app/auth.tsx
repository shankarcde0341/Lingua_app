import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, typography } from "@/src/theme";

// Handles OAuth redirect from Emergent-managed Google Auth.
// - Web: redirect URL is `${origin}/auth` with session_id in either query (?session_id=…)
//   or hash (#session_id=…).
// - Native: `Linking.createURL("auth")` opens deep-link `exp://…/--/auth`. WebBrowser
//   session usually returns the URL directly, but on cold-start we still need this route.
// After exchange, the AuthContext user state updates and the root AuthGate positively
// routes the authenticated user to `/(tabs)`. Never navigate manually here — that races
// the state update.
export default function AuthCallback() {
  const router = useRouter();
  const { signInWithSessionId, user } = useAuth();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const [message, setMessage] = useState("Signing you in…");
  const attempted = useRef(false);

  useEffect(() => {
    const readSessionIdFromUrl = (): string | null => {
      if (Platform.OS !== "web" || typeof window === "undefined") return null;
      const href = window.location.href;
      const hashIdx = href.indexOf("#");
      if (hashIdx !== -1) {
        const p = new URLSearchParams(href.slice(hashIdx + 1));
        const s = p.get("session_id");
        if (s) return s;
      }
      const qIdx = href.indexOf("?");
      if (qIdx !== -1) {
        const p = new URLSearchParams(href.slice(qIdx + 1));
        const s = p.get("session_id");
        if (s) return s;
      }
      return null;
    };

    if (attempted.current) return;
    const sid = (params?.session_id as string | undefined) || readSessionIdFromUrl();
    console.log("[/auth] session_id present?", !!sid, "user already?", !!user);

    if (!sid) {
      // No session id — likely a direct hit or already-signed-in user landing here.
      if (user) {
        console.log("[/auth] no session_id but user present → /(tabs)");
        router.replace("/(tabs)");
      } else {
        console.log("[/auth] no session_id and no user → /login");
        router.replace("/login");
      }
      return;
    }

    attempted.current = true;
    (async () => {
      try {
        console.log("[/auth] exchanging session_id with backend…");
        await signInWithSessionId(sid);
        console.log("[/auth] exchange OK — waiting for AuthGate to route");
        setMessage("Welcome back! Redirecting…");
        if (Platform.OS === "web" && typeof window !== "undefined") {
          // Strip session_id from URL so refresh doesn't re-attempt.
          window.history.replaceState(null, "", window.location.pathname);
        }
        // DO NOT navigate here — AuthGate will detect the new user state and
        // route to /(tabs) automatically. Manually navigating races the setState.
      } catch (e: any) {
        console.warn("[/auth] exchange failed:", e?.message || e);
        setMessage(e?.message || "Sign-in failed");
        setTimeout(() => router.replace("/login"), 900);
      }
    })();
  }, [params, signInWithSessionId, router, user]);

  return (
    <View style={styles.root} testID="auth-callback">
      <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
      <ActivityIndicator color="#fff" size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.primary },
  text: { ...typography.body, color: "#fff", opacity: 0.85, textAlign: "center", paddingHorizontal: 20 },
});
