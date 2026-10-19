import { renderPdf, validatePdfSource } from './pdf-renderer';

describe('PDF rendering and pagination', () => {
  it('keeps a short Korean document on one page including the footer', async () => {
    const content = validatePdfSource({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '한글 본문과 저장된 문서' }],
        },
      ],
    });
    const buffer = await renderPdf('한글 제목', content, new Map(), 'ko-KR');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
  it('starts each selected Korean document on a separate page with one global footer sequence', async () => {
    const content = validatePdfSource({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '문서 본문' }] }] });
    const buffer = await renderPdf('부모 문서', content, new Map(), 'ko-KR', [{ title: '첫 하위 문서', content }, { title: '다음 하위 문서', content }]);
    expect(buffer.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(3);
  });
});

describe('Independent document data blocks in PDF', () => {
  it('exports a database as a table and tabs as readable content', async () => {
    const content = validatePdfSource({ type: 'doc', content: [
      { type: 'personalDatabase', attrs: { title: '한글 업무' }, content: [{ type: 'personalDatabaseRow', attrs: { id: 'row', title: '완료 작업', status: 'done', number: 12 } }] },
      { type: 'personalTabs', content: [{ type: 'personalTab', attrs: { title: '회의 메모' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '탭의 본문' }] }] }] },
    ] });
    const pdf = await renderPdf('새 블록 검증', content, new Map(), 'ko-KR');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
  it('counts widget and record attribute text toward the PDF size limit', () => {
    expect(() => validatePdfSource({ type: 'doc', content: [{ type: 'personalWidget', attrs: { value: 'x'.repeat(2_000_001) } }] })).toThrow();
  });
});
