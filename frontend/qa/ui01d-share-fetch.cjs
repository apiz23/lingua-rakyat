// Test-process-only SSR fixture. Never imported by application code.
if (process.env.UI01D_SHARE_FIXTURE === '1') {
 const originalFetch = globalThis.fetch;
 globalThis.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).pathname === '/api/v1/public/shares/qa-smoke' && (!init?.method || init.method === 'GET')) {
   return Response.json({ slug:'qa-smoke', question:'Eligibility?', answer:'Check the published guidance.', sources:[], language:'en', created_at:'2026-11-07T00:00:00Z', confidence:.9, confidence_label:'high', agency:'Test fixture', evidence_linked:false });
  }
  return originalFetch.call(this, input, init);
 };
}
