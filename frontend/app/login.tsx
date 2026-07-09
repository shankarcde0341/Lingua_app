import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithSessionId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (user) router.replace("/(tabs)"); }, [user, router]);

  const parseSessionId = (url: string): string | null => {
    try {
      const hashIdx = url.indexOf("#");
      if (hashIdx !== -1) {
        const params = new URLSearchParams(url.slice(hashIdx + 1));
        const s = params.get("session_id");
        if (s) return s;
      }
      const qIdx = url.indexOf("?");
      if (qIdx !== -1) {
        const q = new URLSearchParams(url.slice(qIdx + 1));
        const s = q.get("session_id");
        if (s) return s;
      }
    } catch { /* ignore */ }
    return null;
  };

  const handleGoogleLogin = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const redirectUrl = Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
        : Linking.createURL("auth");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = authUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const sid = parseSessionId(result.url);
        if (!sid) throw new Error("No session_id returned");
        await signInWithSessionId(sid);
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }, [signInWithSessionId, router]);

  // Web: process session_id in URL on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;
    const s = parseSessionId(window.location.href);
    if (s) {
      (async () => {
        setBusy(true);
        try {
          await signInWithSessionId(s);
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/(tabs)");
        } catch (e: any) {
          setError(e.message || "Login failed");
        } finally {
          setBusy(false);
        }
      })();
    }
  }, [signInWithSessionId, router]);

  return (
    <View style={styles.root} testID="login-screen">
      <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <LinearGradient colors={["#93C5FD", "#3B82F6", "#1E40AF"]} style={styles.logo}>
            <Ionicons name="mic" size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.brand}>Lingua Franca</Text>
          <Text style={styles.tag}>Your personal English speaking coach</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome</Text>
          <Text style={styles.welcomeSub}>Sign in to start your speaking journey.</Text>

          <TouchableOpacity
            testID="google-signin-btn"
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <View style={styles.gIcon}>
                  <Text style={styles.gIconText}>G</Text>
                </View>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <Text style={styles.disclaimer}>
            By continuing you agree to our{" "}
            <Text style={styles.link} onPress={() => router.push("/terms")}>Terms</Text> and{" "}
            <Text style={styles.link} onPress={() => router.push("/privacy")}>Privacy Policy</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb1: { position: "absolute", top: -60, left: -60, width: 240, height: 240, borderRadius: 999, backgroundColor: "rgba(147,197,253,0.15)" },
  orb2: { position: "absolute", bottom: -80, right: -60, width: 260, height: 260, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.18)" },
  top: { alignItems: "center", marginTop: 48 },
  logo: { width: 84, height: 84, borderRadius: 30, alignItems: "center", justifyContent: "center", ...shadow.strong },
  brand: { ...typography.h1, color: "#fff", marginTop: 16, fontSize: 30 },
  tag: { ...typography.body, color: "rgba(255,255,255,0.72)", marginTop: 6 },
  card: { marginTop: "auto", marginHorizontal: 20, marginBottom: 20, padding: 26, borderRadius: radii.xl, backgroundColor: "rgba(255,255,255,0.96)", ...shadow.card },
  welcome: { ...typography.h2 },
  welcomeSub: { ...typography.body, color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, height: 56, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.divider },
  gIcon: { width: 26, height: 26, borderRadius: 999, backgroundColor: "#EA4335", alignItems: "center", justifyContent: "center" },
  gIconText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  googleText: { ...typography.button, color: colors.textPrimary, fontSize: 16 },
  error: { ...typography.small, color: colors.danger, marginTop: 12, textAlign: "center" },
  disclaimer: { ...typography.small, color: colors.textSecondary, textAlign: "center", marginTop: 22, lineHeight: 18 },
  link: { color: colors.primary, textDecorationLine: "underline" },
});
