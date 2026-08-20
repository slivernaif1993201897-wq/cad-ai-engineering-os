import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const center = new oc.gp_Pnt_3(10, 5, 0);
const axis = new oc.gp_Ax2_3(center, new oc.gp_Dir_4(0, 0, 1));
const circle = new oc.gp_Circ_2(axis, 12);
const edge = new oc.BRepBuilderAPI_MakeEdge_8(circle);
const wire = new oc.BRepBuilderAPI_MakeWire_2(edge.Edge());
const face = new oc.BRepBuilderAPI_MakeFace_15(wire.Wire(), true);
const prism = new oc.BRepPrimAPI_MakePrism_1(face.Face(), new oc.gp_Vec_4(0, 0, 20), true, true);
const analyzer = new oc.BRepCheck_Analyzer(prism.Shape(), true, false);
console.log(JSON.stringify({ edge: edge.IsDone(), wire: wire.IsDone(), face: face.IsDone(), valid: analyzer.IsValid_2() }));
analyzer.delete(); prism.delete(); face.delete(); wire.delete(); edge.delete(); circle.delete(); axis.delete(); center.delete();
