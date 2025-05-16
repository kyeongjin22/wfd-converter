
/* ---------- script.js (최신 완전체) ---------- */
let extractedSentences = [];

const githubInfo = {
  username: '',
  repo: '',
  branch: 'main',
  filePath: 'wfd.json'
};

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

  /* 2. 문자 통일(삭제는 최소화) */
  raw = raw
    .replace(/[\u2018\u2019\u02BB\u02BC\u2032]/g, "'") // ‘ ’ ʻ ꞌ → '
    .replace(/[\u201C\u201D]/g, '"')                   // “ ” → "
    .replace(/[\u2013\u2014]/g, '-')                  // – — → -
    .replace(/\r\n|\r/g, '\n');                       // CRLF → LF

  /* 3. 줄별 전처리 + 끊어진 줄 합치기 */
  const merged = [];
  for (const lineRaw of raw.split('\n')) {
    const line = lineRaw.trim();
    if (!line) continue;                              // 빈 줄 건너뜀

    const prev = merged[merged.length - 1] || '';
    const needMerge =
      merged.length &&
      !/[.!?]$/.test(prev) &&                         // 앞줄이 .!? 로 안 끝나고
      /^[a-z'’]/.test(line);                          // 뒷줄이 소문자/’ 로 시작

    if (needMerge) merged[merged.length - 1] += ' ' + line;
    else merged.push(line);
  }

  /* 4. 필터 규칙 */
  const hasCJK   = /[\u4E00-\u9FFF]/;                 // 중국어·한자 포함 여부
  const isSentence = s =>
    s.length >= 10 &&                                // 너무 짧은 줄 제외
    /[A-Za-z]/.test(s) &&                            // 영어 알파벳 1개 이상
    !hasCJK.test(s) &&                               // CJK 문자 포함 시 제외
    !/WRITE FROM DICTATION/i.test(s);                // 제목 제외

  /* 5. 한 줄에 둘 이상 문장이면 분리 + 마침표 보강 */
  const pieces = merged.flatMap(l => {
    const line = /[.!?]$/.test(l) ? l : l + '.';
    return line.split(/(?<=[.!?])\s+(?=[A-Z])/);      // .!? 뒤 + 대문자 앞에서 분리
  });

  /* 6. 깨끗하게 다듬고 중복 제거 */
  extractedSentences = [...new Set(
    pieces
      .map(s => s.replace(/^["'(]+|["')]+$/g, '').trim()) // 양쪽 꺾쇠·따옴표 제거
      .filter(isSentence)
  )];

  preview();
};

/* ───────── 미리보기 / 다운로드 / 업로드 / 상태표시 ───────── */

function preview() {
  document.getElementById('preview').innerHTML =
    `<b>문장 개수: ${extractedSentences.length}</b><br><br>` +
    extractedSentences.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');

  ['downloadBtn', 'uploadBtn', 'tokenInput']
    .forEach(id => document.getElementById(id).style.display = 'inline-block');
}

document.getElementById('downloadBtn').onclick = () => {
  const blob = new Blob(
    [JSON.stringify(extractedSentences, null, 2)],
    { type: 'application/json' }
  );
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

  /* 기존 SHA 조회(있으면 업데이트, 없으면 신규) */
  let sha = '';
  try {
    const r = await fetch(
      `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`
    );
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
