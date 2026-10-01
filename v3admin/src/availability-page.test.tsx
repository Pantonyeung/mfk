import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AvailabilityPage} from './availability-page.tsx';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {MOBILE_PRODUCT_PAGE_SIZE} from './product-list.tsx';

describe('Admin V3 Availability mobile grammar',()=>{
  it('uses the same 10-item grouped mobile grammar as Product Management',()=>{
    expect(MOBILE_PRODUCT_PAGE_SIZE).toBe(10);
    const items=Array.from({length:12},(_,index)=>({id:'a-'+index,group:'飯糰',name:'商品 '+index}));
    const grouped=renderToStaticMarkup(<MobileGroupedPager
      items={items}
      pageSize={MOBILE_PRODUCT_PAGE_SIZE}
      renderItem={item=><div>{item.name}</div>}
    />);
    expect(grouped).toContain('12 項');
    expect(grouped).toContain('第 1 / 2 頁');

    const html=renderToStaticMarkup(<AvailabilityPage previewMode/>);
    expect(html).toContain('售罄／供應');
    expect(html).toContain('v3-product-mobile-groups');
    expect(html).toContain('飯糰');
  });

  it('keeps preview sellability changes explicitly non-production',()=>{
    const html=renderToStaticMarkup(<AvailabilityPage previewMode/>);
    expect(html).toContain('所有改動只係介面預覽');
    expect(html).not.toContain('admin.morefunos.com');
  });
});
