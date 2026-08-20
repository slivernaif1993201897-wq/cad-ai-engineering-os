import { ScreenContainer } from "@/components/screen-container";
import { CADWorkspace } from "@/components/cad-workspace";

export default function HomeScreen() {
  return (
    <ScreenContainer
      edges={["top", "left", "right"]}
      containerClassName="bg-[#101820]"
      safeAreaClassName="bg-[#101820]"
      containerStyle={{ backgroundColor: "#101820" }}
    >
      <CADWorkspace />
    </ScreenContainer>
  );
}
