export const orderPageConfig={
  canvas:{width:1280,height:800,reflow:true,profile:'sunmi-t2s-native'},
  catalog:{defaultTemplate:'large',showCode:true,showDescription:true,productOverrides:{}},
  categoryLayout:{columns:5,rows:1,showSearch:true},
  cart:{mergeMode:'same_config',showSequence:true,showImages:true,widthPercent:25,allowedWidthPercents:[25,30,32]},
  quickDrinks:{
    mode:'custom',visible:true,showImages:true,quickAssist:true,
    widthRatioToLargeCard:0.6667,heightPx:64,
    order:['iced-lemon-tea','taiwan-milk-tea','iced-lemon-water','cola','genmaicha','puer','limited-tea','sparkling-water','wintermelon-lemon','americano','latte']
  }
};
