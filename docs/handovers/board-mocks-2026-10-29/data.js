// Synthetic data for the board mocks. Piece titles for next week are the real pieces; every post, number and status
// is made up to show the layout, and the page says so.
const SERIES = {
  ftm: { label: 'follow.the.money', color: '#FFD84D' },
  uth: { label: 'under.the.hood', color: '#B7A6FF' },
  mtg: { label: 'mind.the.gap', color: '#FF6A4D' },
}
const KINDS = {
  carousel: { label: 'Carousel', glyph: '▤' },
  meme: { label: 'Meme', glyph: '◐' },
  news: { label: 'Good news', glyph: '◆' },
  levelup: { label: 'Level up', glyph: '▲' },
  explainer: { label: 'Explainer', glyph: '◎' },
  piece: { label: 'Series piece', glyph: '●' },
}
const STAGES = ['Idea', 'Words', 'Cuts', 'Publish', 'Amplify']

// status: concept (needs his yes), approved, drafted, scheduled, live
const post = (o) => ({ channels: [], ...o })
const WEEKS = {
  this: {
    label: 'This week', range: 'Mon 26 Oct to Sun 1 Nov', today: 'thu',
    note: 'No Monday, Wednesday or Friday piece this week. The cadence restarts Mon 2 Nov.',
    asks: [
      { kind: 'approve', what: 'Carousel for Fri 30 Oct', detail: '"Five AI prices that moved this month"', day: 'fri', cta: 'Approve concept' },
      { kind: 'approve', what: 'Meme for Sat 31 Oct', detail: '"The intern who never sleeps"', day: 'sat', cta: 'Approve concept' },
      { kind: 'feel', what: 'How did Wednesday land?', detail: 'Carousel, 4.1k views, 212 saves', day: 'wed', cta: 'Like or dislike' },
    ],
    days: [
      { key: 'mon', name: 'Mon', date: '26 Oct', slot: null, posts: [
        post({ kind: 'news', title: 'A hospital cut wait times with one AI triage step', claim: 'Wait times fell 18% in a 3-month trial', status: 'live', time: '08:30', channels: [['linkedin', 'live', '2.3k'], ['threads', 'live', '640'], ['x', 'live', '1.1k']] }),
      ] },
      { key: 'tue', name: 'Tue', date: '27 Oct', posts: [
        post({ kind: 'levelup', title: 'One prompt that turns a meeting into three actions', claim: 'Paste the notes, ask for owner, action and date', status: 'live', time: '12:00', channels: [['linkedin', 'live', '3.8k'], ['instagram', 'live', '1.9k']] }),
      ] },
      { key: 'wed', name: 'Wed', date: '28 Oct', slot: null, feel: null, posts: [
        post({ kind: 'carousel', title: 'Who actually pays when an AI app goes bust', claim: 'Users get nothing; the code and people get sold', status: 'live', time: '09:00', channels: [['instagram', 'live', '4.1k'], ['linkedin', 'live', '2.7k']] }),
      ] },
      { key: 'thu', name: 'Thu', date: '29 Oct', posts: [
        post({ kind: 'explainer', title: 'Why your AI gives a different answer in Paris', claim: 'Where a model is built shapes what it refuses', status: 'scheduled', time: '17:30', channels: [['tiktok', 'scheduled'], ['shorts', 'scheduled'], ['reels', 'scheduled']] }),
        post({ kind: 'meme', title: 'Me reading the terms of service at 2am', claim: 'Nobody reads them; here is the one line that matters', status: 'live', time: '08:00', channels: [['instagram', 'live', '6.2k'], ['x', 'live', '2.0k']] }),
      ] },
      { key: 'fri', name: 'Fri', date: '30 Oct', slot: null, posts: [
        post({ kind: 'carousel', title: 'Five AI prices that moved this month', claim: 'Two went up, three went down, one doubled', status: 'concept', time: '09:00', channels: [['instagram', 'drafted'], ['linkedin', 'drafted']] }),
      ] },
      { key: 'sat', name: 'Sat', date: '31 Oct', posts: [
        post({ kind: 'meme', title: 'The intern who never sleeps', claim: 'Agents work nights; someone still signs off', status: 'concept', time: '10:00', channels: [['instagram', 'drafted'], ['threads', 'drafted']] }),
      ] },
      { key: 'sun', name: 'Sun', date: '1 Nov', posts: [
        post({ kind: 'news', title: 'A small charity used AI to answer 3x more calls', claim: 'Same staff, triple the callbacks', status: 'drafted', time: '11:00', channels: [['linkedin', 'drafted'], ['substack-notes', 'drafted']] }),
      ] },
    ],
  },
  next: {
    label: 'Next week', range: 'Mon 2 Nov to Sun 8 Nov', today: null,
    note: 'Mon, Wed and Fri are back. Every piece is recorded; nothing waits on a new recording until Fri 6 Nov.',
    asks: [
      { kind: 'approve', what: 'Substack post for Mon 2 Nov', detail: 'Week one is by hand: approve, then post it yourself', day: 'mon', cta: 'Approve post' },
      { kind: 'approve', what: 'Titles for Wed 4 Nov', detail: '3 options, best first', day: 'wed', cta: 'Pick title' },
      { kind: 'approve', what: 'Level-up post for Thu 5 Nov', detail: '"Ask your AI who it is allowed to email"', day: 'thu', cta: 'Approve concept' },
    ],
    days: [
      { key: 'mon', name: 'Mon', date: '2 Nov', piece: { series: 'ftm', title: "Anthropic's own hiring data", stage: 2, blocked: 'Cuts in production (video session)', assets: ['Long cut', '90s cut', 'Article', 'Cover'] },
        posts: [post({ kind: 'piece', title: "Anthropic's own hiring data", claim: 'Juniors fell from 27% to 9% of technical hires', status: 'approved', time: '07:00', channels: [['substack', 'drafted'], ['youtube', 'drafted'], ['shorts', 'drafted'], ['linkedin', 'drafted']] })] },
      { key: 'tue', name: 'Tue', date: '3 Nov', posts: [
        post({ kind: 'carousel', title: 'Four jobs AI is learning first', claim: 'From the hiring data, slide by slide', status: 'drafted', time: '09:00', channels: [['instagram', 'drafted'], ['linkedin', 'drafted']] }),
      ] },
      { key: 'wed', name: 'Wed', date: '4 Nov', piece: { series: 'uth', title: "Claude Duet's approval gate", stage: 2, blocked: 'Titles wait on you', assets: ['Long cut', '90s cut', 'Article'] },
        posts: [post({ kind: 'piece', title: "Claude Duet's approval gate", claim: 'It waits for your yes before it sends, pays, signs or deletes', status: 'approved', time: '07:00', channels: [['substack', 'drafted'], ['youtube', 'drafted'], ['shorts', 'drafted']] })] },
      { key: 'thu', name: 'Thu', date: '5 Nov', posts: [
        post({ kind: 'levelup', title: 'Ask your AI who it is allowed to email', claim: 'One setting, two minutes', status: 'concept', time: '12:00', channels: [['linkedin', 'drafted'], ['threads', 'drafted']] }),
      ] },
      { key: 'fri', name: 'Fri', date: '6 Nov', piece: { series: 'mtg', title: 'Where an AI was built decides what it says no to', stage: 3, blocked: null, assets: ['Long cut', '90s cut', 'Article', 'Cover', 'Thumbnail'] },
        posts: [post({ kind: 'piece', title: 'Where an AI was built decides what it says no to', claim: 'Same question, three models, three answers', status: 'scheduled', time: '07:00', channels: [['substack', 'scheduled'], ['youtube', 'scheduled'], ['shorts', 'scheduled'], ['tiktok', 'scheduled']] })] },
      { key: 'sat', name: 'Sat', date: '7 Nov', posts: [
        post({ kind: 'meme', title: 'Two passports, one chatbot', claim: 'From Friday, the light version', status: 'drafted', time: '10:00', channels: [['instagram', 'drafted'], ['x', 'drafted']] }),
      ] },
      { key: 'sun', name: 'Sun', date: '8 Nov', posts: [
        post({ kind: 'explainer', title: 'What an approval gate is, in 60 seconds', claim: 'The one control every assistant should have', status: 'drafted', time: '17:00', channels: [['tiktok', 'drafted'], ['reels', 'drafted']] }),
      ] },
    ],
  },
}
const STATUS = {
  concept: { label: 'Needs your yes', tone: 'ask' },
  approved: { label: 'Approved', tone: 'ok' },
  drafted: { label: 'Drafted', tone: 'quiet' },
  scheduled: { label: 'Scheduled', tone: 'ok' },
  live: { label: 'Live', tone: 'live' },
}
const CHANNEL = { linkedin: 'LinkedIn', threads: 'Threads', x: 'X', instagram: 'Instagram', tiktok: 'TikTok', shorts: 'Shorts', reels: 'Reels', substack: 'Substack', youtube: 'YouTube', 'substack-notes': 'Notes' }
const weekKey = new URLSearchParams(location.search).get('week') || 'this'
const W = WEEKS[weekKey]
const E = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// A mock thumbnail: the post's kind on its series or brand colour, its claim as the headline.
function thumb(p, day, size = 'm') {
  const color = day.piece && p.kind === 'piece' ? SERIES[day.piece.series].color : ({ carousel: '#7EF0C0', meme: '#F4EFE4', news: '#7EF0C0', levelup: '#F4EFE4', explainer: '#B7A6FF' }[p.kind])
  return `<div class="thumb thumb-${size}" style="--tc:${color}"><span class="tk">${E(KINDS[p.kind].label)}</span><span class="th">${E(p.claim)}</span></div>`
}
function chip(c) {
  const [ch, st, n] = c
  return `<span class="chip st-${st}"><i></i>${E(CHANNEL[ch] || ch)}${n ? `<b>${E(n)}</b>` : ''}</span>`
}
