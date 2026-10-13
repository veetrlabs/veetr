import React from 'react';
import {render,waitFor,fireEvent} from '@testing-library/react-native';
import BoatPolarDetails from '../BoatPolarDetails';
const mockPolar={id:'current',name:'Current boat polar',source:'orc',version:'1',createdAt:'2026-10-13T00:00:00Z',points:[{tws:8,twa:60,speed:5}]};
let mockEntries:any[]=[];
const mockMeasured={...mockPolar,id:'measured',name:'Measured curve',source:'learned'};
jest.mock('react-native',()=>({Text:'Text',View:'View',Pressable:'Pressable',TextInput:'TextInput',Switch:'Switch',StyleSheet:{flatten:(s:unknown)=>s}}));
jest.mock('expo-router',()=>({useFocusEffect:(fn:any)=>require("react").useEffect(fn,[fn])}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'new'}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
jest.mock('../../i18n',()=>({t:(s:string)=>s,formatNumber:(v:number)=>String(v),locale:()=>"en",translateMessage:(s:string)=>s,useLanguageRefresh:()=>{}}));
jest.mock('../repository',()=>({polarRepository:{read:async()=>({polars:[{...mockPolar,id:'old',name:'Old downloaded chart'},mockPolar,mockMeasured],selectedId:'current',observationSets:[]})}}));
jest.mock('../../tracking/database',()=>({trackingStore:async()=>({localRecordings:async()=>[]})}));
jest.mock('../observations',()=>({tripObservations:jest.fn()}));
jest.mock('../sync',()=>({syncPolars:jest.fn()}));
jest.mock('../PolarDiagram',()=>({__esModule:true,default:(props:any)=>require('react').createElement('View',{testID:'diagram',...props})}));
test('boat details shows one reference compared with measured sailing, without history selector or live score',async()=>{
 const screen=render(<BoatPolarDetails boatId="a"/>);
 await waitFor(()=>expect(screen.getByTestId('diagram')).toBeTruthy());
 expect(screen.queryByText('Current boat polar')).toBeNull();
 expect(screen.queryByText('Old downloaded chart')).toBeNull();
 expect(screen.queryByLabelText('Performance benchmark')).toBeNull();
 expect(screen.queryByText('Target')).toBeNull();
 expect(screen.queryByLabelText('Polar CSV')).toBeNull();
 expect(screen.queryByLabelText('Engine was off for this entire trip')).toBeNull();
 expect(screen.getByTestId('diagram').props.polar.id).toBe('current');
 expect(screen.getByTestId('diagram').props.measured.id).toBe('measured');
});

jest.mock("react-native-svg",()=>({__esModule:true,default:"Svg",Line:"Line"}));

jest.mock('../tripPolars',()=>({boatTripPolars:()=>mockEntries,refreshBoatTripPolar:async()=>({polars:[mockPolar,mockMeasured],selectedId:'current',observationSets:[]})}));
test('trip toggles add and remove only that trip from the comparison; import stays collapsed',async()=>{
 mockEntries=[{trip:{session:{id:'older',boatName:'Last year',startedAt:'2025-01-01'}},polar:{...mockMeasured,id:'older'},dash:'8 4',unknown:true},{trip:{session:{id:'newer',boatName:'This year',startedAt:'2026-01-01'}},polar:{...mockMeasured,id:'newer'},dash:'2 4',unknown:false}];
 const screen=render(<BoatPolarDetails boatId="a"/>);
 await waitFor(()=>expect(screen.getByTestId('diagram').props.comparisons).toHaveLength(2));
 const row=screen.UNSAFE_getAllByType('Pressable' as any).find(view=>view.props.accessibilityLabel?.startsWith('Last year'))!;
 fireEvent.press(row);
 expect(screen.getByTestId('diagram').props.comparisons.map((item:any)=>item.polar.id)).toEqual(['newer']);
 expect(screen.getByText('Engine use unknown. This curve may include motoring.')).toBeTruthy();
 expect(screen.queryByLabelText('Polar CSV')).toBeNull();
 fireEvent.press(screen.getByLabelText('Edit polar data'));
 expect(screen.getByLabelText('Polar CSV')).toBeTruthy();
 mockEntries=[];
});

test('editing the reference previews its curve while measured data stays unchanged',async()=>{
 const screen=render(<BoatPolarDetails boatId="a"/>);
 await waitFor(()=>expect(screen.getByTestId('diagram')).toBeTruthy());
 fireEvent.press(screen.getByLabelText('Edit polar data'));
 expect(screen.getByLabelText('Polar CSV').props.value).toBe('TWS,TWA,speed\n8,60,5');
 fireEvent.changeText(screen.getByLabelText('Polar CSV'),'TWS,TWA,speed\n8,60,7');
 expect(screen.getByTestId('diagram').props.polar.points[0].speed).toBe(7);
 expect(screen.getByTestId('diagram').props.measured).toEqual(mockMeasured);
 fireEvent.changeText(screen.getByLabelText('Polar CSV'),'TWS,TWA,speed\n8,60,');
 expect(screen.getByTestId('diagram').props.polar.points[0].speed).toBe(7);
});
