import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TripBoat from '../TripBoat';
import type { TrackingSession } from '../model';
const mockSelect=jest.fn(),mockRead=jest.fn();
jest.mock('../tripSharing',()=>({selectTripBoat:(...args:unknown[])=>mockSelect(...args)}));
jest.mock('../database',()=>({trackingStore:async()=>({localRecording:mockRead})}));
jest.mock('../TripBoatPicker',()=> (props:any)=>require('react').createElement('View',{...props,testID:'boat-picker'}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
jest.mock('react-native',()=>({Text:'Text',View:'View',StyleSheet:{flatten:(s:unknown)=>s}}));
const session={id:'trip',mode:'local',boatId:'old',boatName:'Old boat'} as TrackingSession;
beforeEach(()=>{mockSelect.mockReset();mockRead.mockReset()});
test('boat changes save immediately and refresh the stored identity',async()=>{
 const saved=jest.fn(),boat={id:'new',name:'New boat',color:'#008c80'};
 mockRead.mockResolvedValue({session:{...session,boatId:boat.id,boatName:boat.name}});
 const ui=render(<TripBoat session={session} onSaved={saved}/>);
 expect(ui.getByTestId('boat-picker').props.selectedName).toBe('Old boat');
 fireEvent(ui.getByTestId('boat-picker'),'select',boat);
 await waitFor(()=>expect(saved).toHaveBeenCalledWith({...session,boatId:'new',boatName:'New boat'}));
 expect(mockSelect).toHaveBeenCalledWith('trip',boat);
});
test('failed updates keep the original boat and show an inline error',async()=>{
 const saved=jest.fn();mockSelect.mockRejectedValue(new Error('Boat access is no longer available.'));
 const ui=render(<TripBoat session={session} onSaved={saved}/>);
 fireEvent(ui.getByTestId('boat-picker'),'select',{id:'new',name:'New boat'});
 await waitFor(()=>expect(ui.getByRole('alert')).toBeTruthy());
 expect(saved).not.toHaveBeenCalled();
 expect(ui.getByTestId('boat-picker').props.selected).toBe('old');
});
test('linked race and uploaded trips show their boat without offering reassignment',()=>{
 const ui=render(<TripBoat session={{...session,mode:'race'}} onSaved={jest.fn()}/>);
 expect(ui.queryByTestId('boat-picker')).toBeNull();
 expect(ui.getByText('Old boat')).toBeTruthy();
 ui.rerender(<TripBoat session={{...session,sharing:{} as any}} onSaved={jest.fn()}/>);
 expect(ui.queryByTestId('boat-picker')).toBeNull();
});
