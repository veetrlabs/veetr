import AsyncStorage from "@react-native-async-storage/async-storage";
import { PolarRepository } from "../../../packages/shared/src/polar/repository";
export const polarRepository = new PolarRepository(AsyncStorage);
