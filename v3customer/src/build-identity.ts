export type CustomerBuildIdentity=Readonly<{
  surface:'MFP_CUSTOMER_V3';
  sourceCommit:string;
  sourceDirty:boolean;
  sourceDigest:string;
  builtAt:string;
  buildId:string;
}>;

declare const __CUSTOMER_BUILD_IDENTITY__:CustomerBuildIdentity;

export const CUSTOMER_BUILD_IDENTITY:CustomerBuildIdentity=Object.freeze(
  typeof __CUSTOMER_BUILD_IDENTITY__==='undefined'
    ?{surface:'MFP_CUSTOMER_V3',sourceCommit:'unavailable',sourceDirty:true,sourceDigest:'unavailable',builtAt:'unavailable',buildId:'unavailable'}
    :__CUSTOMER_BUILD_IDENTITY__
);
