export type LaunchVariant='male'|'female';

export interface LaunchAsset {
  readonly id:string;
  readonly characterUrl:string;
  readonly accent:string;
}

export const OFFICIAL_LOGO_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/402357b6-d757-4238-99f7-3d20607da6f2.png';
export const STAGE0_RICEBALL_URL='/brand/p0-riceball.webp';
export const STAGE0_BENTO_URL='/brand/mf-home-hero-bowl.webp';

export const launchAssets:Readonly<Record<LaunchVariant,LaunchAsset>>=Object.freeze({
  male:Object.freeze({
    id:'MFK_STAGE0_MALE_FINAL',
    characterUrl:'/brand/stage0-male.webp',
    accent:'#2467b2',
  }),
  female:Object.freeze({
    id:'MFK_STAGE0_FEMALE_FINAL',
    characterUrl:'/brand/stage0-female.webp',
    accent:'#8659b5',
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
