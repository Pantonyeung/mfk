import {CUSTOMER_FINAL_SOURCE} from '../source-assets';

export type LaunchVariant='male'|'female';

export interface LaunchAsset {
  readonly id:string;
  readonly characterSheetUrl:string;
  readonly accent:string;
}

export const OFFICIAL_LOGO_URL=CUSTOMER_FINAL_SOURCE.logo.url;
export const STAGE0_RICEBALL_URL=CUSTOMER_FINAL_SOURCE.riceball.url;
export const STAGE0_BENTO_URL=CUSTOMER_FINAL_SOURCE.bento.url;

export const launchAssets:Readonly<Record<LaunchVariant,LaunchAsset>>=Object.freeze({
  male:Object.freeze({
    id:'MFK_STAGE0_MALE_FINAL_SOURCE',
    characterSheetUrl:CUSTOMER_FINAL_SOURCE.maleIpSheet.url,
    accent:'#2d6eb8',
  }),
  female:Object.freeze({
    id:'MFK_STAGE0_FEMALE_FINAL_SOURCE',
    characterSheetUrl:CUSTOMER_FINAL_SOURCE.femaleIpSheet.url,
    accent:'#9458c8',
  }),
});

export const isLaunchVariant=(value:string|null|undefined):value is LaunchVariant=>
  value==='male'||value==='female';

export function resolveLaunchVariant(requested?:string|null,random:()=>number=Math.random):LaunchVariant{
  if(isLaunchVariant(requested))return requested;
  return Math.max(0,Math.min(.999999,random()))<.5?'male':'female';
}

export function launchAssetFor(variant:LaunchVariant):LaunchAsset{
  return launchAssets[variant];
}
