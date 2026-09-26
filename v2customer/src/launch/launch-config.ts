export type LaunchVariant='male'|'female'|'hybrid';

export interface LaunchAsset {
  readonly id:string;
  readonly enabled:boolean;
  readonly weight:number;
  readonly videoUrl:string|null;
  readonly poster:string|null;
}

const HYBRID_VIDEO='https://cdn.creativeclaw.co/u/6ad84d58/videos/e788f78a-6345-45fa-8d87-467699aa5795.mp4';
const HYBRID_POSTER='https://cdn.creativeclaw.co/u/6ad84d58/images/386b4f12-f5c2-4f96-8862-97d66425646e.png';

export const launchAssets:Readonly<Record<LaunchVariant,LaunchAsset>>=Object.freeze({
  male:Object.freeze({
    id:'STAGE0_MALE_PENDING_OWNER_ASSET',
    enabled:false,
    weight:35,
    videoUrl:null,
    poster:null,
  }),
  female:Object.freeze({
    id:'STAGE0_FEMALE_PENDING_OWNER_ASSET',
    enabled:false,
    weight:35,
    videoUrl:null,
    poster:null,
  }),
  hybrid:Object.freeze({
    id:'STAGE0_HYBRID_CANDIDATE_A',
    enabled:true,
    weight:30,
    videoUrl:HYBRID_VIDEO,
    poster:HYBRID_POSTER,
  }),
});

export const enabledVariants=():readonly LaunchVariant[]=>
  (Object.keys(launchAssets) as LaunchVariant[]).filter(variant=>{
    const asset=launchAssets[variant];
    return asset.enabled&&Boolean(asset.videoUrl||asset.poster);
  });

const isLaunchVariant=(value:string|null|undefined):value is LaunchVariant=>
  value==='male'||value==='female'||value==='hybrid';

export function resolveLaunchVariant(requested?:string|null,random:()=>number=Math.random):LaunchVariant{
  const enabled=enabledVariants();
  if(isLaunchVariant(requested)&&enabled.includes(requested))return requested;
  const weighted=enabled.flatMap(variant=>Array.from({length:Math.max(1,launchAssets[variant].weight)},()=>variant));
  if(!weighted.length)return 'hybrid';
  const index=Math.min(weighted.length-1,Math.floor(Math.max(0,Math.min(.999999,random()))*weighted.length));
  return weighted[index]??'hybrid';
}

export function launchAssetFor(variant:LaunchVariant):LaunchAsset{
  const candidate=launchAssets[variant];
  return candidate.enabled&&(candidate.videoUrl||candidate.poster)?candidate:launchAssets.hybrid;
}
