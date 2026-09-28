import {describe,expect,it} from 'vitest';
import {buildWhatsAppPaymentFollowup,normalizeWhatsAppPhone,paymentFollowupMessage} from './payment-evidence-whatsapp.ts';

describe('payment evidence WhatsApp follow-up',()=>{
  it('normalizes Hong Kong local phone numbers without exposing transport authority',()=>{
    expect(normalizeWhatsAppPhone('9123 4567')).toBe('85291234567');
    expect(normalizeWhatsAppPhone('+852 9123 4567')).toBe('85291234567');
    expect(normalizeWhatsAppPhone('123')).toBeNull();
  });

  it('builds a prefilled WhatsApp link for an unclear payment screenshot',()=>{
    const result=buildWhatsAppPaymentFollowup({
      phone:'91234567',
      display:'#P033',
      totalLabel:'$100.00',
      templateId:'UNCLEAR',
    });
    expect(result.url).toContain('https://wa.me/85291234567?text=');
    expect(decodeURIComponent(result.url.split('?text=')[1]||'')).toContain('付款截圖比較模糊');
    expect(result.message).toContain('#P033');
  });

  it('keeps resend templates specific to payment evidence follow-up',()=>{
    expect(paymentFollowupMessage({display:'P034',totalLabel:'$88.00',templateId:'AMOUNT_MISMATCH'})).toContain('$88.00');
    expect(paymentFollowupMessage({display:'P034',totalLabel:'$88.00',templateId:'DETAIL_MISSING'})).toContain('付款金額、付款時間同交易資料');
  });
});
