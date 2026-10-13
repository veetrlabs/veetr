import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BoatPublishing from "../BoatPublishing";
import { boatAccount, ownedBoats, publishBoat } from "../cloudBoats";
jest.mock("../cloudBoats",()=>({boatAccount:jest.fn(),ownedBoats:jest.fn(),publishBoat:jest.fn()}));
jest.mock("../privateBoats",()=>({privateFleet:async()=>({boats:[]}),raceBoatIdForLocal:()=>"cloud"}));
jest.mock("../../components/AccountSignIn",()=>({__esModule:true,default:()=>require('react').createElement('Text',null,'Sign-in form')}));
jest.mock("../../context/ThemeContext",()=>({useTheme:()=>({theme:"light"})}));
jest.mock("expo-router",()=>({useFocusEffect:(fn:any)=>require('react').useEffect(fn,[fn])}));
jest.mock("react-native",()=>({Text:"Text",View:"View",Pressable:"View",Linking:{openURL:jest.fn()},StyleSheet:{flatten:(s:unknown)=>s}}));
beforeEach(()=>{jest.clearAllMocks();(boatAccount as jest.Mock).mockResolvedValue({id:'owner'});(ownedBoats as jest.Mock).mockResolvedValue([]);});
test('publishing requires an explicit action and retains failure for retry',async()=>{
 const refreshed=jest.fn();const ui=render(<BoatPublishing boatId="local" onRefresh={refreshed}/>);
 await waitFor(()=>expect(ui.getByText('Publish boat')).toBeTruthy());expect(publishBoat).not.toHaveBeenCalled();
 (publishBoat as jest.Mock).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({id:'cloud',updatedAt:'now'});
 fireEvent.press(ui.getByText('Publish boat'));await waitFor(()=>expect(ui.getByText('Offline')).toBeTruthy());
 expect(refreshed).not.toHaveBeenCalled();fireEvent.press(ui.getByText('Publish boat'));
 await waitFor(()=>expect(ui.getByText('Boat published.')).toBeTruthy());expect(ui.getByText('Publish updates')).toBeTruthy();
 expect(refreshed).toHaveBeenCalledTimes(1);ui.unmount();
});
test('an existing owned boat sends the loaded revision and signed-out users see sign-in',async()=>{
 const cloud={id:'cloud',updatedAt:'previous'};(ownedBoats as jest.Mock).mockResolvedValue([cloud]);(publishBoat as jest.Mock).mockResolvedValue(cloud);
 const ui=render(<BoatPublishing boatId="local" onRefresh={()=>{}}/>);
 await waitFor(()=>expect(ui.getByText('Publish updates')).toBeTruthy());fireEvent.press(ui.getByText('Publish updates'));
 await waitFor(()=>expect(publishBoat).toHaveBeenCalledWith('local',cloud));ui.unmount();
 (boatAccount as jest.Mock).mockResolvedValue(null);
 const signedOut=render(<BoatPublishing boatId="local" onRefresh={()=>{}}/>);
 await waitFor(()=>expect(signedOut.getByText('Sign-in form')).toBeTruthy());expect(signedOut.queryByText('Publish boat')).toBeNull();signedOut.unmount();
});
