import {describe,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {V3FormalDraftProvider,v3FormalDraftQueryKey} from './formal-draft.tsx';
import {FormalPublishPage} from './formal-publish-pages.tsx';
import {renderToStaticMarkup} from 'react-dom/server';
import {PosTendersWorkspace} from './formal-pos-tenders-page.tsx';
import {createInitialFormalPosTenders} from './formal-pos-tenders.ts';
import {AdminShell} from './admin-shell.tsx';
import {destinationForPath} from './navigation.ts';

describe('POS tender configuration UI',()=>{
  it('leaves missing policy missing until an explicit template and save action',()=>{
    const mutate=vi.fn();
    const html=renderToStaticMarkup(<PosTendersWorkspace snapshot={{}} busy={false} onSave={mutate}/>);
    expect(html).toContain('POS 收款方式');
    expect(html).toContain('建立初始五項草稿');
    expect(html).toContain('缺少 POS 收款政策');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows enabled/disabled source rows and native evidence semantics without collecting payments',()=>{
    const snapshot=createInitialFormalPosTenders({});
    const html=renderToStaticMarkup(<PosTendersWorkspace snapshot={snapshot} busy={false} onSave={vi.fn()}/>);
    for(const label of ['現金','支付寶','微信支付','FPS','Payme','CASH_COUNTED','STAFF_CONFIRMED'])expect(html).toContain(label);
    expect(html).toContain('停用會保留 ID 與歷史收款記錄');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('確認收款');
    expect(html).not.toContain('type="password"');
  });

  it('blocks malformed existing policy without an initialization overwrite',()=>{
    const html=renderToStaticMarkup(<PosTendersWorkspace snapshot={{posTenders:null}} busy={false} onSave={vi.fn()}/>);
    expect(html).toContain('POS_TENDER_POLICY_INVALID');
    expect(html).not.toContain('建立初始五項草稿');
  });

  it('registers a distinct formal config destination and network-free preview',()=>{
    expect(destinationForPath('/admin/store/pos-tenders').authority).toBe('config');
    const html=renderToStaticMarkup(<AdminShell storeId="PREVIEW" displayName="介面驗收" releaseStatus={null} canonicalState="fresh" previewMode initialPath="/admin/store/pos-tenders" onRefresh={()=>{}} onDiagnostics={()=>{}} onSignOut={()=>{}}/>);
    expect(html).toContain('POS 收款方式');
    expect(html).toContain('只保留於本頁記憶體');
    expect(html).not.toContain('尚未接駁');
  });
  it('offers in-app recovery from publish preflight without a session-destroying navigation',()=>{
    const snapshot={catalog:{products:[]}},client=new QueryClient();
    const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'a1',snapshot});
    client.setQueryData(v3FormalDraftQueryKey('MF01'),{schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:1,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'});
    const html=renderToStaticMarkup(<QueryClientProvider client={client}><V3FormalDraftProvider canonical={canonical} storeId="MF01" sessionToken="test"><FormalPublishPage onNavigate={vi.fn()}/></V3FormalDraftProvider></QueryClientProvider>);
    expect(html).toContain('POS_TENDER_POLICY_REQUIRED');
    expect(html).toContain('<button type="button">前往 POS 收款方式</button>');
    expect(html).not.toContain('href="/admin/store/pos-tenders"');
    client.clear();
  });

});
