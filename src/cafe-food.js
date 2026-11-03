import { curdSolid, friedSolid, omeletteSolid } from './short-order/food/curd.js';

function meshFromSolid(GFX, solid, name) {
 const geometry=new GFX.BufferGeometry();
 geometry.setAttribute('position',new GFX.BufferAttribute(solid.pos,3));
 geometry.setAttribute('normal',new GFX.BufferAttribute(solid.nrm,3));
 geometry.setAttribute('color',new GFX.BufferAttribute(solid.col,3));
 geometry.computeBoundingSphere();
 const material=new GFX.MeshPhysicalMaterial({name,vertexColors:true,roughness:.58,metalness:0,clearcoat:.24,clearcoatRoughness:.55,sheen:.35});
 const mesh=new GFX.Mesh(geometry,material); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
export function createBreakfastPlate(GFX,kind='scramble') {
 const group=new GFX.Group(); group.name=`venture-cafe-plate-${kind}`;
 const rim=new GFX.Mesh(new GFX.CylinderGeometry(.64,.66,.075,48),new GFX.MeshStandardMaterial({color:'#f4eedf',roughness:.28,metalness:.04})); rim.position.y=.04; rim.castShadow=true; group.add(rim);
 const inset=new GFX.Mesh(new GFX.CylinderGeometry(.54,.55,.012,48),new GFX.MeshStandardMaterial({color:'#e4d9c5',roughness:.34})); inset.position.y=.083; group.add(inset);
 const ring=new GFX.Mesh(new GFX.TorusGeometry(.57,.012,8,48),new GFX.MeshStandardMaterial({color:'#bd9653',metalness:.62,roughness:.3})); ring.rotation.x=Math.PI/2; ring.position.y=.088; group.add(ring);
 let food;
 if(kind==='sunny'||kind==='over-easy'){food=meshFromSolid(GFX,friedSolid({radius:2.4,thickness:.22,yolk:.75,whole:true,seed:kind==='sunny'?9:17}),'short-order-fried-egg');food.scale.setScalar(.19);}
 else if(kind==='omelette'){food=meshFromSolid(GFX,omeletteSolid({volume:10,shape:'roll',yolk:.33,seed:13,radius:4}),'short-order-omelette');food.scale.setScalar(.145);}
 else{food=meshFromSolid(GFX,curdSolid({volume:.16,yolk:.33,seed:kind==='potato-scramble'?21:3}),'short-order-scrambled-egg-curds');food.scale.setScalar(kind==='potato-scramble'?.22:.24);}
 food.position.y=.105; group.add(food);
 if(kind==='potato-scramble'){const mat=new GFX.MeshStandardMaterial({color:'#c78a42',roughness:.85});for(let i=0;i<7;i++){const bit=new GFX.Mesh(new GFX.BoxGeometry(.16,.12,.16),mat);bit.position.set(-.3+(i%4)*.17,.14+(i%2)*.015,-.16+Math.floor(i/4)*.23);bit.rotation.y=i*.63;group.add(bit);}}
 return group;
}
