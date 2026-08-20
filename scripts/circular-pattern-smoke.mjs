import initOpenCascade from "opencascade.js/dist/node.js";

const oc = await initOpenCascade();
const center = new oc.gp_Pnt_3(30, 0, 0);
const normal = new oc.gp_Dir_4(0, 0, 1);
const axis2 = new oc.gp_Ax2_3(center, normal);
const circle = new oc.gp_Circ_2(axis2, 5);
const edge = new oc.BRepBuilderAPI_MakeEdge_8(circle);
const wire = new oc.BRepBuilderAPI_MakeWire_2(edge.Edge());
const face = new oc.BRepBuilderAPI_MakeFace_15(wire.Wire(), true);
const source = new oc.BRepPrimAPI_MakePrism_1(face.Face(), new oc.gp_Vec_4(0, 0, 10), true, true);
const compound = new oc.TopoDS_Compound();
const builder = new oc.BRep_Builder(); builder.MakeCompound(compound);
const origin = new oc.gp_Pnt_3(0, 0, 0); const axis = new oc.gp_Ax1_2(origin, normal);
const transforms = [];
for (let index = 0; index < 4; index += 1) { const trsf = new oc.gp_Trsf_1(); trsf.SetRotation_1(axis, index * Math.PI / 2); const transformed = new oc.BRepBuilderAPI_Transform_2(source.Shape(), trsf, true); builder.Add(compound, transformed.Shape()); transforms.push(transformed, trsf); }
const analyzer = new oc.BRepCheck_Analyzer(compound, true, false);
console.log(JSON.stringify({ valid: analyzer.IsValid_2() }));
analyzer.delete(); transforms.forEach((item) => item.delete()); axis.delete(); origin.delete(); builder.delete(); compound.delete(); source.delete(); face.delete(); wire.delete(); edge.delete(); circle.delete(); axis2.delete(); normal.delete(); center.delete();
