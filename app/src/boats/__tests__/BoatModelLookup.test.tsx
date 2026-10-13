import React from 'react';
import {fireEvent,render,waitFor} from '@testing-library/react-native';
import BoatModelLookup from '../BoatModelLookup';
import {useOnlineStatus} from '../../hooks/useOnlineStatus';
import {searchBoatModels,boatConfigurations,boatCatalogDetail} from '../catalog';
jest.mock('../../hooks/useOnlineStatus',()=>({useOnlineStatus:jest.fn(()=>true)}));
jest.mock('../catalog',()=>({searchBoatModels:jest.fn(),boatConfigurations:jest.fn(),boatCatalogDetail:jest.fn()}));
jest.mock('react-native',()=>({Text:'Text',View:'View',TextInput:'TextInput',ScrollView:'View',Pressable:'View',Modal:({visible,children}:any)=>visible?children:null,StyleSheet:{flatten:(s:any)=>s}}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'View'}));
jest.mock('../../context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
beforeEach(()=>{jest.clearAllMocks();(useOnlineStatus as jest.Mock).mockReturnValue(true);});
test('offline lookup explains the requirement and permits Custom without requests',async()=>{
 (useOnlineStatus as jest.Mock).mockReturnValue(false);const select=jest.fn(async()=>{});const ui=render(<BoatModelLookup onSelect={select}/>);
 expect(ui.getByText('Boat search works only online. Your saved boat and polar remain available offline.')).toBeTruthy();
 fireEvent.press(ui.getByLabelText('Boat model'));expect(ui.getByLabelText('Search manufacturer or model').props.editable).toBe(false);
 fireEvent.press(ui.getByText('Custom boat ✓'));await waitFor(()=>expect(select).toHaveBeenCalledWith(null));
 expect(searchBoatModels).not.toHaveBeenCalled();ui.unmount();
});
test('search loads configurations and fetches only the selected polar',async()=>{
 const config={id:'2024:1',configuration:'NOR/1',year:2004,draft_m:1.22,revision:'abc'};
 (searchBoatModels as jest.Mock).mockResolvedValue([{model_key:'j24',model:'J/24',manufacturer:'J Boats',configurations:1}]);
 (boatConfigurations as jest.Mock).mockResolvedValue([config]);(boatCatalogDetail as jest.Mock).mockResolvedValue({model:'J/24',points:[]});
 const select=jest.fn(async()=>{});const ui=render(<BoatModelLookup onSelect={select}/>);
 fireEvent.press(ui.getByLabelText('Boat model'));fireEvent.changeText(ui.getByLabelText('Search manufacturer or model'),'J24');
 await waitFor(()=>expect(ui.getByText('J/24')).toBeTruthy());expect(boatCatalogDetail).not.toHaveBeenCalled();
 fireEvent.press(ui.getByText('J/24'));await waitFor(()=>expect(ui.getByText('NOR/1')).toBeTruthy());
 fireEvent.press(ui.getByText('NOR/1'));await waitFor(()=>expect(select).toHaveBeenCalledWith({model:'J/24',points:[]}));
 expect(boatCatalogDetail).toHaveBeenCalledWith(config);ui.unmount();
});
