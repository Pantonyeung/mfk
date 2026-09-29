export function createSingleFlightRefresh(run){
  let inFlight=null;
  let trailingRequested=false;
  let runningTrailing=false;

  return function refresh(){
    if(inFlight){
      if(!runningTrailing)trailingRequested=true;
      return inFlight;
    }

    inFlight=(async()=>{
      await run();
      if(trailingRequested){
        trailingRequested=false;
        runningTrailing=true;
        await run();
      }
    })().finally(()=>{
      inFlight=null;
      trailingRequested=false;
      runningTrailing=false;
    });
    return inFlight;
  };
}
