import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const points = [new oc.gp_Pnt_3(0, 0, 0), new oc.gp_Pnt_3(40, 0, 0), new oc.gp_Pnt_3(40, 20, 0), new oc.gp_Pnt_3(0, 20, 0)];
const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
for (const point of points) polygon.Add_1(point);
polygon.Close();
const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(polygon.Wire(), true);
const prism = new oc.BRepPrimAPI_MakePrism_1(faceMaker.Face(), new oc.gp_Vec_4(0, 0, 15), true, true);
const analyzer = new oc.BRepCheck_Analyzer(prism.Shape(), true, false);
console.log(JSON.stringify({ polygon: polygon.IsDone(), face: faceMaker.IsDone(), valid: analyzer.IsValid_2() }));
analyzer.delete(); prism.delete(); faceMaker.delete(); polygon.delete(); for (const point of points) point.delete();
