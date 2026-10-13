import {fullPolarViewport,pinchViewport,touchGeometry} from '../viewport';
const geometry=(x:number,y:number,distance:number)=>({x,y,distance,count:2});
test('pinching anchors off-center content and clamps zoom and bounds',()=>{
 const from=geometry(80,100,100),to=geometry(80,100,200);
 expect(pinchViewport(fullPolarViewport,from,to,320)).toEqual({zoom:2,x:40,y:50});
 expect(pinchViewport(fullPolarViewport,from,geometry(80,100,1000),320).zoom).toBe(4);
 expect(pinchViewport({zoom:2,x:40,y:50},from,geometry(80,100,1),320)).toEqual(fullPolarViewport);
 expect(pinchViewport({zoom:2,x:80,y:80},{...from,count:1},{...to,count:1,x:2000,y:-2000},320)).toEqual({zoom:2,x:0,y:160});
 expect(touchGeometry([{x:20,y:20},{x:80,y:100}]).distance).toBe(100);
});
