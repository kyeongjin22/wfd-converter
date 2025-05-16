/* ---------- 수정된 script.js (전부) ---------- */
let extractedSentences = [];
let githubInfo = {
  username: '',
  repo: '',
  branch: 'main',
  filePath: 'wfd.json'
};

document.getElementById('parseBtn').onclick = async () => {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) return showStatus('PDF 파일을 선택하세요!');
  showStatus('PDF 분석 중…');

  extractedSentences = [];
  const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;

  // 1) PDF → text
  let allText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt = await page.getTextContent();
    allText += txt.items.map(t => t.str).join('\n') + '\n';
  }

  // 2) 전처리: 문자 통일
  allText = allText
    .replace(/[\u2018\u2019\u02BB\u02BC\u2032]/g, "'")   // ‘ ’ ‘ ꞌ → '
    .replace(/[\u201C\u201D]/g, '"')                    // “ ” → "
    .replace(/[\u2013\u2014]/g, '-')                    // – — → -
    .replace(/\r\n|\r/g, '\n');                         // CRLF 통일

  const rawLines = allText.split('\n');

  // 3) 문장 추출(더 느슨) ─ 끝에 마침표 없으면 자동 삽입
  const english = s => /[A-Za-z]/.test(s);              // 영어 글자 포함?
  const cleaned = rawLines
    .map(l => l.trim().replace(/^(\#?\d+\.?\s*)?["'(]*/, ''))  // 번호·따옴표 제거
    .filter(english)
    .map(l => l.endsWith('.') || l.endsWith('!') || l.endsWith('?') ? l : l + '.');

  // 4) 한 줄에 두 문장이 붙어 있을 때 분리
  const sentences = cleaned.flatMap(l =>
    l.split(/(?<=[.!?])\s+(?=[A-Z])/)
  ).map(s => s.trim());

  // 5) 필요 시 중복 제거 (주석 해제 시 적용)
  // const unique = [...new Set(sentences)];
  // extractedSentences = unique;

  extractedSentences = sentences;      // 중복 허용
  preview();
};

function preview() {
  document.getElementById('preview').innerHTML =
    `<b>문장 개수: ${extractedSentences.length}</b><br><br>` +
    extractedSentences.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');

  ['downloadBtn', 'uploadBtn', 'tokenInput'].forEach(id =>
    document.getElementById(id).style.display = 'inline-block'
  );
}

document.getElementById('downloadBtn').onclick = () => {
  const blob = new Blob(
    [JSON.stringify(extractedSentences, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: 'wfd.json'
  });
  a.click();
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

  // 기존 sha 확인
  let sha = '';
  try {
    const r = await fetch(
      `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`
    );
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  // 업로드(PUT)
  const res = await fetch(
    `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'WFD 문제 자동 업로드',
        content: btoa(unescape(encodeURIComponent(JSON.stringify(extractedSentences, null, 2)))),
        sha
      })
    }
  );
  showStatus(res.ok ? '✅ GitHub 업로드 성공!' : '❌ 업로드 실패: ' + (await res.text()));
};

function showStatus(msg) {
  document.getElementById('status').textContent = msg;
}
/* ---------- 끝 ---------- */
