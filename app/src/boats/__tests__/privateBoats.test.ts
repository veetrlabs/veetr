import {polarRepository} from '../../polar/repository';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateFleet, linkedRaceBoat, linkRaceBoat, localBoatIdForRace, savePrivateBoat, selectPrivateBoat, activePrivateBoat, deletePrivateBoat } from "../privateBoats";
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-crypto", () => ({ randomUUID: () => "new-boat" }));
beforeEach(async () => { await AsyncStorage.clear(); });
test("creates a private boat, persists details and remembers the active boat", async () => {
  await savePrivateBoat({ id: "", name: " Luna ", className: " Cruiser ", sailNumber: " 12 " });
  expect(await activePrivateBoat()).toEqual({ id: "new-boat", name: "Luna", className: "Cruiser", sailNumber: "12" });
  await savePrivateBoat({ id: "second", name: "Dawn", className: "", sailNumber: "" });
  await selectPrivateBoat("second");
  expect((await activePrivateBoat())?.name).toBe("Dawn");
  await savePrivateBoat({ id: "second", name: "Dawn II", className: "", sailNumber: "" });
  expect((await privateFleet()).boats).toHaveLength(2);
  expect((await activePrivateBoat())?.name).toBe("Dawn II");
  await selectPrivateBoat();
  expect(await activePrivateBoat()).toBeUndefined();
});
test("invalid changes preserve the fleet and queued edits preserve separate boats", async () => {
  await expect(savePrivateBoat({ id: "", name: " ", className: "", sailNumber: "" })).rejects.toThrow();
  await Promise.all(["a", "b"].map(id => savePrivateBoat({ id, name: id, className: "", sailNumber: "" })));
  await expect(selectPrivateBoat("missing")).rejects.toThrow();
  expect((await privateFleet()).boats.map(b => b.id)).toEqual(["a", "b"]);
});

test("deleting boats preserves other boats and clears the active selection only when needed", async () => {
  await savePrivateBoat({ id: "a", name: "A", className: "", sailNumber: "" });
  await savePrivateBoat({ id: "b", name: "B", className: "", sailNumber: "" });
  await deletePrivateBoat("b");
  expect((await activePrivateBoat())?.id).toBe("a");
  await deletePrivateBoat("a");
  expect(await privateFleet()).toEqual({ boats: [] });
  expect(await activePrivateBoat()).toBeUndefined();
});

test('catalog selection persists specifications and selected polar for offline use', async () => {
  const polar={id:'catalog-polar',name:'J24',source:'orc' as const,version:'2024',createdAt:'2026-10-12T00:00:00Z',points:[{tws:6,twa:90,speed:5}]};
  await savePrivateBoat({id:'a',name:'Mine',className:'J24',sailNumber:'123',catalogId:'2024:1',catalogPolar:polar,lengthM:7.32,draftM:1.22,waterlineLengthM:6.1,airDraftM:11});
  expect((await activePrivateBoat())?.waterlineLengthM).toBe(6.1);
  expect((await polarRepository.read('a')).selectedId).toBe('catalog-polar');
  await expect(savePrivateBoat({id:'a',name:'Mine',className:'',sailNumber:'',draftM:-1})).rejects.toThrow();
  await expect(savePrivateBoat({id:'a',name:'Mine',className:'',sailNumber:'',lengthM:7,waterlineLengthM:8})).rejects.toThrow();
  expect((await activePrivateBoat())?.draftM).toBe(1.22);
});

test('failed profile storage restores the previous polar selection', async () => {
  await savePrivateBoat({id:'a',name:'Mine',className:'',sailNumber:''});
  const polar={id:'new-polar',name:'J24',source:'orc' as const,version:'2024',createdAt:'2026-10-12T00:00:00Z',points:[{tws:6,twa:90,speed:5}]};
  const original=(AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  const spy=jest.spyOn(AsyncStorage,'setItem').mockImplementation(async(key,value)=>{if(key==='veetr-private-boats:v1')throw new Error('Disk full');return original(key,value);});
  await expect(savePrivateBoat({id:'a',name:'Changed',className:'',sailNumber:'',catalogPolar:polar})).rejects.toThrow('Disk full');
  spy.mockImplementation(original);
  expect((await activePrivateBoat())?.name).toBe('Mine');
  expect((await polarRepository.read('a')).selectedId).toBeUndefined();
});

 test("linking preserves the local identity and details, is idempotent, and can be undone", async () => {
  const boat={id:"local",name:"My name",className:"Cruiser",sailNumber:"123",draftM:2};
  await savePrivateBoat(boat);
  await AsyncStorage.setItem("private-trip", JSON.stringify({boatId:"local",sharing:"unlisted"}));
  const race={boatId:"race",boatName:"Race name"};
  await linkRaceBoat(race,"local");
  await linkRaceBoat(race,null);
  expect((await privateFleet()).boats).toEqual([boat]);
  expect(await localBoatIdForRace("race")).toBe("local");
  await savePrivateBoat({...boat,name:"Edited"});
  expect(linkedRaceBoat(await privateFleet(),"race")?.name).toBe("Edited");
  expect(JSON.parse((await AsyncStorage.getItem("private-trip"))!)).toEqual({boatId:"local",sharing:"unlisted"});
  await linkRaceBoat(race,undefined);
  expect(await localBoatIdForRace("race")).toBe("race");
  expect((await privateFleet()).boats).toHaveLength(1);
 });
 test("new invitation boats are created once; relinking and deletion leave no stale mappings", async () => {
  const race={boatId:"race",boatName:"Race name"};
  await Promise.all([linkRaceBoat(race,null),linkRaceBoat(race,null)]);
  expect((await privateFleet()).boats).toHaveLength(1);
  expect(await localBoatIdForRace("race")).toBe("new-boat");
  await savePrivateBoat({id:"other",name:"Other",className:"",sailNumber:""});
  await linkRaceBoat(race,"other");
  expect((await privateFleet()).raceLinks).toHaveLength(1);
  await expect(linkRaceBoat(race,"missing")).rejects.toThrow();
  expect(await localBoatIdForRace("race")).toBe("other");
  await deletePrivateBoat("other");
  expect(await localBoatIdForRace("race")).toBe("race");
 });
 test("links are isolated by server and a failed write keeps the previous link", async () => {
  const server=process.env.EXPO_PUBLIC_SUPABASE_URL;
  try {
    process.env.EXPO_PUBLIC_SUPABASE_URL="local";
    await linkRaceBoat({boatId:"race",boatName:"Boat"},null);
    process.env.EXPO_PUBLIC_SUPABASE_URL="production";
    expect(await localBoatIdForRace("race")).toBe("race");
    process.env.EXPO_PUBLIC_SUPABASE_URL="local";
    const implementation=(AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
    const write=jest.spyOn(AsyncStorage,"setItem").mockRejectedValueOnce(new Error("Disk full"));
    await expect(linkRaceBoat({boatId:"race",boatName:"Boat"},undefined)).rejects.toThrow("Disk full");
    expect(await localBoatIdForRace("race")).toBe("new-boat");
    write.mockImplementation(implementation);
  } finally { if(server===undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=server; }
 });

test("boat weight is stored offline and invalid values preserve the saved weight",async()=>{
 const boat={id:"weight",name:"Boat",className:"",sailNumber:"",weightKg:1234.5};
 await savePrivateBoat(boat);
 expect((await activePrivateBoat())?.weightKg).toBe(1234.5);
 for(const weightKg of [-1,0,NaN,Infinity,1000000000])await expect(savePrivateBoat({...boat,weightKg})).rejects.toThrow("weight");
 expect((await activePrivateBoat())?.weightKg).toBe(1234.5);
});
