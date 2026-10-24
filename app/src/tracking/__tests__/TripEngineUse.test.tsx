import React from 'react';
import {render,fireEvent,waitFor} from '@testing-library/react-native';
import TripEngineUse from '../TripEngineUse';
import type {TrackingSession, TrackingPoint} from '../model';
const mockUpdate=jest.fn();
jest.mock('react-native',()=>({Text:'Text',View:'View',Pressable:({children,...props}:any)=>require('react').createElement('View',{accessible:true,...props},children),StyleSheet:{flatten:(s:unknown)=>s}}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
jest.mock('../database',()=>({trackingStore:async()=>({updateTrip:mockUpdate})}));
jest.mock('../../i18n',()=>({t:(s:string)=>s,translateMessage:(s:string)=>s,locale:()=> 'en'}));
const points = [0,1,2,3].map(i=>({recordedAt:new Date(i*10000).toISOString()} as TrackingPoint));
const session = {id:'trip',startedAt:points[0].recordedAt,engineUse:'sailing-only'} as TrackingSession;
beforeEach(()=>mockUpdate.mockReset());
test('split, change propulsion, join and undo persist without changing recorded points',async()=>{
 const saved=jest.fn();
 function Screen() {
  const [value,setValue]=React.useState(session);
  return <TripEngineUse session={value} points={points} index={2} onSaved={s=>{saved(s);setValue(s)}}/>;
 }
 const ui=render(<Screen/>);
 fireEvent.press(ui.getByText('Split at selected time'));
 await waitFor(()=>expect(ui.getAllByRole('combobox')).toHaveLength(2));
 expect(saved.mock.calls[0][0].propulsionSections).toEqual([
  {startedAt:points[0].recordedAt,propulsion:'sailing-only'},
  {startedAt:points[2].recordedAt,propulsion:'sailing-only'}]);
 fireEvent.press(ui.getAllByRole('combobox')[1]);
 fireEvent.press(ui.getByText('Engine used'));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
 expect(saved.mock.calls[1][0].engineUse).toBe('engine-used');
 fireEvent.press(ui.getByText('Join with previous section'));
 await waitFor(()=>expect(ui.getAllByRole('combobox')).toHaveLength(1));
 fireEvent.press(ui.getByText('Undo last section edit'));
 await waitFor(()=>expect(ui.getAllByRole('combobox')).toHaveLength(2));
 expect(saved.mock.calls[3][0].propulsionSections[1].propulsion).toBe('engine-used');
});
test('failed save leaves sections intact and reports the failure',async()=>{
 mockUpdate.mockRejectedValueOnce(new Error('Storage unavailable'));
 const saved=jest.fn();
 const ui=render(<TripEngineUse session={session} points={points} index={2} onSaved={saved}/>);
 fireEvent.press(ui.getByText('Split at selected time'));
 await waitFor(()=>expect(ui.getByRole('alert')).toBeTruthy());
 expect(saved).not.toHaveBeenCalled();
 expect(ui.getAllByRole('combobox')).toHaveLength(1);
});

test('cannot split at either end or at an existing boundary',()=>{
 const props={session,points,onSaved:jest.fn()};
 const ui=render(<TripEngineUse {...props} index={0}/>);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 ui.rerender(<TripEngineUse {...props} index={3}/>);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 ui.rerender(<TripEngineUse {...props} index={2} session={{...session,propulsionSections:[
  {startedAt:points[0].recordedAt,propulsion:'sailing-only'},
  {startedAt:points[2].recordedAt,propulsion:'engine-used'},
 ]}}/>);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 expect(ui.getAllByRole('button',{name:'Join with previous section'})).toHaveLength(1);
});
