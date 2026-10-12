/** Resolve all static debug imports to an inert module outside explicit staging QA. */
export function punchiesDebugGate(staging: boolean, qa: boolean) {
  return {
    name: 'punchies-production-debug-exclusion',
    enforce: 'pre' as const,
    resolveId(id: string, importer?: string) {
      if (staging && qa) return;
      const source = importer?.replace(/\\/g, '/');
      if (source?.includes('/prototypes/punchies/') && /(?:^|\/)debug\/debugPanel(?:\.ts)?$/.test(id)) {
        return source.slice(0, source.indexOf('/prototypes/punchies/')) + '/prototypes/punchies/src/debug/debugDisabled.ts';
      }
    },
  };
}
