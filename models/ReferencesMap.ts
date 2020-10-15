import { Reference } from './reference';

export interface Pair {
    origin: Reference;
    destinition: Reference;
}

export interface ReferencesMap {
    Pairs: Pair[];
}
