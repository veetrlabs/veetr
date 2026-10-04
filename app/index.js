// Background launches do not mount the router's layouts. Register the location
// task at bundle startup before loading the UI entry point.
import './src/tracking/service';
import './src/anchor/service';
import 'expo-router/entry';
