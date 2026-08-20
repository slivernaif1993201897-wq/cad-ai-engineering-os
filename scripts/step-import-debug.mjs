import initOpenCascade from "opencascade.js/dist/node.js";
import { mkdir, writeFile } from "node:fs/promises";

const oc = await initOpenCascade();
const source = new oc.BRepPrimAPI_MakeBox_2(100, 50, 20);
const writer = new oc.STEPControl_Writer_1();
const progress = new oc.Message_ProgressRange_1();
writer.Transfer(source.Shape(), oc.STEPControl_StepModelType.STEPControl_AsIs, true, progress);
writer.Write("/phase39-source.step");
const bytes = oc.FS.readFile("/phase39-source.step");
await mkdir("tests/fixtures", { recursive: true });
await writeFile("tests/fixtures/minimal-box.step", bytes);
oc.FS.writeFile("/phase39-import.step", bytes);

const reader = new oc.STEPControl_Reader_1();
const readStatus = reader.ReadFile("/phase39-import.step");
const roots = reader.NbRootsForTransfer();
const transferred = reader.TransferRoots(new oc.Message_ProgressRange_1());
const shape = reader.OneShape();
const valid = new oc.BRepCheck_Analyzer(shape, true, false).IsValid_2();

console.log(JSON.stringify({ readStatus: String(readStatus), roots, transferred, shapeNull: shape.IsNull(), valid, byteLength: bytes.length }));

reader.delete();
writer.delete();
source.delete();
oc.FS.unlink("/phase39-source.step");
oc.FS.unlink("/phase39-import.step");
