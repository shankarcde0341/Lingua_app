import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader, GradientButton } from "@/src/components/ui";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GOALS = [5, 10, 15, 30, 60];

export default function Settings() {
  const router = useRouter();
  const { user, updateUser, signOut } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [level, setLevel] = useState(user?.english_level || "Beginner");
  const [goal, setGoal] = useState(user?.daily_goal_minutes || 15);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const u = await api.updateProfile({ name, english_level: level, daily_goal_minutes: goal });
      updateUser(u);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) { Alert.alert("Error", e.message); }
    setBusy(false);
  };

  return (
    <View style={styles.root} testID="settings-screen">
      <LinearGradient colors={["#EFF6FF", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScreenHeader title="Settings" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={styles.label}>Display name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} testID="settings-name" placeholderTextColor={colors.textMuted} />

          <Text style={[styles.label, { marginTop: 20 }]}>English level</Text>
          <View style={styles.row}>
            {LEVELS.map((l) => (
              <TouchableOpacity key={l} onPress={() => setLevel(l)} style={[styles.chip, level === l && styles.chipActive]} testID={`settings-level-${l}`}>
                <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Daily goal (minutes)</Text>
          <View style={styles.row}>
            {GOALS.map((g) => (
              <TouchableOpacity key={g} onPress={() => setGoal(g)} style={[styles.chip, goal === g && styles.chipActive]} testID={`settings-goal-${g}`}>
                <Text style={[styles.chipText, goal === g && styles.chipTextActive]}>{g} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: 30 }}>
            <GradientButton label={busy ? "Saving..." : "Save changes"} icon="checkmark" onPress={save} disabled={busy} testID="settings-save-btn" />
          </View>

          <TouchableOpacity onPress={signOut} style={styles.logoutBtn} testID="settings-signout-btn">
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  label: { ...typography.small, color: colors.textSecondary, fontFamily: "Manrope_700Bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  input: { padding: 16, borderRadius: radii.lg, backgroundColor: "#fff", ...shadow.soft, fontFamily: "Manrope_500Medium", fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.divider },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, fontFamily: "Manrope_600SemiBold", color: colors.textPrimary },
  chipTextActive: { color: "#fff" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 26, paddingVertical: 16, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.danger },
  logoutText: { color: colors.danger, fontFamily: "Manrope_700Bold" },
});
