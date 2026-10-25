import React from 'react';
import {render,fireEvent,waitFor} from '@testing-library/react-native';
import TripEngineUse from '../TripEngineUse';
import type {TrackingSession, TrackingPoint} from '../model';
const mockUpdate=jest.fn();
jest.mock('react-native',()=>({Text:'Text',View:'View',Modal:'Modal',ScrollView:'ScrollView',Pressable:({children,...props}:any)=>require('react').createElement('View',{accessible:true,...props},children),StyleSheet:{flatten:(s:unknown)=>s}}));
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
 expect(ui.queryByRole('combobox')).toBeNull();
 fireEvent.press(ui.getAllByRole('button',{name:/^Section /})[0]);
 fireEvent.press(ui.getByText('Split at selected time'));
 await waitFor(()=>expect(ui.getAllByRole('button', {name: /^Section /})).toHaveLength(2));
 expect(saved.mock.calls[0][0].propulsionSections).toEqual([
  {startedAt:points[0].recordedAt,propulsion:'sailing-only'},
  {startedAt:points[2].recordedAt,propulsion:'sailing-only'}]);
 fireEvent.press(ui.getByRole('combobox'));
 fireEvent.press(ui.getByText('Engine used'));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
 expect(saved.mock.calls[1][0].engineUse).toBe('engine-used');
 fireEvent.press(ui.getByText('← Join left'));
 await waitFor(()=>expect(ui.getAllByRole('button', {name: /^Section /})).toHaveLength(1));
 fireEvent.press(ui.getByText('Undo last section edit'));
 await waitFor(()=>expect(ui.getAllByRole('button', {name: /^Section /})).toHaveLength(2));
 expect(saved.mock.calls[3][0].propulsionSections[1].propulsion).toBe('engine-used');
});
test('failed save leaves sections intact and reports the failure',async()=>{
 mockUpdate.mockRejectedValueOnce(new Error('Storage unavailable'));
 const saved=jest.fn();
 const ui=render(<TripEngineUse session={session} points={points} index={2} onSaved={saved}/>);
 fireEvent.press(ui.getAllByRole('button',{name:/^Section /})[0]);
 fireEvent.press(ui.getByText('Split at selected time'));
 await waitFor(()=>expect(ui.getByRole('alert')).toBeTruthy());
 expect(saved).not.toHaveBeenCalled();
 expect(ui.getAllByRole('combobox')).toHaveLength(1);
});

test('cannot split at either end or at an existing boundary',()=>{
 const props={session,points,onSaved:jest.fn()};
 const ui=render(<TripEngineUse {...props} index={0}/>);
 fireEvent.press(ui.getAllByRole('button',{name:/^Section /})[0]);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 ui.rerender(<TripEngineUse {...props} index={3}/>);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 ui.rerender(<TripEngineUse {...props} index={2} session={{...session,propulsionSections:[
  {startedAt:points[0].recordedAt,propulsion:'sailing-only'},
  {startedAt:points[2].recordedAt,propulsion:'engine-used'},
 ]}}/>);
 expect(ui.getByRole('button',{name:'Split at selected time'}).props.accessibilityState.disabled).toBe(true);
 fireEvent.press(ui.getAllByRole('button',{name:/^Section /})[1]);
 expect(ui.getAllByRole('button',{name:'← Join left'})).toHaveLength(1);
});

test('the proportional bar selects one editor and clips to the chart time range',()=>{
 const mixed={...session,propulsionSections:[
  {startedAt:points[0].recordedAt,propulsion:'engine-used' as const},
  {startedAt:points[1].recordedAt,propulsion:'sailing-only' as const},
 ]};
 const ui=render(<TripEngineUse session={mixed} points={points} index={2} onSaved={jest.fn()}/>);
 const bars=ui.getAllByRole('button',{name:/^Section /});
 expect(bars).toHaveLength(2);
 expect(bars[0].props.style({pressed:false}).backgroundColor).toBe('#64748b');
 expect(bars[1].props.style({pressed:false}).backgroundColor).toBe('#008c80');
 expect(bars[1].props.style({pressed:false}).flex).toBe(2*bars[0].props.style({pressed:false}).flex);
 expect(ui.queryByRole('combobox')).toBeNull();
 fireEvent.press(bars[0]);
 expect(ui.getByRole('combobox').props.accessibilityValue.text).toBe('Engine used');
 fireEvent.press(bars[1]);
 expect(ui.getByRole('combobox').props.accessibilityValue.text).toBe('Sailing only');
 ui.rerender(<TripEngineUse session={mixed} points={points} index={2} range={[15000,30000]} onSaved={jest.fn()}/>);
 expect(ui.getAllByRole('button',{name:/^Section /})).toHaveLength(1);
});

test.each(['← Join left', 'Join right →'])('%s preserves selected propulsion and can be undone',async(direction)=>{
 const initial={...session,propulsionSections:[
  {startedAt:points[0].recordedAt,propulsion:'engine-used' as const},
  {startedAt:points[1].recordedAt,propulsion:'sailing-only' as const},
  {startedAt:points[2].recordedAt,propulsion:'unknown' as const},
 ]};
 const saved=jest.fn();
 function Screen(){
  const [value,setValue]=React.useState<TrackingSession>(initial);
  return <TripEngineUse session={value} points={points} index={1} onSaved={s=>{saved(s);setValue(s)}}/>;
 }
 const ui=render(<Screen/>);
 fireEvent.press(ui.getAllByRole('button',{name:/^Section /})[1]);
 expect(ui.getByRole('button',{name:'← Join left'})).toBeTruthy();
 expect(ui.getByRole('button',{name:'Join right →'})).toBeTruthy();
 fireEvent.press(ui.getByRole('button',{name:direction}));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));
 expect(saved.mock.calls[0][0].propulsionSections).toEqual(direction==='← Join left' ? [
  {...initial.propulsionSections[0],propulsion:'sailing-only'}, initial.propulsionSections[2],
 ] : [initial.propulsionSections[0],initial.propulsionSections[1]]);
 expect(ui.queryByRole('button',{name:direction})).toBeNull();
 fireEvent.press(ui.getByRole('button',{name:'Undo last section edit'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
 expect(saved.mock.calls[1][0].propulsionSections).toEqual(initial.propulsionSections);
});

test('section editor opens only on tap and closes without changing the trip',()=>{
 const saved=jest.fn();
 const ui=render(<TripEngineUse session={session} points={points} index={2} onSaved={saved}/>);
 expect(ui.queryByRole('combobox')).toBeNull();
 fireEvent.press(ui.getByRole('button',{name:/^Section 1/}));
 expect(ui.getByRole('combobox')).toBeTruthy();
 fireEvent.press(ui.getByRole('button',{name:'Close'}));
 expect(ui.queryByRole('combobox')).toBeNull();
 expect(saved).not.toHaveBeenCalled();
});
