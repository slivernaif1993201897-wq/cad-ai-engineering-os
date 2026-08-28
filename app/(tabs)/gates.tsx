import { useState } from "react";
import { FlatList, ListRenderItem, StyleSheet, Text, View } from "react-native";

import { DetailSheet, EngineeringRecordCard, IntegrityBanner, SectionHeading, StatusPill } from "@/components/engineering-os-ui";
import { authoritativeRuntimeEvidence, canAdmitExecution, gateRecords, mobileClientCanStartExecution, runtimeReadiness, type DetailRecord } from "@/lib/engineering-os";
import { ScreenContainer } from "@/components/screen-container";

export default function GatesScreen() {
  const [selectedRecord, setSelectedRecord] = useState<DetailRecord | null>(null);
  const allMandatoryEvidencePasses = canAdmitExecution(gateRecords);
  const mobileCanExecute = mobileClientCanStartExecution();

  const renderItem: ListRenderItem<DetailRecord> = ({ item }) => (
    <EngineeringRecordCard onPress={() => setSelectedRecord(item)} record={item} />
  );

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        contentContainerStyle={styles.content}
        data={gateRecords}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <SectionHeading
              description="Mandatory evidence gates are fail-closed. The mobile client can explain a decision but cannot start an engineering process."
              label="Runtime admission"
              title="Assurance gates"
            />
            <View style={styles.admissionCard}>
              <View style={styles.admissionText}>
                <Text style={styles.admissionLabel}>{runtimeReadiness.internal}</Text>
                <Text style={styles.admissionTitle}>Execution is not admitted</Text>
                <Text style={styles.admissionDescription}>
                  {allMandatoryEvidencePasses && mobileCanExecute
                    ? "An approved server-side boundary would be required."
                    : "Internal runtime evidence is imported from the authoritative backend record. Production admission remains fail-closed until external evidence is attached."}
                </Text>
                <Text style={styles.evidenceLine}>
                  Run {authoritativeRuntimeEvidence.primaryRun} · {authoritativeRuntimeEvidence.environment} · {authoritativeRuntimeEvidence.failedTests} failed tests
                </Text>
              </View>
              <StatusPill status="BLOCKED" />
            </View>
            <IntegrityBanner compact />
            <Text style={styles.listLabel}>AUTHORITATIVE EVIDENCE & EXTERNAL GATES</Text>
          </View>
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
      <DetailSheet onClose={() => setSelectedRecord(null)} record={selectedRecord} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  admissionCard: {
    backgroundColor: "#2A1D26",
    borderColor: "#643341",
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 12,
    padding: 16,
  },
  admissionDescription: { color: "#CFB7BD", fontSize: 14, lineHeight: 20 },
  admissionLabel: { color: "#D2909B", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  admissionText: { gap: 5 },
  admissionTitle: { color: "#FFE8EB", fontSize: 19, fontWeight: "800" },
  content: { paddingBottom: 30, paddingTop: 14 },
  evidenceLine: { color: "#A9C7D3", fontSize: 12, lineHeight: 18, marginTop: 4 },
  listLabel: { color: "#8BA4B8", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10, marginTop: 24 },
});
