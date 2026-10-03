import React,{useState} from 'react';
// @ts-expect-error Existing test-only renderer dependency has no installed declarations.
import {act,create} from 'react-test-renderer';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {FormalProductNavigationContext,useFormalProductNavigationBlocker,useFormalProductNavigationOwner} from './formal-product-navigation.tsx';

const mounted:any[]=[];
afterEach(async()=>{for(const tree of mounted.splice(0))await act(async()=>tree.unmount());vi.unstubAllGlobals();});
function browser(queued=false){
  const target=new EventTarget(),entries:{url:string;state:any}[]=[{url:'https://fixture.invalid/admin/before#old',state:{foreign:'keep'}},{url:'https://fixture.invalid/admin/catalog/products#list',state:{foreign:'keep-current'}}];let index=1;const tasks:(()=>void)[]=[];
  const location={get href(){return entries[index].url;},get pathname(){return new URL(entries[index].url).pathname;}};
  const history={get state(){return entries[index].state;},get length(){return entries.length;},get index(){return index;},
    pushState(state:any,_unused:string,url:string){entries.splice(index+1);entries.push({state,url:new URL(url,location.href).href});index++;},
    replaceState(state:any,_unused:string,url:string){entries[index]={state,url:new URL(url,location.href).href};},
    go(delta:number){const next=index+delta;if(next<0||next>=entries.length)return;const run=()=>{index=next;target.dispatchEvent(new Event('popstate'));};if(queued)tasks.push(run);else run();},
    back(){this.go(-1);},forward(){this.go(1);},
  };
  vi.stubGlobal('window',{location,history,addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target)});return {history,location,target,entries,flush:()=>tasks.shift()?.(),get queued(){return tasks.length;}};
}
async function setup(strict=false,queued=false){
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const b=browser(queued);let owner!:ReturnType<typeof useFormalProductNavigationOwner>,path='/admin/catalog/products',blocked=false;const requests:{proceed:()=>void;notice:string}[]=[];
  function Editor(){useFormalProductNavigationBlocker({blocked:()=>blocked,requestLeave:(proceed,notice)=>requests.push({proceed,notice})});return null;}
  function App(){const [current,setCurrent]=useState(path);path=current;owner=useFormalProductNavigationOwner(false,setCurrent);return <FormalProductNavigationContext.Provider value={owner.register}><Editor/></FormalProductNavigationContext.Provider>;}
  let tree:any;await act(async()=>{tree=create(strict?<React.StrictMode><App/></React.StrictMode>:<App/>);});mounted.push(tree);
  return {b,tree,requests,get owner(){return owner;},get path(){return path;},set blocked(v:boolean){blocked=v;}};
}

describe('product-specific navigation ownership',()=>{
  it('does not push extra entries on mount/StrictMode and preserves foreign state keys',async()=>{
    const s=await setup(true);expect(s.b.history.length).toBe(2);expect(s.b.history.index).toBe(1);expect(s.b.history.state.foreign).toBe('keep-current');
  });
  it('defers internal navigation until explicit discard without changing history on Stay',async()=>{
    const s=await setup();s.blocked=true;await act(async()=>s.owner.navigate('/admin/catalog/pricing'));
    expect(s.path).toBe('/admin/catalog/products');expect(s.b.history.length).toBe(2);expect(s.requests).toHaveLength(1);
    await act(async()=>s.owner.navigate('/admin/catalog/categories'));expect(s.requests).toHaveLength(2);
    s.blocked=false;await act(async()=>s.requests[1].proceed());expect(s.path).toBe('/admin/catalog/categories');expect(s.b.history.length).toBe(3);
  });
  it('restores owned multi-entry Back, then replays the exact destination after discard',async()=>{
    const s=await setup();await act(async()=>s.owner.navigate('/admin/catalog/pricing'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    await act(async()=>s.b.history.go(-2));expect(s.b.history.index).toBe(3);expect(s.path).toBe('/admin/catalog/products');expect(s.requests).toHaveLength(1);expect(s.requests[0].notice).toBe('');
    s.blocked=false;await act(async()=>s.requests[0].proceed());expect(s.b.history.index).toBe(1);expect(s.b.location.href).toContain('/products#list');expect(s.path).toBe('/admin/catalog/products');expect(s.b.history.length).toBe(4);
  });
  it('repeated Back/Stay and Forward preserve original history and route destinations',async()=>{
    const s=await setup();await act(async()=>s.owner.navigate('/admin/catalog/categories'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    for(let n=0;n<3;n++){await act(async()=>s.b.history.back());expect(s.b.history.index).toBe(3);expect(s.b.history.length).toBe(4);}
    s.blocked=false;await act(async()=>s.requests.at(-1)!.proceed());expect(s.path).toBe('/admin/catalog/categories');expect(s.b.history.index).toBe(2);
    s.blocked=true;await act(async()=>s.b.history.forward());expect(s.b.history.index).toBe(2);expect(s.path).toBe('/admin/catalog/categories');
    s.blocked=false;await act(async()=>s.requests.at(-1)!.proceed());expect(s.path).toBe('/admin/catalog/products');expect(s.b.history.index).toBe(3);
  });
  it('unknown history keeps the mounted editor and visibly reports its limit without overwriting foreign state',async()=>{
    const s=await setup();s.blocked=true;await act(async()=>s.b.history.back());expect(s.path).toBe('/admin/catalog/products');expect(s.b.history.state).toEqual({foreign:'keep'});expect(s.b.history.index).toBe(0);
    expect(s.requests[0].notice).toContain('瀏覽器歷史');expect(s.requests[0].notice).toContain('保留');
    s.blocked=false;await act(async()=>s.requests[0].proceed());expect(s.path).toBe('/admin/before');expect(s.b.history.state).toEqual({foreign:'keep'});
  });
  it('a pending replay never overrides a newer browser destination',async()=>{
    const s=await setup();await act(async()=>s.owner.navigate('/admin/catalog/categories'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    await act(async()=>s.b.history.back());const stale=s.requests[0];await act(async()=>s.b.history.go(-2));const latest=s.requests[1];
    s.blocked=false;await act(async()=>stale.proceed());expect(s.b.history.index).toBe(3);
    await act(async()=>latest.proceed());expect(s.b.history.index).toBe(1);
  });
  it('unmount removes handlers and never consumes history entries',async()=>{
    const s=await setup();s.blocked=true;await act(async()=>s.tree.unmount());s.b.history.back();expect(s.requests).toHaveLength(0);expect(s.b.history.index).toBe(0);
  });
});


describe('queued history traversal interleaving',()=>{
  it('keeps the newer internal destination when an obsolete Back restore arrives',async()=>{
    const s=await setup(false,true);await act(async()=>s.owner.navigate('/admin/catalog/categories'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    await act(async()=>{s.b.history.back();s.b.flush();});expect(s.b.history.index).toBe(2);expect(s.b.queued).toBe(1);
    await act(async()=>s.owner.navigate('/admin/catalog/pricing'));expect(s.requests).toHaveLength(1);
    await act(async()=>s.b.flush());expect(s.b.history.index).toBe(3);expect(s.requests).toHaveLength(1);
    s.blocked=false;await act(async()=>s.requests[0].proceed());expect(s.path).toBe('/admin/catalog/pricing');
  });
  it('round-trips queued Back and Forward with explicit choices and no extra entries',async()=>{
    const s=await setup(false,true);await act(async()=>s.owner.navigate('/admin/catalog/categories'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    await act(async()=>{s.b.history.back();s.b.flush();});expect(s.requests).toHaveLength(0);
    await act(async()=>s.b.flush());expect(s.requests).toHaveLength(1);expect(s.b.history.index).toBe(3);
    s.blocked=false;await act(async()=>{s.requests[0].proceed();s.b.flush();});expect(s.path).toBe('/admin/catalog/categories');
    s.blocked=true;await act(async()=>{s.b.history.forward();s.b.flush();s.b.flush();});expect(s.requests).toHaveLength(2);expect(s.b.history.index).toBe(2);
    s.blocked=false;await act(async()=>{s.requests[1].proceed();s.b.flush();});expect(s.path).toBe('/admin/catalog/products');expect(s.b.history.length).toBe(4);
  });
});

describe('superseded replay completion',()=>{
  it('restores a newer internal destination after an obsolete queued replay lands',async()=>{
    const s=await setup(false,true);await act(async()=>s.owner.navigate('/admin/catalog/categories'));await act(async()=>s.owner.navigate('/admin/catalog/products'));s.blocked=true;
    await act(async()=>{s.b.history.back();s.b.flush();s.b.flush();});
    s.blocked=false;await act(async()=>s.requests[0].proceed());expect(s.b.queued).toBe(1);
    await act(async()=>s.owner.navigate('/admin/catalog/pricing'));expect(s.path).toBe('/admin/catalog/pricing');
    await act(async()=>s.b.flush());expect(s.path).toBe('/admin/catalog/pricing');
    await act(async()=>s.b.flush());expect(s.b.location.href).toContain('/admin/catalog/pricing');expect(s.path).toBe('/admin/catalog/pricing');
  });
});
