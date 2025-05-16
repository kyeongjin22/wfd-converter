/* ---------- script.js (번호 제거 포함 완성) ---------- */
let extractedSentences = [];
const githubInfo = { username: '', repo: '', branch: 'main', filePath: 'wfd.json' };

document.getElementById('parseBtn').onclick = async () => {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) return showStatus('PDF 파일을 선택하세요!');
  showStatus('PDF 분석 중…');

  /* 1. PDF → 텍스트 */
  const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
  let raw = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const txt  = await page.getTextContent();
    raw += txt.items.map(t => t.str).join('\n') + '\n';
  }

  /* 2. 문자 통일 */
  raw = raw
    .replace(/[\u2018\u2019\u02BB\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\r\n|\r/g, '\n');

  /* 3. 줄 합치기 */
  const merged = [];
  for (const lineRaw of raw.split('\n')) {
    const line = lineRaw.trim();
    if (!line) continue;
    const prev = merged[merged.length - 1] || '';
    const needMerge = merged.length && !/[.!?]$/.test(prev) && /^[a-z'’]/.test(line);
    needMerge ? merged[merged.length - 1] += ' ' + line : merged.push(line);
  }

  /* 4. 필터 조건 */
  const hasCJK = /[\u4E00-\u9FFF]/;
  const isSentence = s =>
    s.length >= 10 &&
    /[A-Za-z]/.test(s) &&
    !hasCJK.test(s) &&
    !/WRITE FROM DICTATION/i.test(s);

  /* 5. 한 줄 → 여러 문장 분리 + 마침표 보강 */
  const pieces = merged.flatMap(l => {
    const line = /[.!?]$/.test(l) ? l : l + '.';
    return line.split(/(?<=[.!?])\s+(?=[A-Z])/);
  });

  /* 6. 다듬기 + 중복 제거 + 번호 삭제 */
  extractedSentences = [...new Set(
    pieces
      .map(s =>
        s
          .replace(/^["'(]+|["')]+$/g, '')       // 양쪽 특수문자
          .replace(/^\d+\s*[\.)]?\s*/, '')       // ★ 앞 번호/점/괄호
          .trim()
      )
      .filter(isSentence)
  )];

  preview();
};

/* ----------- preview / download / upload / showStatus 그대로 ----------- */
function preview() {
  document.getElementById('preview').innerHTML =
    `<b>문장 개수: ${extractedSentences.length}</b><br><br>` +
    extractedSentences.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');
  ['downloadBtn', 'uploadBtn', 'tokenInput']
    .forEach(id => document.getElementById(id).style.display = 'inline-block');
}

document.getElementById('downloadBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(extractedSentences, null, 2)],
                       { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'wfd.json' }).click();
  URL.revokeObjectURL(url);
};

document.getElementById('uploadBtn').onclick = async () => {
  const token = document.getElementById('tokenInput').value.trim();
  if (!token) return showStatus('GitHub 토큰을 입력하세요!');
  if (!githubInfo.username || !githubInfo.repo) {
    githubInfo.username = prompt('깃허브 아이디?');
    githubInfo.repo    = prompt('저장소 이름?');
  }
  showStatus('GitHub에 업로드 중…');

  let sha = '';
  try {
    const r = await fetch(
      `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`);
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  const res = await fetch(
    `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo
