import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProductConfigWorkspace} from '../features/ordering/OrderingCenterWorkspaces.tsx';
import {ActionFeedback,EmptyState,GuidedProgress} from './SmtUi.tsx';

describe('SMT human-centered guided UI',()=>{
  it('shows only the current product decision and keeps later decisions hidden',()=>{
    const html=renderToStaticMarkup(<ProductConfigWorkspace
      product={{
        id:'meal',category:'便當',name:'測試便當',priceMinor:5000,priceLabel:'$50.00',
        optionSets:[
          {id:'size',name:'份量',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'large',name:'大份',priceAdjustmentMinor:500,defaultSelected:false,active:true},
          ]},
          {id:'spice',name:'辣度',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'hot',name:'大辣',priceAdjustmentMinor:0,defaultSelected:false,active:true},
          ]},
        ],
      }}
      onAdd={()=>undefined}
    />);

    expect(html).toContain('而家請完成');
    expect(html).toContain('份量');
    expect(html).toContain('大份');
    expect(html).toContain('繼續：辣度');
    expect(html).not.toContain('大辣');
    expect(html).not.toContain('加入購物籃');
  });

  it('exposes progress and feedback with readable status semantics',()=>{
    const html=renderToStaticMarkup(<>
      <GuidedProgress current={2} total={4} label="付款方式"/>
      <ActionFeedback tone="warning" title="正在確認" detail="請勿重複操作。"/>
      <EmptyState icon="✓" title="目前冇工作" detail="新工作會顯示喺呢度。"/>
    </>);

    expect(html).toContain('第 2 步，共 4 步：付款方式');
    expect(html).toContain('role="status"');
    expect(html).toContain('請勿重複操作');
    expect(html).toContain('目前冇工作');
  });
});
