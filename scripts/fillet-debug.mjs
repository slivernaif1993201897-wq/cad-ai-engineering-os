import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const progress = new oc.Message_ProgressRange_1();
const box = new oc.BRepPrimAPI_MakeBox_2(100, 50, 20).Shape();
const explorer = new oc.TopExp_Explorer_2(box, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
const edges = [];
while (explorer.More()) { edges.push(explorer.Current()); explorer.Next(); }
explorer.delete();

for (const mode of ["one", "all"]) {
  const fillet = new oc.BRepFilletAPI_MakeFillet(box, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  const chosen = mode === "one" ? edges.slice(0, 1) : edges;
  for (const edge of chosen) fillet.Add_2(3, oc.TopoDS.Edge_1(edge));
  console.log("before", mode, { contours: fillet.NbContours(), done: fillet.IsDone?.() });
  fillet.Build(progress);
  console.log(mode, { edges: chosen.length, hasResult: fillet.HasResult(), done: fillet.IsDone?.(), contours: fillet.NbContours(), faultyContours: fillet.NbFaultyContours(), faultyVertices: fillet.NbFaultyVertices() });
}
