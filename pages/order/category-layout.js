const allowedColumns=new Set([5,6,7]);
const allowedRows=new Set([1,2]);

export function normalizeCategoryLayout(value={}){
  const columns=allowedColumns.has(Number(value?.columns))?Number(value.columns):5;
  const rows=allowedRows.has(Number(value?.rows))?Number(value.rows):1;
  const showSearch=value?.showSearch===false?false:true;
  return {columns,rows,showSearch};
}

export function buildCategoryLayout(categories=[],value={}){
  const config=normalizeCategoryLayout(value);
  const list=[...new Set((Array.isArray(categories)?categories:[]).filter(Boolean).filter(name=>name!=='搜尋'))];
  const capacity=config.columns*config.rows;
  const categoryCapacity=Math.max(1,capacity);
  const primary=list.slice(0,categoryCapacity),overflow=list.slice(categoryCapacity);
  const pages=[];
  for(let index=0;index<list.length;index+=categoryCapacity)pages.push(list.slice(index,index+categoryCapacity));
  if(!pages.length)pages.push([]);
  return {...config,capacity,categoryCapacity,primary,overflow,pages,searchSlot:config.showSearch?'separate':null};
}
