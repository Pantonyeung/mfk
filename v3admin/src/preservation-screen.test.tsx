import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {V3PreservationScreen} from './preservation-screen.tsx';

describe('V3 preservation-only UI',()=>{
  it('mounts only read-only business extraction and signout, without editor or publish controls',()=>{
    const prepare=vi.fn();
    const html=renderToStaticMarkup(<V3PreservationScreen storeId="MF01" sourceKey="synthetic" releaseStatus={<div>Version</div>} prepare={prepare} onSignOut={()=>{}}/>);
    expect(html).toContain('V3 保全模式');expect(html).toContain('準備商業設定擷取');expect(html).toContain('尚未完成檔案核對');
    expect(html).not.toContain('儲存正式草稿');expect(html).not.toContain('確認發佈');expect(html).not.toContain('新增商品');
    expect(prepare).not.toHaveBeenCalled();
  });
});
