let extractedSentences = [];
let githubInfo = {
  username: '', // 네 깃허브 아이디
  repo: '',     // 저장소 이름
  branch: 'main', // 브랜치 (main/master)
  filePath: 'wfd.json' // 저장할 파일명
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

  // 줄별 영어문장 추출
  // 번호+마침표+공백 옵션 허용, 다양한 작은따옴표 포함 (ASCII ', ‘ ’ ′)
  const lines = allText.split('\n');
  const englishSentencePattern = /^(\#?\d+\.?)?\s*[A-Z][A-Za-z0-9\s.,'"‘’′\-#?!;“”—%()$@\[\]/]+[.?!]$/;


  // 조건에 맞는 문장 필터링 및 공백 제거
   const sentences = lines
    .map(s => s.trim())
    .filter(s => s.length > 7 && englishSentencePattern.test(s));

  // 문장 번호(예: '1. ') 제거
  const cleaned = sentences.map(s => s.replace(/^(\d+\.)\s*/, ''));

  // 중복 제거
  extractedSentences = [...new Set(cleaned)];

  console.log('최종 분리된 문장:', extractedSentences.length, extractedSentences);

  preview();
};

function preview() {
  document.getElementById('preview').innerHTML =
    `<b>문장 개수: ${extractedSentences.length}</b><br><br>` +
    extractedSentences.map((s,i)=>`<div>${i+1}. ${s}</div>`).join('');
  document.getElementById('downloadBtn').style.display = 'inline-block';
  document.getElementById('uploadBtn').style.display = 'inline-block';
  document.getElementById('tokenInput').style.display = 'inline-block';
}

document.getElementById('downloadBtn').onclick = function() {
  const blob = new Blob([JSON.stringify(extractedSentences, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wfd.json';
  a.click(); URL.revokeObjectURL(url);
};

document.getElementById('uploadBtn').onclick = async function() {
  const token = document.getElementById('tokenInput').value.trim();
  if (!token) return showStatus('GitHub 토큰을 입력하세요!');
  if (!githubInfo.username || !githubInfo.repo) {
    githubInfo.username = prompt('깃허브 아이디?');
    githubInfo.repo = prompt('저장소 이름?');
  }
  showStatus('GitHub에 업로드 중...');
  let sha = '';
  try {
    const r = await fetch(`https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`);
    if (r.ok) sha = (await r.json()).sha;
  } catch {}
  const res = await fetch(`https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'WFD 문제 자동 업로드',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(extractedSentences,null,2)))),
      sha
    })
  });
  if (res.ok) showStatus('✅ GitHub 업로드 성공!');
  else showStatus('❌ 업로드 실패: ' + (await res.text()));
};

function showStatus(msg) {
  document.getElementById('status').textContent = msg;
}
