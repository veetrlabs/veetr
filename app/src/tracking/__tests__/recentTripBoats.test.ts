import AsyncStorage from '@react-native-async-storage/async-storage';
import { orderTripBoats, recentTripBoats, rememberTripBoat } from '../recentTripBoats';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../client', () => ({ trackingClient: { auth: { getSession: async () => ({ data: { session: { user: { id: 'sailor' } } } }) } } }));
beforeEach(async () => { await AsyncStorage.clear(); });
test('orders recent available boats first, then unused boats alphabetically', () => {
 const boats = ['Zulu', 'Beta', 'Alpha', 'Luna'].map(name => ({ id: name, name, color: '' }));
 expect(orderTripBoats(boats, ['Luna', 'removed', 'Zulu']).map(b => b.name)).toEqual(['Luna', 'Zulu', 'Alpha', 'Beta']);
 expect(boats[0].name).toBe('Zulu');
});
test('migrates previous last-used boat and remembers multiple boats without duplicates', async () => {
 await AsyncStorage.setItem('veetr-last-trip-boat:sailor', 'luna');
 await rememberTripBoat('sky');
 expect(await recentTripBoats()).toEqual(['sky', 'luna']);
 await rememberTripBoat('luna');
 expect(await recentTripBoats()).toEqual(['luna', 'sky']);
 expect(await AsyncStorage.getItem('veetr-last-trip-boat:sailor')).toBe('luna');
});
