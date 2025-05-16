let extractedSentences = [];
let githubInfo = {
  username: '',
  repo: '',
  branch: 'main',
  filePath: 'wfd.json'
};

document.getElementById('parseBtn').onclick = async function() {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) {
    showStatus('PDF 파일을 선택하세요!');
    return;
  }
  showStatus('PDF 분석 중...');
  extractedSentences = [];
  const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
  let allText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const txt = await page.getTextContent();
    allText += txt.items.map(t => t.str).join('\n') + '\n';
  }
  console.log('PDF 추출 전체:', allText);

  // 1) 줄별 영어문장 추출 (번호+마침표+공백 옵션 허용, 다양한 작은따옴표 포함)
  const lines = allText.split('\n');
  const englishSentencePattern = /^(\d+\.)?\s*[A-Z][A-Za-z0-9 ,.'’‘"\-?!:;“”—–…%()$@&[\]/\\]+[.?!]$/;
  const sentences = lines
    .map(s => s.trim())
    .filter(s => s.length > 7 && englishSentencePattern.test(s));
  // 앞 번호(예: "47.")는 제거하고 영어문장만 남기기
  const cleaned = sentences.map(s => s.replace(/^(\d+\.)\s*/, ''));
  extractedSentences = [...new Set(cleaned)];

  console.log('최종 분리된 문장:', extractedSentences.length, extractedSentences);

  preview();
};
