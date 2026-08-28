import { useState } from "react";
import { FlatList, ListRenderItem, StyleSheet, Text, View } from "react-native";

import { DetailSheet, EngineeringRecordCard, IntegrityBanner, SectionHeading } from "@/components/engineering-os-ui";
import { CadArtifactOperations } from "@/components/cad-artifact-operations";
import { CncTestPlateAuthoring } from "@/components/cnc-test-plate-authoring";
import { CylindricalHoleAuthoring } from "@/components/cylindrical-hole-authoring";
import { cadRecords, type DetailRecord } from "@/lib/engineering-os";
import { ScreenContainer } from "@/components/screen-container";

export default function CadScreen() {
  const [selectedRecord, setSelectedRecord] = useState<DetailRecord | null>(null);

  const renderItem: ListRenderItem<DetailRecord> = ({ item }) => (
    <EngineeringRecordCard onPress={() => setSelectedRecord(item)} record={item} />
  );

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        contentContainerStyle={styles.content}
        data={cadRecords}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <SectionHeading
              description="Review the model source, requirement binding, and feature lineage before treating geometry as engineering evidence."
              label="Design intelligence"
              title="CAD thread"
            />
            <IntegrityBanner compact />
            <CncTestPlateAuthoring />
            <CadArtifactOperations />
            <CylindricalHoleAuthoring />
            <Text style={styles.listLabel}>SOURCE & LINEAGE</Text>
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
  content: { paddingBottom: 30, paddingTop: 14 },
  listLabel: { color: "#8BA4B8", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10, marginTop: 24 },
});
