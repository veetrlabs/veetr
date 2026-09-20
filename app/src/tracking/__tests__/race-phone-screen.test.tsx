import React from 'react';
import {act,fireEvent,render,waitFor} from '@testing-library/react-native';
import {Alert} from 'react-native';
import RacePhoneScreen from '../RacePhoneScreen';
import {trackingRpc} from '../client';
import {claimRacePhone} from '../racePhone';
import {readyForRace} from '../service';
jest.mock('react-native',()=>({Text:'Text',View:'View',ScrollView:'ScrollView',Pressable:'Pressable',Alert:{alert:jest.fn()},Linking:{openSettings:jest.fn()},StyleSheet:{flatten:(s:unknown)=>s}}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'View'}));
jest.mock('expo-router',()=>({router:{canGoBack:()=>false,replace:jest.fn()}}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
jest.mock('../client',()=>({trackingRpc:jest.fn()}));
jest.mock('../racePhone',()=>({claimRacePhone:jest.fn(),savedRacePhone:jest.fn(),racePhoneRpc:jest.fn()}));
jest.mock('../service',()=>({readyForRace:jest.fn(),resumeTracking:jest.fn(),stopTracking:jest.fn()}));
let mockSession:any=null;
jest.mock('../database',()=>({trackingStore:async()=>({get:async()=>mockSession})}));
const phone={linkId:'link',boatId:'boat',boatName:'Luna',seriesId:'series',seriesName:'Series',eventId:'event',raceName:'Autumn race',scheduledStart:'2026-09-20T09:00:00Z',expiresAt:'2026-09-21T03:00:00Z',valid:true,active:false,eligible:true};
beforeEach(()=>{jest.clearAllMocks();mockSession=null;(trackingRpc as jest.Mock).mockResolvedValue(phone);(claimRacePhone as jest.Mock).mockResolvedValue(phone);});
test('opening an invitation never pairs or starts GPS without the Ready action and consent',async()=>{
 const ui=render(<RacePhoneScreen token="invitation"/>);
 expect(await ui.findByText('Luna')).toBeTruthy();expect(claimRacePhone).not.toHaveBeenCalled();expect(readyForRace).not.toHaveBeenCalled();
 fireEvent.press(ui.getByText('Ready to race'));
 expect(readyForRace).not.toHaveBeenCalled();
 const buttons=(Alert.alert as jest.Mock).mock.calls[0][2];
 await act(async()=>buttons[1].onPress());
 await waitFor(()=>expect(readyForRace).toHaveBeenCalledWith(phone));
 expect(claimRacePhone).toHaveBeenCalledWith('invitation');
});
test('a ready session shows waiting and offers a stop action rather than asking for another start',async()=>{
 mockSession={...phone,id:'session',mode:'race',raceLinkId:'link',phase:'recording',raceActive:false,raceCheckedAt:new Date().toISOString()};
 const ui=render(<RacePhoneScreen token="invitation"/>);
 expect(await ui.findByText('Ready — waiting for the referee')).toBeTruthy();expect(ui.queryByText('Ready to race')).toBeNull();expect(ui.getByText('Stop / leave race')).toBeTruthy();
});
test('a revoked invitation cannot hide the local stop control for an existing session',async()=>{
 (trackingRpc as jest.Mock).mockResolvedValue(null);
 mockSession={...phone,id:'session',mode:'race',raceLinkId:'link',phase:'recording',raceActive:true};
 const ui=render(<RacePhoneScreen token="revoked"/>);
 expect(await ui.findByText('Stop current race tracking')).toBeTruthy();
});
