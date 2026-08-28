import { useState } from "react";
import { FlatList, ListRenderItem, StyleSheet, Text, View } from "react-native";

import { DetailSheet, EngineeringRecordCard, IntegrityBanner, SectionHeading } from "@/components/engineering-os-ui";
import { caeRecords, type DetailRecord } from "@/lib/engineering-os";
import { ScreenContainer } from "@/components/screen-container";

export default function CaeScreen() {
  const [selectedRecord, setSelectedRecord] = useState<DetailRecord | null>(null);

  const renderItem: ListRenderItem<DetailRecord> = ({ item }) => (
    <EngineeringRecordCard onPress={() => setSelectedRecord(item)} record={item} />
  );

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        contentContainerStyle={styles.content}
        data={caeRecords}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <SectionHeading
              description="Follow the controlled chain from immutable planning to results, without turning a record into an execution claim."
              label="Analysis traceability"
              title="CAE delivery chain"
            />
            <IntegrityBanner compact />
            <Text style={styles.listLabel}>CONTROLLED ARTIFACTS</Text>
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
