export const CUSTOMER_V3_ASSETS=Object.freeze({
  logo:'https://cdn.creativeclaw.co/u/6ad84d58/images/6c117fc9-a78a-44ab-a781-aa94fad1f34c.png',

  heroBackgroundR2:'/media/customer/hero/hero-background-main.png',
  maleHeroR2:'/media/customer/hero/hero-male-main.png',
  femaleHeroR2:'/media/customer/hero/hero-female-main.png',
  moreFunDoodleR2:'/media/customer/hero/hero-doodle-morefun-main.png',
  goodTasteDoodleR2:'/media/customer/hero/hero-doodle-goodtaste-main.png',

  // Locked reference only; never rendered as the live UI.
  lockedLongHomeReferenceR2:'https://cdn.creativeclaw.co/u/6ad84d58/images/09313f05-42df-4018-ba67-a232bcdb2df9.png',

  bowl:'https://raw.githubusercontent.com/Pantonyeung/mfk/main/v2customer/public/brand/mf-home-hero-bowl.webp',
  salad:'https://raw.githubusercontent.com/Pantonyeung/mfk/main/v2customer/public/brand/mf-home-hero-salad.webp',
  riceball:'https://raw.githubusercontent.com/Pantonyeung/mfk/main/v2customer/public/brand/p0-riceball.webp'
});

export const CUSTOMER_V3_HERO_SLIDES=Object.freeze([
  Object.freeze({id:'home-hero-01',label:'一齊出發',src:'/media/customer/hero-carousel/home-hero-01.webp'}),
  Object.freeze({id:'home-hero-02',label:'季節手作',src:'/media/customer/hero-carousel/home-hero-02.webp'}),
  Object.freeze({id:'home-hero-03',label:'輕鬆取餐',src:'/media/customer/hero-carousel/home-hero-03.webp'}),
  Object.freeze({id:'home-hero-04',label:'收藏回憶',src:'/media/customer/hero-carousel/home-hero-04.webp'})
] as const);

export const CUSTOMER_V3_R2_ASSET_EVIDENCE=Object.freeze({
  heroBackgroundR2:Object.freeze({
    bucket:'mfk-customer-assets',
    objectKey:'customer/brand/hero/hero-background-main.png',
    sha256:'4c7169f5c57f12f445eb9222e71750f3476b4de0433424867d4442e238cd1db1'
  }),
  maleHeroR2:Object.freeze({
    bucket:'mfk-customer-assets',
    objectKey:'customer/brand/hero/hero-male-main.png',
    sha256:'231d7a2848af5f8eb689d4d41a6d8114236d9fdfc76c9179948612fc70ccf8ba'
  }),
  femaleHeroR2:Object.freeze({
    bucket:'mfk-customer-assets',
    objectKey:'customer/brand/hero/hero-female-main.png',
    sha256:'22e1b2bee4d5cc11c514e4885f2450d74439f9caa8f78081ed3e711a17546bbe'
  }),
  moreFunDoodleR2:Object.freeze({
    bucket:'mfk-customer-assets',
    objectKey:'customer/brand/hero/hero-doodle-morefun-main.png',
    sha256:'06ac2e24485964613dff929bd2404ac17708f5ab50b8fa3dbcab475ee354ece7'
  }),
  goodTasteDoodleR2:Object.freeze({
    bucket:'mfk-customer-assets',
    objectKey:'customer/brand/hero/hero-doodle-goodtaste-main.png',
    sha256:'584b1e7bd6fab50c55494bab5cce7c80635736bd647ed5d1ee626aed5f74cfd1'
  }),
  heroCarousel:Object.freeze([
    Object.freeze({objectKey:'customer/brand/hero-carousel/home-hero-01.webp',sha256:'a54f4ce0cc8cacf1ede07d1eb802f9e50b1b466ca53527ae611e1d678085df83'}),
    Object.freeze({objectKey:'customer/brand/hero-carousel/home-hero-02.webp',sha256:'6067f7abd2f46ecb0e84fda3b633965bbf470b87b529608eb8325c428a9fb276'}),
    Object.freeze({objectKey:'customer/brand/hero-carousel/home-hero-03.webp',sha256:'7052fb7cb10bd5fe0a2a8db6976c8c0bb5695fbbf1f3b7e5671fa6efbab52951'}),
    Object.freeze({objectKey:'customer/brand/hero-carousel/home-hero-04.webp',sha256:'ea33c164830b0077d074493536ef7ed0963920194ee1e382540a09cc95ddd919'})
  ].map(asset=>Object.freeze({bucket:'mfk-customer-assets',...asset})))
});
