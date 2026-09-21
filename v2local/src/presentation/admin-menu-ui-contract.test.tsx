import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {ActiveMenuProductName} from '../features/ordering/OrderingWorkspace.tsx';
import {AdminMenuPublishReceipt} from './LocalAdminMenuWorkspace.tsx';

describe('Admin Menu physical acceptance UI contracts',()=>{
  it('shows the complete Active Menu product name on the POS tile',()=>{
    const html=renderToStaticMarkup(<ActiveMenuProductName name="原味飯團ttttt"/>);
    expect(html).toContain('data-active-menu-product-name="原味飯團ttttt"');
    expect(html).toContain('>原味飯團ttttt</span>');
  });

  it('shows an unmistakable publish success receipt with Active revision',()=>{
    const html=renderToStaticMarkup(
      <AdminMenuPublishReceipt receipt={{revision:17,publishedAt:'2026-09-21T10:00:00.000Z'}}/>,
    );
    expect(html).toContain('已發布到 POS');
    expect(html).toContain('Active Menu R17');
    expect(html).toContain('發布時間');
  });
});
