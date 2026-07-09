import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, gradients, shadow, typography } from "@/src/theme";
import { GradientButton } from "@/src/components/ui";

export default function PremiumCancel() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }} testID="premium-cancel-screen">
      <LinearGradient colors={gradients.premium} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }} edges={["top", "bottom"]}>
        <View style={styles.icon}><Ionicons name="close-circle" size={72} color="#F87171" /></View>
        <Text style={styles.title}>Checkout cancelled</Text>
        <Text style={styles.sub}>No charge was made. You can try again anytime.</Text>
        <View style={{ marginTop: 30, width: "100%" }}>
          <GradientButton label="Back to Premium" icon="arrow-back" onPress={() => router.replace("/premium")} testID="premium-cancel-back" />
        </View>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { padding: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", ...shadow.strong },
  title: { ...typography.h1, color: "#fff", textAlign: "center", marginTop: 26, fontSize: 26 },
  sub: { ...typography.body, color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 8 },
});
