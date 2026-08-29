import { MaterialIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  type DetailRecord,
  statusPresentation,
  type EvidenceStatus,
} from "@/lib/engineering-os";

const statusStyles: Record<EvidenceStatus, { backgroundColor: string; color: string }> = {
  NOT_CONNECTED: { backgroundColor: "#183249", color: "#B7CCDA" },
  UNKNOWN: { backgroundColor: "#3A321F", color: "#F1B861" },
  BLOCKED: { backgroundColor: "#3D2027", color: "#FF9DA7" },
  BLOCKED_EXTERNAL_EVIDENCE: { backgroundColor: "#3A321F", color: "#F1B861" },
  INTERNAL_RUNTIME_VERIFIED: { backgroundColor: "#173C38", color: "#8BE4CE" },
  REQUIRES_EXTERNAL_REVIEW: { backgroundColor: "#3A321F", color: "#F1B861" },
  PASS: { backgroundColor: "#173C38", color: "#8BE4CE" },
};

export function StatusPill({ status }: { status: EvidenceStatus }) {
  const presentation = statusPresentation[status];
  const colors = statusStyles[status];

  return (
    <View style={[styles.pill, { backgroundColor: colors.backgroundColor }]}>
      <View style={[styles.pillDot, { backgroundColor: colors.color }]} />
      <Text style={[styles.pillText, { color: colors.color }]}>{presentation.label}</Text>
    </View>
  );
}

export function EngineeringRecordCard({
  record,
  onPress,
}: {
  record: DetailRecord;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${record.title} details`}
      onPress={onPress}
      style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}
    >
      <View style={styles.cardTopLine}>
        <Text style={styles.eyebrow}>{record.eyebrow.toUpperCase()}</Text>
        <MaterialIcons color="#8BA4B8" name="chevron-right" size={22} />
      </View>
      <Text style={styles.recordTitle}>{record.title}</Text>
      <Text numberOfLines={2} style={styles.recordDescription}>
        {record.description}
      </Text>
      <View style={styles.statusRow}>
        <StatusPill status={record.status} />
        <Text style={styles.inspect}>Inspect</Text>
      </View>
    </Pressable>
  );
}

export function IntegrityBanner({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.integrityBanner, compact && styles.compactBanner]}>
      <View style={styles.integrityIcon}>
        <MaterialIcons color="#2EC5E8" name="verified-user" size={18} />
      </View>
      <View style={styles.integrityCopy}>
        <Text style={styles.integrityTitle}>Truth-preserving view</Text>
        <Text style={styles.integrityText}>
          {compact
            ? "This local view has no authoritative engineering record attached."
            : "This local view is not connected to an authoritative engineering record. It cannot claim execution, validation, or production readiness."}
        </Text>
      </View>
    </View>
  );
}

export function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.eyebrow}>{label.toUpperCase()}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
    </View>
  );
}

export function DetailSheet({
  record,
  onClose,
}: {
  record: DetailRecord | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      onRequestClose={onClose}
      visible={record !== null}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="Close detail sheet"
          onPress={onClose}
          style={styles.dismissArea}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {record ? (
            <ScrollView contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.eyebrow}>{record.eyebrow.toUpperCase()}</Text>
                  <Text style={styles.sheetTitle}>{record.title}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close detail sheet"
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <MaterialIcons color="#E7F0F6" name="close" size={22} />
                </Pressable>
              </View>

              <StatusPill status={record.status} />

              <View style={styles.sheetBlock}>
                <Text style={styles.sheetBlockLabel}>Current interpretation</Text>
                <Text style={styles.sheetBody}>{record.description}</Text>
              </View>

              <View style={[styles.sheetBlock, styles.requirementBlock]}>
                <Text style={styles.sheetBlockLabel}>Required to establish PASS</Text>
                <Text style={styles.sheetBody}>{record.requiredForPass}</Text>
              </View>

              <Text style={styles.sheetFootnote}>
                A status card is explanatory only. It never authorizes, queues, or starts a CAD, meshing, or solver process.
              </Text>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardTopLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#193348",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  compactBanner: { marginHorizontal: 0 },
  dismissArea: { flex: 1 },
  eyebrow: { color: "#8BA4B8", fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  inspect: { color: "#2EC5E8", fontSize: 13, fontWeight: "700" },
  integrityBanner: {
    alignItems: "flex-start",
    backgroundColor: "#102B40",
    borderColor: "#1C4B68",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  integrityCopy: { flex: 1, gap: 3 },
  integrityIcon: {
    alignItems: "center",
    backgroundColor: "#173C53",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  integrityText: { color: "#B7CCDA", fontSize: 13, lineHeight: 19 },
  integrityTitle: { color: "#E7F0F6", fontSize: 14, fontWeight: "700" },
  modalBackdrop: { backgroundColor: "rgba(1, 10, 17, 0.66)", flex: 1 },
  pill: { alignItems: "center", alignSelf: "flex-start", borderRadius: 20, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 6 },
  pillDot: { borderRadius: 4, height: 7, width: 7 },
  pillText: { fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  recordCard: {
    backgroundColor: "#10263A",
    borderColor: "#1B3B53",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 16,
  },
  recordDescription: { color: "#A9C0D0", fontSize: 14, lineHeight: 20 },
  recordTitle: { color: "#E7F0F6", fontSize: 18, fontWeight: "700" },
  requirementBlock: { backgroundColor: "#123246", borderColor: "#20526C" },
  sectionDescription: { color: "#8BA4B8", fontSize: 14, lineHeight: 20 },
  sectionHeading: { gap: 6, marginBottom: 18 },
  sectionTitle: { color: "#E7F0F6", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  sheet: { backgroundColor: "#0C1E2E", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "78%", minHeight: 390, paddingHorizontal: 20 },
  sheetBlock: { borderColor: "#1B3B53", borderRadius: 16, borderWidth: 1, gap: 7, padding: 15 },
  sheetBlockLabel: { color: "#8BA4B8", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" },
  sheetBody: { color: "#D5E2EB", fontSize: 15, lineHeight: 22 },
  sheetFootnote: { color: "#8BA4B8", fontSize: 12, lineHeight: 18, paddingBottom: 14 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#476478", borderRadius: 4, height: 4, marginVertical: 10, width: 40 },
  sheetHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  sheetScrollContent: { gap: 16, paddingBottom: 20 },
  sheetTitle: { color: "#E7F0F6", fontSize: 25, fontWeight: "800", letterSpacing: -0.4, marginTop: 5 },
  statusRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
});
