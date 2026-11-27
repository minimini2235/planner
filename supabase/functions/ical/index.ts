// 흑백 플래너 — 애플 캘린더(아이클라우드 공개 캘린더)를 대신 받아 주는 작은 중계 함수
// · 브라우저는 icloud.com에서 직접 받아 올 수 없어서(보안 규칙), 이 함수가 서버에서 받아 그대로 넘겨 줍니다.
// · icloud.com 주소만 받습니다 — 다른 사이트를 대신 여는 데 쓰일 수 없게.
// · "Verify JWT"가 켜져 있으면 플래너에 로그인한 사람만 부를 수 있습니다 (Supabase 기본값).
// Supabase 대시보드 → Edge Functions → 새 함수 이름 "ical" → 이 내용을 붙여 넣고 Deploy.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const say = (text: string, status: number) => new Response(text, { status, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return say('POST만 돼요', 405);
  let url: URL;
  try {
    const body = await req.json();
    url = new URL(String(body?.url ?? '').trim().replace(/^webcal:/i, 'https:'));
  } catch {
    return say('캘린더 주소가 올바르지 않아요', 400);
  }
  const icloud = (h: string) => h === 'icloud.com' || h.endsWith('.icloud.com');
  if (url.protocol !== 'https:' || !icloud(url.hostname)) return say('아이클라우드(icloud.com) 공개 캘린더 주소만 돼요', 400);
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'calendar-reader' } });
    if (!icloud(new URL(r.url).hostname)) return say('아이클라우드 밖으로 넘어가는 주소예요', 400);
    if (!r.ok) return say(`캘린더를 받지 못했어요 (${r.status}) — 공개 캘린더가 켜져 있는지 확인해 주세요`, 502);
    const text = await r.text();
    if (!/BEGIN:VCALENDAR/.test(text)) return say('캘린더 파일이 아니에요', 502);
    if (text.length > 5_000_000) return say('캘린더가 너무 커요', 413);
    return new Response(text, { headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch {
    return say('아이클라우드에 연결하지 못했어요', 502);
  }
});
