import {applyCatalogBoat, type CatalogDetail} from "../catalog";
jest.mock("../../tracking/client",()=>({trackingRpc:jest.fn()}));
test("catalog displacement fills boat weight and a missing value clears the previous model weight",()=>{
 const entry={model:"J24",manufacturer:"J Boats",configuration:"2024",year:2024,source_year:2024,source_url:"https://example.test",revision:"one",id:"orc",length_m:7.3,beam_m:2.7,draft_m:1.2,displacement_kg:1400,points:[{tws:8,twa:60,speed:5}]} as CatalogDetail;
 const boat={id:"local",name:"Boat",className:"",sailNumber:"",weightKg:999};
 expect(applyCatalogBoat(boat,entry,"p").weightKg).toBe(1400);
 expect(applyCatalogBoat(boat,{...entry,displacement_kg:null},"p").weightKg).toBeUndefined();
});
