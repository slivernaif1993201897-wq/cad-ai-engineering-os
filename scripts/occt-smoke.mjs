import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const box = new oc.BRepPrimAPI_MakeBox_2(100, 50, 20);
const shape = box.Shape();
const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
const valid = analyzer.IsValid_2();
const writer = new oc.STEPControl_Writer_1();
const transferStatus = writer.Transfer(shape, oc.STEPControl_StepModelType.STEPControl_AsIs, true, new oc.Message_ProgressRange_1());
const output = "/tmp/occt-smoke.step";
const writeStatus = writer.Write(output);
console.log(JSON.stringify({
  kernel: "OpenCascade.js",
  shapeType: "box",
  valid,
  transferStatus: String(transferStatus),
  writeStatus: String(writeStatus),
  output,
}));
writer.delete();
analyzer.delete();
box.delete();

if (!valid) process.exit(2);
