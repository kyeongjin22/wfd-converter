
/* ---------- script.js (번호 + 단문 줄바꿈 복원 포함) ---------- */
let extractedSentences = [];

const githubInfo = {
  username: '',
  repo: '',
  branch: 'main',
  filePath: 'wfd.json'
};

/* ───── PDF → 문장 추출 ───── */
document.getElementById('parseBtn').addEventListener('click', async () => {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) { showStatus('PDF 파일을 선택하세요!'); return; }

  showStatus('PDF 분석 중…');

  /* 1. PDF → raw text */
  const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
  let raw = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt  = await page.getTextContent();
    raw += txt.items.map(t => t.str).join('\n') + '\n';
  }

  /* 2. 구두점 통일 */
  raw = raw
    .replace(/[\u2018\u2019\u02BB\u02BC\u2032]/g, "'") // ’ 등 → '
    .replace(/[\u201C\u201D]/g, '"')                  // “ ” → "
    .replace(/[\u2013\u2014]/g, '-')                  // – — → -
    .replace(/\r\n?|\n/g, '\n');                      // 개행 통일

  /* 3. 줄 합치기(행 갈라진 부분 복원) */
  const mergedLines = [];
  for (const lineRaw of raw.split('\n')) {
    const line = lineRaw.trim();
    if (!line) continue;

    const prev = mergedLines[mergedLines.length - 1] || '';

    /* ▸ 개선된 shouldMerge
       ① 앞줄이 .!? 로 안 끝나고 다음 줄이 소문자/’ 로 시작
       ② 앞줄이 ‘단어 1–3개 + 점(.)’ 이고 다음 줄이 소문자/’ 로 시작
          (Parents. / you. / undergraduates. 같은 경우) */
    const shortWordDot = /^[A-Za-z']{1,25}\.$/.test(prev);
    const startsLower  = /^[a-z'’]/.test(line);
    const shouldMerge =
      mergedLines.length &&
      (
        (!/[.!?]$/.test(prev) && startsLower) ||
        (shortWordDot && startsLower)
      );

    shouldMerge
      ? mergedLines[mergedLines.length - 1] = prev.replace(/\.$/, '') + ' ' + line
      : mergedLines.push(line);
  }

  // 3.5. 아포스트로피(') 앞뒤 공백 보정
const cleanedLines = mergedLines.map(
  l => l.replace(/(\w)\s+'\s+(\w)/g, "$1'$2")
);


  /* 4. 필터 조건 */
  const hasCJK = /[\u4E00-\u9FFF]/;        // 중국어‧한자 포함 여부
  const isSentence = s =>
    s.length >= 10 &&
    /[A-Za-z]/.test(s) &&
    !hasCJK.test(s) &&
    !/WRITE FROM DICTATION/i.test(s);

  /* 5. 한 줄 → 여러 문장 분리 + 마침표 보강 */
  const pieces = cleanedLines.flatMap(l => {
    const line = /[.!?]$/.test(l) ? l : l + '.';
    return line.split(/(?<=[.!?])\s+(?=[A-Z])/);
  });

  /* 6. 다듬기 + 번호 제거 + 중복 제거 */
  extractedSentences = [...new Set(
    pieces
      .map(s =>
        s
          .replace(/^["'(]+|["')]+$/g, '')   // 양쪽 따옴표/괄호
          .replace(/^\d+\s*[\.)]?\s*/, '')   // 맨 앞 숫자·점·괄호
          .trim()
      )
      .filter(isSentence)
  )];

  preview();
});

/* ───── 미리보기 ───── */
function preview() {
  const previewEl = document.getElementById('preview');
  previewEl.innerHTML =
    `<b>문장 개수: ${extractedSentences.length}</b><br><br>` +
    extractedSentences.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');

  ['downloadBtn', 'uploadBtn', 'tokenInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'inline-block';
  });
}

/* ───── JSON 다운로드 ───── */
document.getElementById('downloadBtn').addEventListener('click', () => {
  const now = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const output = {
    date: now,
    data: extractedSentences
  };

  const blob = new Blob(
    [JSON.stringify(output, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url,
    download: 'wfd.json'
  }).click();
  URL.revokeObjectURL(url);
});


/* ───── GitHub 업로드 ───── */
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const token = document.getElementById('tokenInput').value.trim();
  if (!token) { showStatus('GitHub 토큰을 입력하세요!'); return; }

  if (!githubInfo.username || !githubInfo.repo) {
    githubInfo.username = prompt('깃허브 아이디?');
    githubInfo.repo     = prompt('저장소 이름?');
  }

  showStatus('GitHub에 업로드 중…');

  const apiURL = `https://api.github.com/repos/${githubInfo.username}/${githubInfo.repo}/contents/${githubInfo.filePath}`;

  /* 기존 파일 SHA 조회 */
  let sha = '';
  try {
    const infoRes = await fetch(apiURL);
    if (infoRes.ok) sha = (await infoRes.json()).sha;
  } catch {}

  /* ✅ 업로드할 JSON 구조 변경 */
  const now = new Date().toISOString().slice(0, 10);
  const output = {
    date: now,
    data: extractedSentences
  };

  /* PUT 업로드 */
  const putRes = await fetch(apiURL, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'WFD 자동 업로드',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(output, null, 2)))),
      sha
    })
  });

  showStatus(
    putRes.ok
      ? '✅ GitHub 업로드 성공!'
      : '❌ 업로드 실패: ' + await putRes.text()
  );
});


/* ───── 상태 출력 ───── */
function showStatus(msg) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg;
}
/* ---------- 끝 ---------- */
