import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, typography } from "@/src/theme";

// This route handles the OAuth redirect from Emergent-managed Google Auth.
// On mobile, `Linking.createURL("auth")` produces `exp://.../auth` (Expo Go)
// or `com.emergent.linguafranca://auth` (native build). When the auth flow
// completes, the deep link opens the app back here. On web, this route is
// hit if the redirect_url points to `/auth?session_id=...`.
export default function AuthCallback() {
  const router = useRouter();
  const { signInWithSessionId, user } = useAuth();
  const params = useLocalSearchParams<{ session_id?: string }>();

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

    const sid = (params?.session_id as string | undefined) || readSessionIdFromUrl();
    (async () => {
      if (sid) {
        try {
          await signInWithSessionId(sid);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
          router.replace("/(tabs)");
          return;
        } catch {
          router.replace("/login");
          return;
        }
      }
      // No session_id — go somewhere sensible
      router.replace(user ? "/(tabs)" : "/login");
    })();
  }, [params, signInWithSessionId, router, user]);

  return (
    <View style={styles.root} testID="auth-callback">
      <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
      <ActivityIndicator color="#fff" size="large" />
      <Text style={styles.text}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.primary },
  text: { ...typography.body, color: "#fff", opacity: 0.85 },
});
