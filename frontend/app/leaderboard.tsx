import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";

const MEDAL: Record<number, string> = { 0: "#F59E0B", 1: "#94A3B8", 2: "#B45309" };

export default function Leaderboard() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const d = await api.leaderboard(); setRows(d.leaderboard || []); setMe(d.me_user_id); } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  return (
    <View style={styles.root} testID="leaderboard-screen">
      <LinearGradient colors={gradients.premium} style={styles.headerBg} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Leaderboard" showBack onBack={() => router.back()} />
        <View style={styles.title}>
          <Ionicons name="trophy" size={28} color="#F59E0B" />
          <Text style={styles.titleText}>Weekly Champions</Text>
        </View>

        {/* Podium */}
        {rows.length >= 3 ? (
          <View style={styles.podium}>
            <PodiumCard user={rows[1]} rank={2} height={100} />
            <PodiumCard user={rows[0]} rank={1} height={130} />
            <PodiumCard user={rows[2]} rank={3} height={80} />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
            {rows.slice(3).map((u, i) => {
              const rank = i + 4;
              const mine = u.user_id === me;
              return (
                <View key={u.user_id} style={[styles.row, mine && styles.rowMe]}>
                  <Text style={styles.rank}>#{rank}</Text>
                  {u.picture ? <Image source={{ uri: u.picture }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInit}>{(u.name || "?").charAt(0)}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.name || "Anonymous"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Ionicons name="flame" size={12} color="#F59E0B" />
                      <Text style={styles.streak}>{u.streak || 0} day streak</Text>
                    </View>
                  </View>
                  <View style={styles.xpBadge}><Ionicons name="flash" size={12} color="#1E3A8A" /><Text style={styles.xpText}>{u.xp}</Text></View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function PodiumCard({ user, rank, height }: { user: any; rank: number; height: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      {user.picture ? <Image source={{ uri: user.picture }} style={styles.podiumAvatar} /> : <View style={[styles.podiumAvatar, styles.avatarFallback]}><Text style={styles.avatarInit}>{(user.name || "?").charAt(0)}</Text></View>}
      <Text style={styles.podiumName} numberOfLines={1}>{user.name}</Text>
      <Text style={styles.podiumXp}>{user.xp} XP</Text>
      <View style={[styles.podiumBar, { height, backgroundColor: MEDAL[rank - 1] }]}>
        <Text style={styles.podiumRank}>#{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, height: 260, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, marginBottom: 20 },
  titleText: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 22 },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 20, marginBottom: 24 },
  podiumAvatar: { width: 60, height: 60, borderRadius: 999, borderWidth: 2, borderColor: "#fff" },
  podiumName: { color: "#fff", fontFamily: "Outfit_600SemiBold", marginTop: 8, fontSize: 13 },
  podiumXp: { color: "rgba(255,255,255,0.7)", fontFamily: "Manrope_500Medium", fontSize: 11 },
  podiumBar: { width: "80%", marginTop: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: "center", justifyContent: "center" },
  podiumRank: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: radii.lg, marginBottom: 10, ...shadow.soft },
  rowMe: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#EFF6FF" },
  rank: { ...typography.h3, color: colors.textSecondary, width: 34 },
  avatar: { width: 42, height: 42, borderRadius: 999 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarInit: { color: "#fff", fontFamily: "Outfit_700Bold" },
  name: { ...typography.body, fontFamily: "Manrope_700Bold" },
  streak: { ...typography.small, color: colors.textSecondary },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  xpText: { color: "#1E3A8A", fontFamily: "Manrope_700Bold", fontSize: 12 },
});
