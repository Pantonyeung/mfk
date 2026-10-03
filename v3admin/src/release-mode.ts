/** Demo mode is chosen only by the build, never by a canonical URL query. */
export function v3AdminPreviewRequested(buildPreview:string|undefined,_search:string=''){
  return buildPreview==='1';
}

/** Full configuration acceptance requires an explicit reviewed build. */
export function v3AdminConfigurationWritesEnabled(value:string|undefined){return value==='1';}
