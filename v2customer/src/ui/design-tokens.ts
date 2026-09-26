export const customerDesignTokens=Object.freeze({
  color:Object.freeze({
    brandNavy:'#15396B',
    brandOrange:'#F07F24',
    warmBackground:'#F7F1E9',
    surface:'#FFFDFA',
    text:'#253346',
    muted:'#7B8490',
    border:'#E6DED5',
    success:'#3A9A68',
    warning:'#E9A94C',
    error:'#D75D5D',
    info:'#2467B2',
    whatsapp:'#25D366',
    femaleAccent:'#8659B5',
    maleAccent:'#2467B2',
  }),
  spacing:Object.freeze({xxs:4,xs:8,sm:12,md:16,lg:24,xl:32,xxl:40,xxxl:48,huge:64}),
  radius:Object.freeze({xs:10,sm:14,md:18,lg:24,xl:32,pill:999}),
  size:Object.freeze({touchMin:44,controlHeight:52,inputHeight:48,bottomNavigationHeight:64,mobileBaselineWidth:390,contentMaxWidth:480}),
  motion:Object.freeze({fast:120,normal:220,slow:360}),
} as const);

export type CustomerIpVariant='female'|'male';

export function customerIpAccent(variant:CustomerIpVariant){
  return variant==='female'?customerDesignTokens.color.femaleAccent:customerDesignTokens.color.maleAccent;
}

// IP accent is decorative only. Business/transaction states must use semantic
// success/warning/error/info tokens and never change meaning between variants.
