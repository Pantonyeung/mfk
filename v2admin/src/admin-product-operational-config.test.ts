import {describe,expect,it} from 'vitest';
import {
  DEFAULT_PRODUCT_PRINT_RULE,
  PRODUCT_MEDIA_BACKEND_CONTRACT,
  normalizeProductMedia,
  normalizeProductPrintRule,
} from './admin-product-operational-config.ts';

describe('Admin product operational config',()=>{
  it('keeps complete product print defaults including dine-in and takeaway',()=>{
    expect(DEFAULT_PRODUCT_PRINT_RULE).toMatchObject({
      receipt:true,
      production:true,
      packing:true,
      label:false,
      dineIn:true,
      takeaway:true,
    });
    expect(normalizeProductPrintRule({label:true,dineIn:false,takeaway:true,labelPrinterIds:['logical-riceball-label']})).toEqual({
      receipt:true,
      production:true,
      packing:true,
      label:true,
      dineIn:false,
      takeaway:true,
      labelPrinterIds:['logical-riceball-label'],
    });
  });

  it('keeps canonical media and Keeta override distinct',()=>{
    const value=normalizeProductMedia({
      canonicalImageRef:'https://cdn.example/main.webp',
      keetaImageUrl:'https://provider.example/keeta.webp',
      storageState:'REFERENCE_ONLY',
    });
    expect(value.canonicalImageRef).toBe('https://cdn.example/main.webp');
    expect(value.publicUrl).toBe('https://cdn.example/main.webp');
    expect(value.keetaImageUrl).toBe('https://provider.example/keeta.webp');
    expect(value.storageState).toBe('REFERENCE_ONLY');
  });

  it('locks the MFK-native media contract without pretending it is wired',()=>{
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.binaryStore).toBe('MFK_R2_PRODUCT_MEDIA');
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.metadataProjection).toBe('MFK_D1_PRODUCT_MEDIA');
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.canonicalProductField).toBe('imageRef');
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.browserDirectR2Credentials).toBe(false);
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.maxBytes).toBe(8*1024*1024);
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.currentExecution).toBe('NOT_WIRED');
  });
});
