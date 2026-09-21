import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {ProductCardText} from '../features/ordering/OrderingWorkspace.tsx';
import {AdminMenuPublishReceipt} from './LocalAdminMenuWorkspace.tsx';

describe('Admin Menu physical acceptance UI contracts',()=>{
  it('renders the POS product card as full text with name and price',()=>{
    const html=renderToStaticMarkup(<ProductCardText name="古早味紫米飯糰" priceLabel="$41.00"/>);
    expect(html).toContain('data-active-menu-product-name="古早味紫米飯糰"');
    expect(html).toContain('>古早味紫米飯糰</b>');
    expect(html).toContain('>$41.00</strong>');
    expect(html).not.toContain('<img');
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
