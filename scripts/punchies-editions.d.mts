export const EDITIONS: {defaultEdition:string};
export function editionContract(name?:string,options?:{allowPreparation?:boolean}):{name:string;fighters:string[];policyHash:string;storageNamespace:string};
export function editionTune(source:any,name:string):any;
export function editionBuildIdentity(name:string,profile:string,portal:string):string;
export function selectEditionArt(directory:string,name:string):unknown;
