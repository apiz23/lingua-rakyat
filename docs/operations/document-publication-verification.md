# Document upload and publication verification

Review date: 2026-11-08. Local sample files only. No remote application records, storage or vectors inspected or changed. No approval/publication performed.

## Supported flow and production blockers

The current ingestion UI supports official-source discovery, not a local PDF file picker. The legacy document upload handler calls `_require_admin_authorization()`, which unconditionally returns HTTP 503. Do not remove this guard to enable uploading. A usable direct-upload feature still requires a properly authorized ingestion implementation that creates private, pending revisions.

After legitimate test access is available:

1. `/manage/sources`: inspect official origin, allowed hosts, connector settings, usage permissions, verification evidence and freshness policy. An authorized source verifier must record the decision; a public URL alone does not establish republication rights.
2. `/manage/ingestion`: start discovery on the verified source, inspect candidates, then ingest. Inspect jobs, failures, OCR and duplicates. The separate worker must run only against an explicitly designated test environment; see OPS-01.
3. `/manage/documents/[id]`: inspect source/checksum, extraction and page citations, storage, expiry, indexing namespace, expected chunk count and vector metadata. Processing ready does not mean public.
4. Review queue or revision controls: an authorized reviewer approves, rejects or requests changes. Approval alone must not change the current published revision.
5. Publications or document detail: an authorized publisher separately publishes an eligible document. New revisions require explicit promotion; rollback is separate. Verify SQL lifecycle RPCs and grants in disposable testing first.
6. Audit: verify actor, role, decision, target, reason and timestamp. Prove anonymous retrieval/PDF access accepts only the current eligible revision and rejects private/unapproved/withdrawn content.

Signing in alone does not grant admin privileges. Existing document-manager, reviewer, publisher and super-admin permission boundaries remain authoritative. No role or authentication changes were made.

## Local sample findings

All five PDFs parsed and contained extractable text. This proves neither authenticity nor current applicability. None is recommended for immediate publication.

| File | Pages | Decision and next verification |
|---|---:|---|
| Imigresen_Pasport_FAQ.pdf | 17 | HOLD: explicitly dated 19 July 2021, including movement-control-period questions. Reacquire current Immigration guidance. |
| KWSP_eCaruman_FAQ.pdf | 7 | HOLD: older e-Caruman material; official closure notice dated 31 October 2025 directs users to employer i-Akaun. Review current applicability. |
| malaysian_passport_guidelines.pdf | 4 | HOLD: formatted summary claims official status, but original official URL, byte match and effective date are unverified. |
| MyKad_FAQ.pdf | 3 | HOLD: official-looking heading is not provenance. Compare every answer against current JPN materials and establish original source. |
| PTPTN_myWaqaf_FAQ.pdf | 4 | HOLD pending verification: official four-page FAQ candidate found with matching title and opening subject text. Full content and checksum match not established. |

Local SHA-256 fingerprints:

- Imigresen_Pasport_FAQ.pdf: `c8144fdae29b557593c59270d58653423f5ddb973284f334271170a087dc5014`
- KWSP_eCaruman_FAQ.pdf: `3c9628fabd2aec428ec0b96da64762893b073ea6f36b6347407fb4b683b28a79`
- malaysian_passport_guidelines.pdf: `af69547626e28bdafec91c049b69c2042ea87ab28d027fb724837e025ec4731a`
- MyKad_FAQ.pdf: `332b2ed75a02455003ca72e58c9f3de92c3d85487f28f3733cfbf18c2de76437`
- PTPTN_myWaqaf_FAQ.pdf: `64e9b2efcda49747ae6dcfa27d6ac1b01972b597ad5229bd49b09ae6490e6f90`

## Official sources located

- [JPN identity-card FAQ](https://www.jpn.gov.my/soalan-lazim/slkadpengenalan/)
- [Immigration FAQ](https://www.imi.gov.my/index.php/hubungi-kami-2/soalan-lazim-2/)
- [KWSP e-Caruman closure notice](https://www.kwsp.gov.my/ms/w/penutupan-aplikasi-e-caruman)
- [Older official English e-Caruman FAQ](https://secure.kwsp.gov.my/e-caruman/download/SOALAN_LAZIM_e-Caruman_EN_as_at_19052017.pdf)
- [Official PTPTN FAQ candidate](https://www.ptptn.gov.my/wp-content/uploads/2024/12/FINAL-SOALAN-LAZIM-FAQ-MYWAQAFPTPTN-_kemaskini-9-dis.pdf)

The PTPTN PDF was readable through web lookup. Direct downloads for PTPTN/KWSP checksum comparisons returned HTTPError, so no byte-identical claim is made. Immigration/JPN local-to-current-source correspondence was not exhaustively checked. No automatic source verification decision was recorded.

## Verification record required for each stored revision

Record original official URL, retrieval timestamp, publisher, effective date, replacement status, usage permission/evidence, checksum, source-verifier identity/date, freshness and expiry; extraction/OCR quality and sampled page citations; isolated namespace, expected/observed vector count, fetched document/revision/source metadata; reviewer decision and publisher decision separately. Samples do not establish every vector's correctness. Do not approve payment, eligibility or legal guidance solely from an old filename or title.

## Before production

Merging this branch does not verify or install production configuration. Authenticated QA remains blocked by no test account/session, and the configured remote Supabase environment is not confirmed disposable. Production readiness still needs verified migrations/RPCs/grants, private storage/RLS, real role enforcement, end-to-end ingestion and public eligibility checks in a test environment, plus reconciliation of every remote document with its verification record. Legacy backfill is not approval/publication. OPS-01's lease, external fencing, discovery deduplication and parser-isolation limitations remain.

Only this report was added. No executable source changed; regression tests were not rerun. Previous OPS-01 result was 578 passing tests, not live-production evidence. No commit, push, merge, deployment, migration or production mutation.
