import { View, Text, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { colors, gradients, radii, shadow, typography } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ui";

export default function Certificates() {
  const router = useRouter();
  const { user } = useAuth();
  const certs = user?.certificates || [];

  return (
    <View style={styles.root} testID="certificates-screen">
      <LinearGradient colors={["#FFFBEB", colors.bg]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScreenHeader title="Certificates" showBack onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
          {certs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="ribbon" size={54} color={colors.textMuted} />
              <Text style={styles.emptyText}>No certificates yet</Text>
              <Text style={styles.emptySub}>Score 80+ on a speaking test to earn your first certificate.</Text>
            </View>
          ) : (
            certs.map((c: any, i: number) => (
              <View key={c.id || i} style={styles.certCard} testID={`certificate-${c.id}`}>
                <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
                <View style={styles.certHeader}>
                  <Ionicons name="ribbon" size={28} color={colors.gold} />
                  <View style={styles.premiumChip}><Text style={styles.premiumChipText}>CERTIFICATE</Text></View>
                </View>
                <Text style={styles.certTitle}>{c.title}</Text>
                <Text style={styles.certName}>Awarded to <Text style={{ color: "#F59E0B" }}>{user?.name}</Text></Text>
                <View style={styles.certFooter}>
                  <View>
                    <Text style={styles.footerLabel}>Score</Text>
                    <Text style={styles.footerValue}>{c.score}/100</Text>
                  </View>
                  <View>
                    <Text style={styles.footerLabel}>Date</Text>
                    <Text style={styles.footerValue}>{c.date}</Text>
                  </View>
                  <View>
                    <Text style={styles.footerLabel}>Issued by</Text>
                    <Text style={styles.footerValue}>Lingua Franca</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyText: { ...typography.h2 },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 20 },
  certCard: { padding: 22, borderRadius: radii.xl, marginBottom: 14, overflow: "hidden", ...shadow.strong },
  certHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  premiumChip: { backgroundColor: "rgba(245,158,11,0.2)", borderColor: colors.gold, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  premiumChipText: { color: colors.gold, fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1 },
  certTitle: { color: "#fff", fontFamily: "Outfit_700Bold", fontSize: 22, marginTop: 22 },
  certName: { color: "rgba(255,255,255,0.75)", fontFamily: "Manrope_500Medium", marginTop: 4 },
  certFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  footerLabel: { color: "rgba(255,255,255,0.6)", fontFamily: "Manrope_700Bold", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  footerValue: { color: "#fff", fontFamily: "Outfit_600SemiBold", marginTop: 4 },
});
