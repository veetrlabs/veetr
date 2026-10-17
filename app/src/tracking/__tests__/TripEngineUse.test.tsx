import React from 'react';
import {render,fireEvent,waitFor} from '@testing-library/react-native';
import TripEngineUse from '../TripEngineUse';
import type {TrackingSession} from '../model';
const mockUpdate=jest.fn();
jest.mock('react-native',()=>({Text:'Text',View:'View',Pressable:({children,...props}:any)=>require('react').createElement('View',{accessible:true,...props},children),StyleSheet:{flatten:(s:unknown)=>s}}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
jest.mock('../database',()=>({trackingStore:async()=>({updateTrip:mockUpdate})}));
jest.mock('../../i18n',()=>({t:(s:string)=>s,translateMessage:(s:string)=>s}));
test('engine use defaults to unknown and saves to the trip on selection',async()=>{
 const saved=jest.fn(),session={id:'trip',engineUse:undefined} as TrackingSession;
 const screen=render(<TripEngineUse session={session} onSaved={saved}/>);
 expect(screen.getByText('Unknown')).toBeTruthy();
 fireEvent.press(screen.getByRole('combobox'));
 fireEvent.press(screen.getByText('Sailing only'));
 await waitFor(()=>expect(mockUpdate).toHaveBeenCalledWith('trip',{engineUse:'sailing-only'}));
 expect(saved).toHaveBeenCalledWith({...session,engineUse:'sailing-only'});
});
