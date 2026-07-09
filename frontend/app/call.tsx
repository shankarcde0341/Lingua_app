import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";

export default function Call() {
  const { name, avatar, gender, country } = useLocalSearchParams<{ name: string; avatar: string; gender: string; country: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [reported, setReported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timer = useRef<any>(null);

  const wave = useSharedValue(0);

  useEffect(() => {
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    wave.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => clearInterval(timer.current);
  }, [wave]);

  const bar1 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.0) * Math.PI * 2)) }] }));
  const bar2 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.15) * Math.PI * 2)) }] }));
  const bar3 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.3) * Math.PI * 2)) }] }));
  const bar4 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.45) * Math.PI * 2)) }] }));
  const bar5 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.6) * Math.PI * 2)) }] }));
  const bar6 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.75) * Math.PI * 2)) }] }));
  const bar7 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + Math.abs(Math.sin((wave.value + 0.9) * Math.PI * 2)) }] }));
  const bars = [bar1, bar2, bar3, bar4, bar5, bar6, bar7];

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const endCall = async () => {
    if (timer.current) clearInterval(timer.current);
    try {
      await api.logCall({ partner_name: String(name || ""), partner_avatar: String(avatar || ""), duration_seconds: seconds, partner_gender: String(gender || "any") });
      await refresh();
    } catch { /* ignore */ }
    router.replace("/(tabs)");
  };

  const report = async () => {
    if (reported) return;
    try { await api.report(String(name || ""), "inappropriate"); setReported(true); } catch { /* ignore */ }
  };
  const block = async () => {
    if (blocked) return;
    try { await api.block(String(name || "")); setBlocked(true); } catch { /* ignore */ }
  };
  const addFriend = async () => {
    try { await api.sendFriendRequest(String(name || ""), String(avatar || "")); } catch { /* ignore */ }
  };

  return (
    <View style={styles.root} testID="call-screen">
      <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.status}>In Call</Text>
            <Text style={styles.timerText}>{fmt(seconds)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={addFriend} style={styles.topBtn} testID="call-add-friend"><Ionicons name="person-add" size={16} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={report} style={styles.topBtn} testID="call-report"><Ionicons name={reported ? "checkmark" : "flag"} size={16} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={block} style={styles.topBtn} testID="call-block"><Ionicons name={blocked ? "checkmark" : "ban"} size={16} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: String(avatar || "") }} style={styles.avatar} />
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{country}</Text>

          <View style={styles.waves}>
            {bars.map((b, i) => (
              <Animated.View key={i} style={[styles.wave, b]} />
            ))}
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={() => setMuted(!muted)} style={[styles.ctrl, muted && styles.ctrlActive]} testID="call-mute">
            <Ionicons name={muted ? "mic-off" : "mic"} size={22} color={muted ? colors.primary : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={endCall} style={styles.endBtn} testID="call-end">
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSpeaker(!speaker)} style={[styles.ctrl, !speaker && styles.ctrlActive]} testID="call-speaker">
            <Ionicons name={speaker ? "volume-high" : "volume-mute"} size={22} color={!speaker ? colors.primary : "#fff"} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  status: { color: "#93C5FD", fontFamily: "Manrope_700Bold", fontSize: 12, letterSpacing: 1.5 },
  timerText: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 22, marginTop: 4 },
  topBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  avatarRing: { padding: 8, borderRadius: 999, borderWidth: 2, borderColor: "rgba(147,197,253,0.4)" },
  avatar: { width: 180, height: 180, borderRadius: 999, borderWidth: 3, borderColor: "#fff" },
  name: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 30, marginTop: 22 },
  meta: { color: "rgba(255,255,255,0.7)", marginTop: 6, fontFamily: "Manrope_500Medium" },
  waves: { flexDirection: "row", alignItems: "center", gap: 5, height: 60, marginTop: 30 },
  wave: { width: 5, height: 40, borderRadius: 999, backgroundColor: "#3B82F6" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 30, paddingBottom: 30 },
  ctrl: { width: 60, height: 60, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  ctrlActive: { backgroundColor: "#fff" },
  endBtn: { width: 78, height: 78, borderRadius: 999, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", ...shadow.strong },
});
