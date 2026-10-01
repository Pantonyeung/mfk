import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {ADMIN_DESTINATIONS} from './navigation.ts';

describe('Admin V3 full preview route implementation',()=>{
  it('routes all 54 current Admin destinations away from generic placeholder workspaces',()=>{
    expect(ADMIN_DESTINATIONS).toHaveLength(54);
    const generic:string[]=[];
    const disconnected:string[]=[];
    for(const destination of ADMIN_DESTINATIONS){
      const html=renderToStaticMarkup(<AdminShell
        storeId="PREVIEW"
        displayName="介面驗收"
        releaseStatus={<div>UI</div>}
        canonicalState="fresh"
        previewMode
        initialPath={destination.path}
        onRefresh={()=>{}}
        onDiagnostics={()=>{}}
        onSignOut={()=>{}}
      />);
      if(html.includes('Admin V3 全域公網實作'))generic.push(destination.path);
      if(html.includes('尚未接駁'))disconnected.push(destination.path);
    }
    expect(generic).toEqual([]);
    expect(disconnected).toEqual([]);
  });
});
