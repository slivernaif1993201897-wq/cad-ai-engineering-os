import initOpenCascade from "opencascade.js/dist/node.js";
const oc = await initOpenCascade();
console.log(oc.ChFi3d_FilletShape);
console.log(typeof oc.BRepFilletAPI_MakeFillet, typeof oc.BRepFilletAPI_MakeFillet_1);
