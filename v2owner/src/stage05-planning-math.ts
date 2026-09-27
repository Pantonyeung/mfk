export interface OwnerTargetProgressInput{
  readonly businessDate:string;
  readonly mtdAvailable:boolean;
  readonly mtdMinor:number;
  readonly targetMinor:number|null;
}

export interface OwnerTargetProgressResult{
  readonly remainingMinor:number|null;
  readonly attainmentPct:number|null;
  readonly dailyNeededMinor:number|null;
  readonly projectedTargetDate:string|null;
}

function addCalendarDays(date:string,days:number){
  const [year,month,day]=date.split('-').map(Number);
  const at=new Date(Date.UTC(year,month-1,day+days));
  return at.toISOString().slice(0,10);
}

export function calculateOwnerTargetProgress(input:OwnerTargetProgressInput):OwnerTargetProgressResult{
  const [,monthPart,dayPart]=input.businessDate.split('-').map(Number);
  const year=Number(input.businessDate.slice(0,4));
  const daysInMonth=new Date(Date.UTC(year,monthPart,0)).getUTCDate();
  const elapsedDays=Math.max(1,dayPart);
  const remainingDaysInclusive=Math.max(1,daysInMonth-dayPart+1);
  const remainingMinor=input.targetMinor!==null&&input.mtdAvailable
    ?Math.max(0,input.targetMinor-input.mtdMinor)
    :null;
  const attainmentPct=input.targetMinor!==null&&input.targetMinor>0&&input.mtdAvailable
    ?input.mtdMinor/input.targetMinor*100
    :null;
  const dailyNeededMinor=remainingMinor===null
    ?null
    :remainingMinor===0
      ?0
      :Math.ceil(remainingMinor/remainingDaysInclusive);
  const averageDailyMinor=input.mtdAvailable&&elapsedDays>0?input.mtdMinor/elapsedDays:0;
  const projectedDays=remainingMinor!==null&&remainingMinor>0&&averageDailyMinor>0
    ?Math.ceil(remainingMinor/averageDailyMinor)
    :0;
  const projectedTargetDate=remainingMinor===0&&input.targetMinor!==null
    ?input.businessDate
    :projectedDays>0
      ?addCalendarDays(input.businessDate,projectedDays)
      :null;
  return Object.freeze({remainingMinor,attainmentPct,dailyNeededMinor,projectedTargetDate});
}

export function calculateOwnerCostTotals(input:readonly {plannedMinor:number|null;actualToDateMinor:number|null}[]){
  const plannedCostMinor=input.reduce((sum,row)=>sum+(row.plannedMinor??0),0);
  const actualRows=input.filter(row=>row.actualToDateMinor!==null);
  const actualCostMinor=actualRows.reduce((sum,row)=>sum+(row.actualToDateMinor??0),0);
  return Object.freeze({
    plannedCostMinor,
    actualCostMinor,
    actualCostFilled:actualRows.length,
    actualCostTotal:input.length,
    actualCostComplete:actualRows.length===input.length,
  });
}
