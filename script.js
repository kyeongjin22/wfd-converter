/* ---------- 완전 수정본 script.js ---------- */
let extractedSentences = [];
let githubInfo = { username: '', repo: '', branch: 'main', filePath: 'wfd.json' };

document.getElementById('parseBtn').onclick = async () => {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) return showStatus('PDF 파일을 선택하세요!');
  showStatus('PDF 분석 중…');

  /* 1. PDF → 전체 텍스트 */
  const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
  let raw = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const txt  = await page.getTextContent();
    raw += txt.items.map(t => t.str).join('\n') + '\n';
  }

  /* 2. 문자 통일(삭제 X) */
  raw = raw
    .replace(/[\u2018\u2019\u02BB\u02BC\u2032]/g, "'") // ’ → '
    .replace(/[\u201C\u201D]/g, '"')                   // “ ” → "
    .replace(/[\u2013\u2014]/g, '-')                  // – — → -
    .replace(/\r\n|\r/g, '\n');                       // CRLF → LF

  /* 3. 줄 단위 전처리 + 끊어진 줄 이어붙이기 */
  const merged = [];
  for (const lineRaw of raw.split('\n')) {
    const line = lineRaw.trim();
    if (!line) continue;                              // 공백 줄 무시

    const last = merged[merged.length - 1] || '';
    const needMerge =
      merged.length &&
      !/[.!?]$/.test(last) &&                          // 이전 줄이 마침표로 끝나지 않고
      /^[a-z'’]/.test(line);                           // 이번 줄이 소문자/’로 시작

    if (needMerge) merged[merged.length - 1] += ' ' + line;
    else merged.push(line);
  }

  /* 4. 제목·짧은 토막 걸러내기 */
  const isSentence = s =>
    s.length >= 10 &&                                 // 너무 짧은 것(Parents. 등) 제거
    !/WRITE FROM DICTATION/i.test(s);                 // 제목 제거

  /* 5. 한 줄에 둘 이상 문장이면 분리 → 마침표 보강 */
  const temp = merged.flatMap(l => {
    const line = l.match(/[.!?]$/) ? l : l + '.';
    return line.split(/(?<=[.!?])\s+(?=[A-Z])/);      // .!? 뒤 + 대문자 앞에서 분리
  });

  /* 6. 깨끗하게 다듬고 중복 제거 */
  extractedSentences = [...new Set(
    temp
      .map(s => s.replace(/^["'(]+|["')]+$/g, '').trim()) // 양쪽 특수문자 제거
      .filter(isSentence)
  )];

  preview();
};

/* ---------- 이하 preview / download / upload / showStatus 동일 ---------- */
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
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),
    { href: url, download: 'wfd.json' }).click();
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

  /* sha 조회(있으면 수정, 없으면 신규) */
  let sha = '';
  try {
    const r = await fetch(
      `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`);
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  const res = await fetch(
    `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'WFD 자동 업로드',
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

