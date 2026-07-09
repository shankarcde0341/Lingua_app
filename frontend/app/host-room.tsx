import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader, GradientButton } from "@/src/components/ui";

const TOPICS = ["Daily English", "Business", "Interview", "Travel", "IELTS", "Public Speaking", "Grammar"];

export default function HostRoom() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) { Alert.alert("Room title required"); return; }
    setBusy(true);
    try {
      const room = await api.createRoom({ title, topic, is_private: isPrivate });
      router.replace({ pathname: "/room/[id]", params: { id: room.room_id, title: room.title, topic: room.topic, host: room.host_name, avatar: room.host_avatar } });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root} testID="host-room-screen">
      <LinearGradient colors={["#EFF6FF", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScreenHeader title="Host a Room" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={styles.label}>Room title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Improve your IELTS Part 2"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="host-room-title"
          />

          <Text style={[styles.label, { marginTop: 20 }]}>Topic</Text>
          <View style={styles.chipsRow}>
            {TOPICS.map((t) => (
              <TouchableOpacity key={t} onPress={() => setTopic(t)} style={[styles.chip, topic === t && styles.chipActive]} testID={`host-topic-${t}`}>
                <Text style={[styles.chipText, topic === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Privacy</Text>
          <View style={{ gap: 10 }}>
            <TouchableOpacity onPress={() => setIsPrivate(false)} style={[styles.privRow, !isPrivate && styles.privRowActive]} testID="host-privacy-public">
              <Ionicons name="globe" size={22} color={!isPrivate ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.privTitle}>Public</Text>
                <Text style={styles.privSub}>Anyone can join and listen</Text>
              </View>
              {!isPrivate ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPrivate(true)} style={[styles.privRow, isPrivate && styles.privRowActive]} testID="host-privacy-private">
              <Ionicons name="lock-closed" size={22} color={isPrivate ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.privTitle}>Private</Text>
                <Text style={styles.privSub}>Only invited users can join</Text>
              </View>
              {isPrivate ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 26 }}>
            <GradientButton label={busy ? "Creating..." : "Create room"} icon="radio" onPress={create} disabled={busy} testID="host-create-btn" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  label: { ...typography.small, color: colors.textSecondary, fontFamily: "Manrope_700Bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  input: { padding: 16, borderRadius: radii.lg, backgroundColor: "#fff", ...shadow.soft, fontFamily: "Manrope_500Medium", fontSize: 15 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.divider },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, fontFamily: "Manrope_600SemiBold", color: colors.textPrimary },
  chipTextActive: { color: "#fff" },
  privRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.divider },
  privRowActive: { borderColor: colors.primary, backgroundColor: "#EFF6FF" },
  privTitle: { ...typography.h3, fontSize: 15 },
  privSub: { ...typography.small, color: colors.textSecondary },
});
