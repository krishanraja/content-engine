// Version 4: job-specific toy actors. THREE, pigments and approved marks are supplied by the scene.
export const ROLES = [
  'vision', 'judgement', 'ceo', 'taste', 'standards', 'link-reader',
  'inspiration-scout', 'search-probe', 'divergent-thinker', 'idea-ranker', 'trend-radar',
  'researcher', 'fact-checker', 'scriptwriter', 'voice-checker', 'clarity-coach',
  'video-editor', 'voice-music', 'motion-designer', 'cover-designer', 'carousels', 'builder',
  'scheduler', 'poster', 'results-reader', 'replier', 'amplifier',
  'account-researcher', 'call-prep', 'crm-updater', 'notetaker', 'outbound-drafts', 'follow-up',
  'coder', 'reviewer', 'deployer', 'tester', 'fixer', 'librarian', 'file-archive',
  'content-archive', 'inspiration-house', 'taste-standards', 'auditor', 'analyst',
  'trend-spotter', 'learnings', 'chief-of-staff', 'courier',
];

export function makeFigurine(THREE, spec) {
  const role = spec.role;
  if (!ROLES.includes(role)) throw new Error(`Unknown figurine role: ${role}`);
  // Placement is exclusively the scene's. Locomotion lives one level below it.
  const placement = new THREE.Group(); placement.name = `figurine-${role}`;
  const group = new THREE.Group(); group.name = 'local-work-pivot'; placement.add(group);
  // Width, torso height, belly, forward lean, sideways attitude, stance and expression.
  const builds = {
    vision: [.19,.275,.82,-.10,-.05,.071,'intent'],
    judgement: [.275,.23,1.08,-.05,0,.082,'stern'],
    ceo: [.235,.235,.98,-.08,.035,.075,'easy'],
    taste: [.185,.26,.86,.02,-.17,.066,'wry'],
    standards: [.205,.275,.9,.06,.025,.069,'intent'],
    'link-reader': [.21,.21,1.03,.22,-.045,.068,'curious'],
    'inspiration-scout': [.225,.245,.87,.12,.09,.082,'curious'],
    'search-probe': [.18,.22,.9,.18,-.06,.06,'intent'],
    'divergent-thinker': [.22,.215,1.15,.015,.18,.075,'grin'],
    'idea-ranker': [.245,.20,1.12,.10,-.08,.08,'wry'],
    'trend-radar': [.185,.265,.9,.04,.065,.062,'curious'],
    researcher: [.205,.22,1.05,.25,-.07,.065,'intent'],
    'fact-checker': [.19,.255,.9,.17,.05,.065,'skeptic'],
    scriptwriter: [.25,.195,1.12,.28,-.025,.08,'intent'],
    'voice-checker': [.24,.225,1.02,-.04,-.11,.074,'easy'],
    'clarity-coach': [.26,.245,.86,-.08,.065,.087,'bright'],
    'video-editor': [.225,.215,1.1,.09,-.04,.078,'wry'],
    'voice-music': [.19,.27,.85,-.10,-.10,.071,'sing'],
    'motion-designer': [.18,.255,.9,.05,.12,.063,'bright'],
    'cover-designer': [.235,.23,1.05,.12,-.12,.081,'grin'],
    carousels: [.215,.205,1.18,-.035,.08,.072,'bright'],
    builder: [.28,.21,1.09,.12,.03,.088,'grin'],
    scheduler: [.225,.235,1.05,.09,-.03,.07,'intent'],
    poster: [.20,.245,.9,.08,.1,.076,'bright'],
    'results-reader': [.235,.255,.95,-.06,-.03,.078,'easy'],
    replier: [.22,.225,1.1,.12,.1,.07,'bright'],
    amplifier: [.265,.235,1.02,-.07,-.08,.088,'sing'],
    'account-researcher': [.19,.27,.88,.17,-.06,.063,'skeptic'],
    'call-prep': [.245,.265,.86,-.08,.05,.081,'bright'],
    'crm-updater': [.255,.20,1.14,.15,.025,.08,'intent'],
    notetaker: [.18,.23,.9,.29,.07,.059,'intent'],
    'outbound-drafts': [.21,.24,1.04,.13,-.09,.071,'easy'],
    'follow-up': [.185,.26,.88,.1,-.045,.063,'skeptic'],
    coder: [.245,.195,1.15,.30,-.055,.08,'intent'],
    reviewer: [.21,.25,.98,.12,.065,.072,'review'],
    deployer: [.23,.255,.9,-.075,.055,.08,'grin'],
    tester: [.255,.215,1.08,.22,-.08,.081,'curious'],
    fixer: [.285,.205,1.15,.13,.07,.087,'wry'],
    librarian: [.22,.235,1.14,.18,-.07,.069,'easy'],
    'file-archive': [.25,.225,1.1,.1,.04,.08,'intent'],
    'content-archive': [.265,.20,1.12,-.025,-.07,.084,'grin'],
    'inspiration-house': [.19,.255,.88,.06,.13,.066,'bright'],
    'taste-standards': [.25,.25,.92,-.06,0,.083,'stern'],
    auditor: [.18,.255,.94,.24,-.045,.058,'squint'],
    analyst: [.235,.24,1.02,.07,.045,.076,'curious'],
    'trend-spotter': [.19,.28,.84,.08,.085,.067,'bright'],
    learnings: [.225,.205,1.18,.13,-.10,.073,'grin'],
    'chief-of-staff': [.265,.275,.88,-.07,-.035,.087,'confident'],
    courier: [.27,.215,1.12,.08,.04,.085,'bright'],
  };
  const [width, height, belly, lean, attitude, stance, expression] = builds[role];
  const pigment = color => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 });
  const body = pigment(spec.body), dark = pigment(spec.accent), skin = pigment(spec.skin);
  const p = Object.fromEntries(Object.entries(spec.palette).map(([key, value]) => [key, pigment(value)]));
  // All dark components use the caller's accent, including tool handles and hair.
  p.ink = dark;
  p.glow.emissive.set(spec.palette.glow); p.glow.emissiveIntensity = 0.65;
  const motions = [];
  const pivot = (name, x = 0, y = 0, z = 0, parent = group) => {
    const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); parent.add(o); return o;
  };
  const mesh = (parent, name, geo, mat, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, mat); o.name = name; o.position.set(x, y, z); parent.add(o); return o;
  };
  // Centred bevelled solids, without an addon or an external texture.
  function box(parent, name, w, h, d, mat, x = 0, y = 0, z = 0) {
    const r = Math.min(w, h, d) * 0.18;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2 + r); shape.lineTo(w / 2 - r, -h / 2 + r);
    shape.lineTo(w / 2 - r, h / 2 - r); shape.lineTo(-w / 2 + r, h / 2 - r); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true,
      bevelSegments: 2, bevelSize: r, bevelThickness: r, steps: 1 });
    geo.translate(0, 0, -d / 2 + r);
    return mesh(parent, name, geo, mat, x, y, z);
  }
  const ball = (parent, name, r, mat, x = 0, y = 0, z = 0) =>
    mesh(parent, name, new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
  const cyl = (parent, name, r, h, mat, x = 0, y = 0, z = 0, top = r) =>
    mesh(parent, name, new THREE.CylinderGeometry(top, r, h, 20), mat, x, y, z);
  const ring = (parent, name, r, tube, mat, x = 0, y = 0, z = 0) =>
    mesh(parent, name, new THREE.TorusGeometry(r, tube, 8, 24), mat, x, y, z);
  function rod(parent, name, a, b, r, mat) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const o = cyl(parent, name, r, from.distanceTo(to), mat);
    o.position.copy(from.add(to).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());
    return o;
  }
  function decal(parent, name, texture, w, h, x, y, z) {
    if (!texture) return;
    return mesh(parent, name, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
      map: texture, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0,
    }), x, y, z);
  }
  const feet = [-1, 1].map(s => {
    box(group, `thigh-${s}`, 0.096, 0.145, 0.105, dark, s * stance, 0.12, 0);
    decal(group, 'leg-logo', spec.legLogo, 0.075, 0.075, s * stance, 0.135, 0.054);
    return box(group, `foot-${s}`, 0.105, 0.055, 0.135, dark, s * stance, 0.0275, 0.014);
  });
  const torso = pivot('upper-body', 0, 0.29, 0);
  // A continuous rounded pear/barrel torso, with role-specific shoulders and waist.
  const outline = [[.65,-.5],[.92,-.46],[belly,-.20],[belly,.02],[.96,.33],[.78,.47],[.42,.5]];
  const torsoGeo = new THREE.LatheGeometry(outline.map(([r,y]) => new THREE.Vector2(r * width / 2, y * height)), 24);
  const shell = mesh(torso, 'sculpted-body', torsoGeo, body);
  shell.scale.z = .155 / width;
  torso.position.y = .18 + height / 2;
  const rise = height - .22;
  box(torso, 'collar', 0.097, 0.025, 0.09, p.cream, 0, 0.116, 0);
  const head = pivot('head', 0, 0.509 + rise, 0);
  if (spec.head === 'human') {
    ball(head, 'human-head', 0.115, skin);
    mesh(head, 'hair', new THREE.SphereGeometry(0.119, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), dark, 0, 0.003);
    for (const s of [-1, 1]) ball(head, `ear-${s}`, 0.022, skin, s * 0.112, -0.01, 0);
  } else {
    box(head, 'bot-head', 0.25, 0.22, 0.186, body);
    box(head, 'flat-face', 0.204, 0.145, 0.009, body, 0, -0.011, 0.095);
    decal(head, 'head-logo', spec.headLogo, 0.15, 0.074, 0, -0.036, 0.101);
  }
  const eyes = [-1, 1].map(s => ball(head, `eye-${s}`, 0.012, dark, s * 0.054, 0.032, 0.103));
  const arms = [-1, 1].map(s => {
    const a = pivot(`shoulder-${s}`, s * (width / 2 + .025), 0.354 + rise, 0.025);
    box(a, `sleeve-${s}`, 0.058, 0.1, 0.068, body, 0, -0.035, 0);
    ball(a, `hand-${s}`, 0.03, spec.head === 'human' ? skin : body, 0, -0.079, 0.022);
    return a;
  });
  function cap(kind, mat = p.butter) {
    const h = pivot(`${kind}-hat`, 0, .626 + rise, 0);
    if (kind.includes('beret')) {
      const crown = ball(h, 'beret-soft-crown', .132, mat, -.018, .027, -.008);
      crown.scale.set(1,.43,.82); crown.rotation.z = -.18;
      cyl(h, 'beret-band', .112, .023, dark, 0, .003, 0).scale.z = .8;
      rod(h, 'beret-stalk', [-.025,.076,-.008], [-.014,.1,-.008], .009, mat);
    } else if (kind === 'hardhat') {
      mesh(h, 'hardhat-dome', new THREE.SphereGeometry(.127,24,12,0,Math.PI*2,0,Math.PI/2), mat,0,.002,0).scale.z=.82;
      cyl(h, 'hardhat-protective-brim', .145,.02,mat,0,.003,0).scale.z=.85;
      mesh(h,'hardhat-central-ridge',new THREE.TorusGeometry(.13,.012,8,24,Math.PI),mat,0,.003,0).rotation.y=Math.PI/2;
      for(const side of [-1,1]) box(h,`hardhat-rib-${side}`,.012,.065,.11,mat,side*.061,.079,-.005);
    } else if (kind.includes('visor')) {
      // Open top, forehead band and projecting curved shade, no dome.
      cyl(h,'visor-headband',.126,.032,mat,0,-.033,0).scale.z=.78;
      const shade=ball(h,'visor-shade',.115,mat,0,-.026,.09); shade.scale.set(1,.1,.7);
      box(h,'visor-front-band',.18,.034,.025,dark,0,-.035,.096);
    } else if (kind === 'explorer') {
      cyl(h,'explorer-wide-brim',.174,.018,mat,0,.003,0).scale.z=.83;
      cyl(h,'explorer-tall-crown',.102,.075,mat,0,.047,-.008,.087).scale.z=.84;
      cyl(h,'explorer-hatband',.104,.02,dark,0,.021,-.008).scale.z=.84;
      box(h,'explorer-crown-crease',.025,.009,.106,dark,0,.087,-.008);
    } else if (['captain','coach','dispatch','courier','director'].includes(kind)) {
      cyl(h,'cap-band',.12,.037,mat,0,.009,0).scale.z=.82;
      const crown=ball(h,'cap-crown',.124,mat,0,.04,-.012); crown.scale.set(1,.54,.84);
      const peak=ball(h,'cap-projecting-peak',.108,mat,0,-.006,.103); peak.scale.set(1,.11,.65);
      box(h,'cap-front-badge',.037,.028,.01,p.cream,0,.029,.101);
      if(kind==='captain') rod(h,'captain-braid',[-.08,.001,.098],[.08,.001,.098],.007,p.butter);
    }
    // Jobs without a recognisable hat remain bareheaded.
    return h;
  }
  function glasses(chain = false) {
    for (const s of [-1, 1]) {
      ring(head, `spectacle-${s}`, 0.034, 0.007, dark, s * 0.054, 0.032, 0.112);
      if (chain) rod(head, `glasses-chain-${s}`, [s * 0.1, 0.02, 0.08], [s * 0.11, -0.12, 0], 0.004, p.metal);
    }
    rod(head, 'glasses-bridge', [-0.02, 0.032, 0.114], [0.02, 0.032, 0.114], 0.006, dark);
  }
  function headset(mic = true, mat = dark) {
    mesh(head, 'headphone-arch', new THREE.TorusGeometry(0.136, 0.014, 8, 24, Math.PI), mat, 0, 0.005, 0);
    for (const s of [-1, 1]) box(head, `ear-cup-${s}`, 0.04, 0.08, 0.077, mat, s * 0.136, 0.005, 0);
    if (mic) { rod(head, 'headset-boom', [0.15, -0.02, 0.02], [0.086, -0.064, 0.139], 0.008, dark); ball(head, 'boom-mic', 0.017, dark, 0.086, -0.064, 0.139); }
  }
  function tie(mat = p.lilac) {
    const t = box(torso, 'tie', 0.034, 0.135, 0.015, mat, 0, 0.025, 0.078); t.rotation.z = -0.08;
    ball(torso, 'tie-knot', 0.02, mat, 0, 0.09, 0.082);
  }
  function board(name, x = 0, y = 0.35, w = 0.235, h = 0.18, mat = p.paper, parent = group) {
    const b = pivot(name, x, y, 0.163, parent);
    box(b, `${name}-back`, w, h, 0.022, mat); return b;
  }
  function bars(parent, count = 3, mat = p.metal, width = 0.13) {
    for (let i = 0; i < count; i++) box(parent, `rule-${i}`, width * (1 - i * 0.14), 0.013, 0.008, mat, 0, 0.045 - i * 0.032, 0.018);
  }
  function tick(parent, x = 0, y = 0, mat = p.mint, scale = 1) {
    rod(parent, 'tick-short', [x - 0.04 * scale, y, 0.025], [x - 0.012 * scale, y - 0.025 * scale, 0.025], 0.009 * scale, mat);
    rod(parent, 'tick-long', [x - 0.012 * scale, y - 0.025 * scale, 0.025], [x + 0.055 * scale, y + 0.042 * scale, 0.025], 0.009 * scale, mat);
  }
  function pen(parent, name, x = 0, y = 0, z = 0, mat = p.coral) {
    const a = pivot(name, x, y, z, parent);
    cyl(a, `${name}-shaft`, 0.009, 0.125, mat);
    cyl(a, `${name}-nib`, 0.009, 0.025, dark, 0, -0.075, 0, 0);
    return a;
  }
  function book(parent, name, x, y, z, mat = p.lilac, w = 0.15, h = 0.12) {
    const b = pivot(name, x, y, z, parent);
    box(b, `${name}-pages`, w - 0.008, h - 0.016, 0.035, p.paper);
    for (const d of [-1, 1]) box(b, `${name}-cover-${d}`, w, h, 0.009, mat, 0, 0, d * 0.023);
    box(b, `${name}-spine`, 0.016, h, 0.055, mat, -w / 2, 0, 0);
    return b;
  }
  function envelope(parent, name, x = 0, y = 0, z = 0) {
    const e = pivot(name, x, y, z, parent);
    box(e, `${name}-paper`, 0.17, 0.112, 0.023, p.cream);
    rod(e, `${name}-fold-left`, [-0.077, 0.045, 0.015], [0, -0.012, 0.015], 0.004, p.wood);
    rod(e, `${name}-fold-right`, [0.077, 0.045, 0.015], [0, -0.012, 0.015], 0.004, p.wood);
    return e;
  }
  function magnifier(parent, x, y, z) {
    const m = pivot('magnifier', x, y, z, parent);
    ring(m, 'magnifier-rim', 0.055, 0.012, p.metal);
    const glass = p.mint.clone(); glass.transparent = true; glass.opacity = 0.3;
    mesh(m, 'magnifier-glass', new THREE.CircleGeometry(0.05, 24), glass, 0, 0, -0.001);
    rod(m, 'magnifier-handle', [0, -0.05, 0], [0.026, -0.13, 0], 0.014, dark);
    return m;
  }
  const animate = fn => motions.push(fn);
  // Oscillation is always referenced to the neutral pose, never integrated from the last frame.
  function swing(obj, axis = 'z', amplitude = 0.56, base = 0, period = 2.6, phase = 0) {
    animate(t => { obj.rotation[axis] = base + amplitude * Math.sin(t * Math.PI * 2 / period + phase); });
    return obj;
  }
  function slide(obj, axis, amplitude, period = 2.6, phase = 0) {
    const base = obj.position[axis];
    animate(t => { obj.position[axis] = base + amplitude * Math.sin(t * Math.PI * 2 / period + phase); });
    return obj;
  }
  function pointer(parent, name, x, y, z, mat = p.wood) {
    const a = pivot(name, x, y, z, parent); pen(a, `${name}-stick`, 0, 0.02, 0, mat); return a;
  }
  let actor;
  switch (role) {
    case 'vision': {
      cap('captain', p.cream);
      const tripod = pivot('tripod', -0.095, 0.36, 0.11);
      for (const s of [-1, 1]) rod(tripod, `tripod-leg-${s}`, [0, 0, 0], [s * 0.09, -0.35, 0.018], 0.011, p.wood);
      rod(tripod, 'tripod-back-leg', [0, 0, 0], [0, -0.35, -0.16], 0.011, p.wood);
      actor = pivot('telescope-sweep', .04, 0.075, -.04, tripod);
      actor.scale.set(1.42,1.25,.85);
      const tube = cyl(actor, 'brass-telescope', 0.032, 0.235, p.butter); tube.rotation.z = Math.PI / 2;
      const rim = cyl(actor, 'telescope-lens-rim', 0.044, 0.025, dark, -0.12, 0, 0); rim.rotation.z = Math.PI / 2;
      rod(group, 'pointing-arm', [0.14, 0.37, 0.02], [0.21, 0.47, 0.08], 0.028, body);
      swing(actor, 'y', 0.46); break;
    }
    case 'judgement': {
      for (const s of [-1, 1]) { const c = box(torso, `judge-collar-${s}`, 0.073, 0.087, 0.018, p.cream, s * 0.047, 0.063, 0.08); c.rotation.z = s * 0.4; }
      cyl(group, 'sound-block', 0.068, 0.045, p.wood, 0.09, 0.26, 0.15);
      actor = pivot('gavel-strike', 0.11, 0.43, 0.14);
      rod(actor, 'gavel-handle', [0, 0, 0], [-0.07, -0.08, 0], 0.013, p.wood);
      const g = cyl(actor, 'gavel-head', 0.033, 0.102, dark, -0.075, -0.09, 0); g.rotation.z = Math.PI / 2;
      swing(actor, 'z', 0.65, -0.25, 2.4); break;
    }
    case 'ceo': {
      for (const s of [-1, 1]) { const l = box(torso, `jacket-lapel-${s}`, 0.046, 0.14, 0.018, p.cream, s * 0.056, 0.03, 0.075); l.rotation.z = s * 0.25; }
      const phone = board('phone', -0.115, 0.34, 0.062, 0.11, dark); box(phone, 'phone-screen', 0.048, 0.084, 0.007, p.glow, 0, 0.004, 0.016);
      actor = pivot('easy-sip', 0.11, 0.4, 0.12);
      cyl(actor, 'mug', 0.042, 0.09, p.cream);
      cyl(actor, 'coffee', 0.034, 0.005, dark, 0, 0.046, 0);
      ring(actor, 'mug-handle', 0.029, 0.01, p.cream, 0.044, 0, 0);
      swing(actor, 'x', 0.55, -0.2, 3); break;
    }
    case 'taste': {
      const hat = cap('beret', p.lilac); hat.rotation.z = -0.2;
      for (const s of [-1, 1]) {
        const card = board(`swatch-${s}`, s * 0.115, 0.375, 0.105, 0.153, p.paper);
        box(card, `paint-swatch-${s}`, 0.084, 0.105, 0.009, s < 0 ? p.mint : p.coral, 0, 0.013, 0.017);
        slide(card, 'y', 0.06, 2.8, s < 0 ? 0 : Math.PI); if (s > 0) { actor = card; swing(card, 'y', 0.56, 0, 2.8); }
      }
      swing(head, 'z', 0.12, -0.09, 2.8); break;
    }
    case 'standards': {
      const b = board('standards-clipboard', -0.045, 0.34, 0.19, 0.205, p.wood);
      box(b, 'check-sheet', 0.165, 0.177, 0.008, p.paper, 0, 0, 0.016); tick(b, 0, 0);
      box(b, 'clipboard-clip', 0.06, 0.03, 0.015, p.metal, 0, 0.098, 0.018);
      pen(head, 'ear-pencil', 0.134, 0.015, 0.015, p.butter).rotation.z = -0.2;
      actor = pointer(group, 'checking-pencil', 0.085, 0.36, 0.2, p.butter); swing(actor, 'z'); break;
    }
    case 'link-reader': {
      const b = board('tablet', -0.015, 0.35, 0.214, 0.175, dark); box(b, 'tablet-screen', 0.187, 0.144, 0.008, p.glow, 0, 0, 0.015);
      const feed = pivot('scrolling-feed', 0, 0, 0.008, b); bars(feed, 3, dark); slide(feed, 'y', 0.022);
      actor = pivot('swiping-finger', 0.12, 0.36, 0.195); rod(actor, 'index-finger', [0, 0, 0], [-0.05, 0.038, 0], 0.012, body);
      slide(actor, 'y', 0.07, 2.3); box(head, 'reader-brow', 0.14, 0.023, 0.02, dark, 0, 0.073, 0.097); break;
    }
    case 'inspiration-scout': {
      cap('explorer', p.wood); box(torso, 'scout-satchel-strap', 0.025, 0.19, 0.015, p.butter, -0.04, 0, 0.078).rotation.z = -0.5;
      actor = pivot('binocular-scan', 0, 0.46, 0.15);
      for (const s of [-1, 1]) { const b = cyl(actor, `binocular-barrel-${s}`, 0.04, 0.1, dark, s * 0.051, 0, 0); b.rotation.x = Math.PI / 2; ring(actor, `binocular-lens-${s}`, 0.033, 0.008, p.metal, s * 0.051, 0, 0.054); }
      box(actor, 'binocular-bridge', 0.09, 0.025, 0.04, dark); swing(actor, 'y', 0.6); slide(actor, 'y', 0.045, 2.6); break;
    }
    case 'search-probe': {
      cap('search-visor', p.mint);
      const b = board('search-terminal', 0, 0.31, 0.23, 0.125, dark); bars(b, 2, p.glow);
      box(group, 'terminal-keys', 0.23, 0.025, 0.08, p.metal, 0, 0.24, 0.13);
      actor = pivot('search-answer', 0.12, 0.727, 0.02);
      // A curved hook and dot form punctuation, not a rasterised word.
      mesh(actor, 'question-hook', new THREE.TorusGeometry(0.033, 0.009, 8, 20, Math.PI * 1.5), p.butter, 0, 0.019, 0);
      ball(actor, 'question-dot', 0.011, p.butter, 0, -0.04, 0);
      const answer = pivot('answer-tick', 0, 0, 0, actor); tick(answer, 0, 0, p.mint, 0.65);
      animate(t => { const yes = Math.sin(t * Math.PI * 2 / 2.4) > 0; answer.visible = yes; actor.children[0].visible = actor.children[1].visible = !yes; });
      swing(actor, 'y', 0.56, 0, 2.4); swing(arms[0], 'x', 0.15, -0.8, 1.3); break;
    }
    case 'divergent-thinker': {
      box(group, 'odd-sock', 0.101, 0.033, 0.112, p.lilac, -0.06, 0.07, 0.003);
      rod(head, 'bent-antenna-a', [-0.06, 0.11, 0], [-0.09, 0.16, 0], 0.009, dark);
      rod(head, 'bent-antenna-b', [-0.09, 0.16, 0], [-0.04, 0.18, 0], 0.009, dark);
      actor = pivot('eureka-bulb', 0.09, 0.748, 0);
      ball(actor, 'bulb-glass', 0.045, p.glow); cyl(actor, 'bulb-base', 0.022, 0.036, p.metal, 0, -0.047, 0);
      for (const s of [-1, 1]) rod(actor, `idea-ray-${s}`, [s * 0.057, 0.01, 0], [s * 0.076, 0.025, 0], 0.006, p.butter);
      swing(actor, 'z', 0.6); animate(t => { p.glow.emissiveIntensity = 0.2 + 0.9 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.6)); });
      arms[0].rotation.z = -2.4; head.rotation.z = 0.15; break;
    }
    case 'idea-ranker': {
      cap('ranking-cap', p.lilac);
      const cards = [-1, 0, 1].map((s, i) => {
        const b = board(`rank-card-${i + 1}`, s * 0.115, 0.35 + (i === 0 ? 0.055 : 0), 0.097, 0.136, [p.butter, p.cream, p.lilac][i]);
        for (let j = 0; j <= i; j++) ball(b, `rank-pip-${j}`, 0.012, dark, 0, (j - i / 2) * 0.031, 0.019);
        return b;
      });
      actor = cards[0]; slide(cards[0], 'x', 0.055); slide(cards[1], 'x', 0.055, 2.6, Math.PI); slide(cards[0], 'y', 0.06); break;
    }
    case 'trend-radar': {
      box(group, 'radar-backpack', 0.17, 0.205, 0.09, p.metal, 0, 0.345, -0.105);
      rod(group, 'radar-mast', [0,.43,-.09], [0,.67,-.09], .013, dark);
      actor = pivot('sweeping-radar', 0,.72,-.045);
      const bowlProfile = [[0,0],[.026,.002],[.055,.009],[.085,.025],[.11,.046]];
      const bowlMat=p.cream.clone(); bowlMat.side=THREE.DoubleSide;
      const dish=mesh(actor,'concave-radar-bowl',new THREE.LatheGeometry(bowlProfile.map(v=>new THREE.Vector2(...v)),32),bowlMat);
      dish.rotation.x=Math.PI/2;
      ring(actor,'dish-rolled-rim',.11,.009,p.metal,0,0,.046);
      for(const side of [-1,1]) rod(actor,`dish-feed-strut-${side}`,[side*.09,0,.04],[0,0,.105],.005,dark);
      rod(actor,'dish-third-strut',[0,.09,.04],[0,0,.105],.005,dark);
      ball(actor,'dish-receiver',.019,p.butter,0,0,.105);
      swing(actor, 'y', 0.9, 0, 3); swing(head, 'y', 0.17, 0, 3); break;
    }
    case 'researcher': {
      glasses(); head.rotation.x = 0.12;
      book(group, 'left-open-cover', -0.06, 0.34, 0.16, p.lilac, 0.115, 0.143).rotation.y = -0.3;
      book(group, 'right-open-cover', 0.06, 0.34, 0.16, p.lilac, 0.115, 0.143).rotation.y = 0.3;
      for (let i = 0; i < 3; i++) book(group, `book-stack-${i}`, -0.153, 0.032 + i * 0.047, -0.035, [p.butter, p.mint, p.coral][i], 0.12, 0.035);
      actor = pivot('page-turn-hinge', 0, 0.34, 0.185); box(actor, 'turning-page', 0.103, 0.13, 0.006, p.paper, 0.05, 0, 0);
      swing(actor, 'y', 0.9, -0.3); break;
    }
    case 'fact-checker': {
      glasses(); const page = board('source-page', -0.045, 0.325, 0.2, 0.18); bars(page, 3, p.metal); tick(page, 0.045, -0.05, p.coral, 0.48);
      actor = magnifier(group, 0.05, 0.425, 0.205); swing(actor, 'z', 0.58);
      pen(group, 'red-check-pen', -0.15, 0.36, 0.19).rotation.z = -0.4;
      box(torso, 'checker-pocket', 0.055, 0.065, 0.015, p.cream, -0.06, 0, 0.08); break;
    }
    case 'scriptwriter': {
      cap('writer-cap', p.cream); head.rotation.x = 0.13;
      box(group, 'typewriter-base', 0.285, 0.055, 0.14, dark, 0, 0.27, 0.125);
      for (let i = 0; i < 6; i++) box(group, `typewriter-key-${i}`, 0.026, 0.017, 0.025, p.cream, -0.095 + i * 0.038, 0.307, 0.17);
      actor = pivot('typewriter-carriage', 0, 0.36, 0.1);
      const roller = cyl(actor, 'platen', 0.025, 0.2, p.metal); roller.rotation.z = Math.PI / 2;
      box(actor, 'script-paper', 0.14, 0.16, 0.008, p.paper, 0, 0.07, -0.006); bars(actor, 2, p.metal, 0.09);
      slide(actor, 'x', 0.07, 2.4); for (let i = 0; i < 2; i++) swing(arms[i], 'x', 0.18, -0.8, 1.2, i * Math.PI); break;
    }
    case 'voice-checker': {
      headset(false, p.lilac); const b = board('waveform-card', -0.04, 0.29, 0.19, 0.105, p.cream);
      for (let i = 0; i < 7; i++) box(b, `waveform-${i}`, 0.012, 0.02 + 0.043 * Math.abs(Math.sin(i * 1.8)), 0.009, dark, (i - 3) * 0.022, 0, 0.017);
      actor = pivot('approval-thumb', 0.15, 0.385, 0.12); ball(actor, 'thumb-fist', 0.031, body);
      box(actor, 'raised-thumb', 0.028, 0.073, 0.034, body, -0.015, 0.039, 0);
      swing(actor, 'z'); swing(head, 'x', 0.14, 0, 2.6); break;
    }
    case 'clarity-coach': {
      cap('coach', p.coral); cyl(torso, 'whistle', 0.023, 0.039, p.metal, 0, 0.045, 0.098).rotation.x = Math.PI / 2;
      const b = board('three-clear-points', -0.065, 0.35, 0.22, 0.15, dark); bars(b, 3, p.cream);
      actor = pointer(group, 'coach-pointer', 0.12, 0.375, 0.2); swing(actor, 'z', 0.65, -0.45); break;
    }
    case 'video-editor': {
      cap('director', dark);
      const b = board('clapperboard', 0, 0.32, 0.255, 0.14, dark); bars(b, 2, p.cream);
      actor = pivot('clapper-hinge', -0.117, 0.4, 0.165);
      box(actor, 'clapper-top', 0.245, 0.038, 0.027, p.cream, 0.112, 0, 0);
      for (let i = 0; i < 5; i++) box(actor, `clapper-stripe-${i}`, 0.021, 0.036, 0.029, dark, 0.019 + i * 0.045, 0, 0).rotation.z = -0.4;
      swing(actor, 'z', 0.4, 0.42, 2.3); break;
    }
    case 'voice-music': {
      headset(false, p.butter); torso.rotation.z = -0.09;
      cyl(group, 'mic-base', 0.06, 0.024, dark, 0.12, 0.012, 0.16);
      cyl(group, 'mic-stand', 0.009, 0.415, p.metal, 0.12, 0.22, 0.16);
      const mic = cyl(group, 'microphone', 0.031, 0.1, dark, 0.12, 0.47, 0.16); mic.rotation.x = 0.45;
      for (let i = 0; i < 3; i++) ring(group, `mic-grille-${i}`, 0.031, 0.003, p.metal, 0.12, 0.45 + i * 0.017, 0.16).rotation.x = Math.PI / 2;
      actor = pivot('floating-music-note', -0.15, 0.43, 0.13);
      const n = ball(actor, 'note-head', 0.031, p.butter, 0, -0.04, 0); n.scale.y = 0.65;
      rod(actor, 'note-stem', [0.023, -0.04, 0], [0.023, 0.075, 0], 0.009, p.butter);
      rod(actor, 'note-flag', [0.023, 0.075, 0], [0.065, 0.047, 0], 0.011, p.butter);
      slide(actor, 'y', 0.065, 2.5); swing(actor, 'z', 0.56, 0, 2.5); break;
    }
    case 'motion-designer': {
      cap('animator-beret', p.mint);
      const arc = mesh(group, 'motion-path', new THREE.TorusGeometry(0.125, 0.007, 8, 32, Math.PI), p.metal, 0, 0.33, 0.16);
      actor = pivot('drawing-stylus', 0, 0.33, 0.18);
      pen(actor, 'stylus', 0.115, 0, 0, dark).rotation.z = Math.PI / 2;
      ball(actor, 'path-ball', 0.035, p.coral, 0.12, 0, 0);
      swing(actor, 'z', 1.05, Math.PI / 2, 3); arc.rotation.z = 0; break;
    }
    case 'cover-designer': {
      box(torso, 'paint-apron', 0.158, 0.186, 0.021, p.cream, 0, -0.005, 0.083);
      for (const s of [-1, 1]) rod(group, `easel-leg-${s}`, [s * 0.09, 0.02, 0.145], [0, 0.5, 0.15], 0.011, p.wood);
      const b = board('easel-canvas', -0.035, 0.34, 0.21, 0.22, p.butter);
      ball(b, 'painted-sun', 0.039, p.coral, -0.035, 0.045, 0.018);
      box(b, 'painted-landscape', 0.18, 0.052, 0.01, p.mint, 0, -0.064, 0.02);
      actor = pointer(group, 'painting-brush', 0.11, 0.36, 0.204);
      box(actor, 'brush-ferrule', 0.025, 0.026, 0.022, p.metal, 0, 0.075, 0);
      box(actor, 'brush-bristles', 0.032, 0.036, 0.023, p.coral, 0, 0.1, 0); swing(actor, 'z', 0.57, -0.15); break;
    }
    case 'carousels': {
      cap('card-maker', p.lilac); actor = pivot('fanning-hand', 0, 0.3, 0.16);
      for (let i = 0; i < 5; i++) {
        const c = pivot(`card-hinge-${i}`, 0, 0, i * 0.009, actor);
        box(c, `square-card-${i}`, 0.126, 0.126, 0.008, [p.mint, p.lilac, p.cream, p.butter, p.coral][i], 0, 0.065, 0);
        animate(t => { c.rotation.z = (i - 2) * (0.11 + 0.23 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.6))); });
      }
      swing(actor, 'y', 0.56); break;
    }
    case 'builder': {
      cap('hardhat', p.butter); box(torso, 'builder-vest', 0.2, 0.04, 0.018, p.butter, 0, 0.01, 0.079);
      box(group, 'building-block', 0.145, 0.11, 0.12, p.wood, -0.05, 0.25, 0.13);
      actor = pivot('hammer-swing', 0.115, 0.43, 0.14);
      rod(actor, 'hammer-handle', [0, 0, 0], [-0.04, -0.13, 0], 0.014, p.wood);
      box(actor, 'hammer-head', 0.105, 0.048, 0.05, p.metal, -0.04, -0.13, 0);
      swing(actor, 'z', 0.7, -0.1, 2.2); break;
    }
    case 'scheduler': {
      cap('timekeeper', p.cream);
      const b = board('calendar-stand', 0, 0.335, 0.253, 0.19, p.coral);
      box(b, 'calendar-sheet', 0.225, 0.14, 0.008, p.paper, 0, -0.01, 0.018);
      for (let i = 0; i < 6; i++) box(b, `date-cell-${i}`, 0.034, 0.027, 0.009, i === 4 ? p.coral : p.metal, (i % 3 - 1) * 0.062, 0.017 - Math.floor(i / 3) * 0.052, 0.026);
      for (const s of [-1, 1]) ring(b, `calendar-binding-${s}`, 0.02, 0.006, dark, s * 0.07, 0.092, 0).rotation.y = Math.PI / 2;
      actor = pivot('calendar-page-flip', 0, 0.418, 0.15); box(actor, 'flipping-calendar-leaf', 0.2, 0.13, 0.006, p.paper, 0, -0.064, 0);
      swing(actor, 'x', 0.9, -0.7, 2.8); break;
    }
    case 'poster': {
      cap('dispatch', p.coral);
      box(torso, 'postal-satchel-strap', 0.027, 0.2, 0.018, p.cream, 0, 0, 0.082).rotation.z = -0.45;
      box(group, 'postal-satchel', 0.083, 0.112, 0.069, p.wood, -0.126, 0.25, -0.018);
      cyl(group, 'send-pedestal', 0.024, 0.25, p.metal, -0.09, 0.125, 0.13);
      const b = cyl(group, 'send-button', 0.07, 0.03, p.coral, -0.09, 0.265, 0.13); slide(b, 'y', 0.009, 2.5);
      actor = pivot('paper-plane-flight', 0.055, 0.46, 0.12);
      for (const s of [-1, 1]) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.085, s * 0.085, 0, -0.06, 0, 0.024, -0.02], 3)); geo.computeVertexNormals();
        const mat = p.cream.clone(); mat.side = THREE.DoubleSide; mesh(actor, `plane-wing-${s}`, geo, mat);
      }
      slide(actor, 'y', 0.09, 2.5); swing(actor, 'y', 0.4, -0.2, 2.5); swing(arms[0], 'x', 0.4, -0.65, 2.5); break;
    }
    case 'results-reader': {
      glasses(); tie(p.mint); const b = board('bar-chart', 0, 0.345, 0.25, 0.205, p.cream);
      rod(b, 'chart-baseline', [-0.105, -0.08, 0.02], [0.107, -0.08, 0.02], 0.005, dark);
      const growth = pivot('growing-bars', 0, -0.07, 0.022, b); actor = growth;
      for (let i = 0; i < 3; i++) box(growth, `result-bar-${i}`, 0.04, 0.05 + i * 0.045, 0.02, [p.lilac, p.mint, p.coral][i], (i - 1) * 0.066, (0.05 + i * 0.045) / 2, 0);
      animate(t => { growth.scale.y = 0.55 + 0.4 * Math.sin(t * Math.PI * 2 / 2.6); });
      // The pointing hand travels with the measured top of the chart.
      actor = pivot('chart-top-pointer', 0.11, 0.39, 0.21); rod(actor, 'point-to-results', [0, 0, 0], [-0.05, 0, 0], 0.013, body); slide(actor, 'y', 0.082); break;
    }
    case 'replier': {
      headset(); const b = board('reply-phone', 0.06, 0.31, 0.082, 0.132, dark); box(b, 'reply-screen', 0.065, 0.1, 0.008, p.glow, 0, 0.006, 0.017);
      actor = pivot('conversation', -0.1, 0.445, 0.14);
      for (let i = 0; i < 2; i++) { const b = box(actor, `speech-bubble-${i}`, 0.12, 0.068, 0.027, i ? p.mint : p.cream, i * 0.11, i * 0.12, 0); box(b, `speech-tail-${i}`, 0.024, 0.027, 0.02, i ? p.mint : p.cream, -0.027, -0.035, 0).rotation.z = 0.5; }
      slide(actor, 'y', 0.075, 2.4); swing(arms[1], 'x', 0.18, -0.7, 1.2); break;
    }
    case 'amplifier': {
      cap('promoter', p.butter); actor = pivot('megaphone', 0.08, 0.43, 0.13);
      const horn = cyl(actor, 'megaphone-cone', 0.073, 0.14, p.coral, 0, 0, 0, 0.023); horn.rotation.z = Math.PI / 2;
      const lip = ring(actor, 'megaphone-lip', 0.073, 0.009, p.cream, 0.07, 0, 0); lip.rotation.y = Math.PI / 2;
      rod(actor, 'megaphone-grip', [-0.04, 0, 0], [-0.04, -0.085, 0], 0.016, dark);
      for (let i = 0; i < 2; i++) { const r = ring(group, `sound-pulse-${i}`, 0.04 + i * 0.015, 0.006, p.butter, 0.19, 0.47 + i * 0.035, 0.14); r.rotation.y = Math.PI / 2; animate(t => { r.scale.setScalar(0.7 + 0.3 * Math.sin(t * Math.PI * 2 / 2.5 - i)); }); }
      swing(actor, 'y', 0.57, 0, 2.5); break;
    }
    case 'account-researcher': {
      glasses(); tie(p.butter); const f = board('account-folder', -0.02, 0.32, 0.235, 0.16, p.butter);
      box(f, 'folder-tab', 0.09, 0.029, 0.024, p.butter, -0.06, 0.086, 0);
      actor = pivot('company-dossier', 0.025, 0.39, 0.195); box(actor, 'dossier-page', 0.155, 0.18, 0.008, p.paper); bars(actor, 3, p.metal, 0.11);
      slide(actor, 'y', 0.065, 3); swing(actor, 'y', 0.56, 0, 3); break;
    }
    case 'call-prep': {
      tie(); box(head, 'rehearsal-earpiece', 0.033, 0.064, 0.04, dark, 0.131, 0, 0);
      actor = pivot('cue-card-hinge', 0, 0.34, 0.16);
      for (let i = 0; i < 3; i++) { const c = board(`cue-card-${i}`, i * 0.012, i * 0.013, 0.2, 0.115, i ? p.paper : p.butter, actor); c.position.z = i * 0.012; bars(c, 2, dark, 0.13); if (i === 2) swing(c, 'x', 0.8, 0, 2.6); }
      swing(actor, 'y', 0.55, 0, 2.6); break;
    }
    case 'crm-updater': {
      box(torso, 'crm-pocket', 0.073, 0.06, 0.017, p.mint, -0.05, 0.02, 0.08);
      box(group, 'index-box', 0.245, 0.095, 0.14, p.metal, 0, 0.275, 0.12);
      for (let i = 0; i < 4; i++) box(group, `file-divider-${i}`, 0.2, 0.07, 0.01, [p.mint, p.cream, p.lilac, p.butter][i], 0, 0.32, 0.07 + i * 0.025);
      actor = board('incoming-contact-card', 0.02, 0.425, 0.15, 0.1, p.paper); bars(actor, 2, dark, 0.09);
      slide(actor, 'y', 0.076, 2.4); break;
    }
    case 'notetaker': {
      headset(); book(group, 'meeting-notebook', -0.035, 0.323, 0.16, p.mint, 0.21, 0.17);
      actor = pointer(group, 'fast-note-pen', 0.075, 0.37, 0.21, dark);
      swing(actor, 'z', 0.57, -0.3, 2.05); swing(head, 'x', 0.05, 0.14, 2.05);
      for (let i = 0; i < 4; i++) ring(group, `notebook-binding-${i}`, 0.013, 0.004, p.metal, -0.142, 0.27 + i * 0.033, 0.17); break;
    }
    case 'outbound-drafts': {
      cap('letter-writer', p.cream); envelope(group, 'outgoing-envelope', 0, 0.285, 0.16);
      actor = pivot('folding-letter', 0, 0.38, 0.16);
      box(actor, 'letter-lower-half', 0.155, 0.08, 0.008, p.paper, 0, -0.04, 0); bars(actor, 2, p.metal, 0.1);
      const fold = pivot('letter-fold', 0, 0, 0, actor); box(fold, 'letter-top-half', 0.155, 0.09, 0.008, p.paper, 0, 0.045, 0);
      swing(fold, 'x', 1.1, -0.8, 2.8); slide(actor, 'y', 0.06, 2.8); swing(actor, 'y', 0.56, 0, 2.8);
      ball(group, 'envelope-seal', 0.018, p.coral, 0, 0.28, 0.178); break;
    }
    case 'follow-up': {
      tie(p.coral); actor = group; envelope(group, 'followup-envelope', 0.05, 0.35, 0.15);
      box(arms[0], 'watch-band', 0.067, 0.027, 0.075, dark, 0, -0.065, 0.015);
      const w = cyl(arms[0], 'wristwatch', 0.036, 0.014, p.butter, 0, -0.06, 0.061); w.rotation.x = Math.PI / 2;
      rod(arms[0], 'watch-hand', [0, -0.06, 0.07], [0.018, -0.045, 0.07], 0.004, dark);
      arms[0].rotation.x = -1; slide(group, 'x', 0.08, 2.2); swing(head, 'y', 0.2, 0, 2.2);
      feet.forEach((f, i) => animate(t => { f.position.y = 0.0275 + 0.02 * Math.max(0, Math.sin(t * Math.PI * 4 / 3 + i * Math.PI)); })); break;
    }
    case 'coder': {
      const hood = box(head, 'hoodie-hood', 0.28, 0.248, 0.16, p.lilac, 0, -0.003, -0.034);
      // The hood frames the face; the face and approved mark stay in front.
      hood.position.z = -0.057;
      for (const s of [-1, 1]) rod(torso, `hoodie-cord-${s}`, [s * 0.045, 0.09, 0.085], [s * 0.037, -0.012, 0.089], 0.005, p.cream);
      box(group, 'laptop-keyboard', 0.235, 0.021, 0.14, p.metal, 0, 0.277, 0.12);
      const screen = board('laptop-screen', 0, 0.37, 0.225, 0.15, dark); box(screen, 'lit-display', 0.197, 0.123, 0.008, p.glow, 0, 0, 0.017);
      const code = pivot('scrolling-code', 0, 0, 0.01, screen); bars(code, 3, dark, 0.14); slide(code, 'y', 0.018, 2.2);
      actor = arms[1]; swing(actor, 'x', 0.56, -0.8, 2.2); swing(arms[0], 'x', 0.35, -0.8, 2.2, Math.PI); head.rotation.x = 0.09; break;
    }
    case 'reviewer': {
      glasses(); const page = board('review-printout', -0.04, 0.335, 0.17, 0.218); bars(page, 4, p.metal, 0.12);
      tick(page, 0.035, -0.075, p.coral, 0.43);
      actor = pivot('review-verdict-thumb', 0.14, 0.39, 0.14);
      ball(actor, 'reviewer-fist', 0.031, body); box(actor, 'reviewer-thumb', 0.027, 0.08, 0.035, body, -0.02, 0.043, 0);
      swing(actor, 'z', 0.7, -0.15, 2.8); swing(head, 'y', 0.2, 0, 2.8); break;
    }
    case 'deployer': {
      cap('launch-controller', p.mint);
      cyl(group, 'launch-pad', 0.073, 0.025, p.metal, -0.11, 0.09, 0.12);
      actor = pivot('launching-rocket', -0.11, 0.3, 0.12);
      cyl(actor, 'rocket-body', 0.032, 0.13, p.cream);
      cyl(actor, 'rocket-nose', 0.033, 0.065, p.coral, 0, 0.095, 0, 0);
      ball(actor, 'rocket-window', 0.02, p.mint, 0, 0.023, 0.029);
      for (const s of [-1, 1]) box(actor, `rocket-fin-${s}`, 0.028, 0.065, 0.025, p.coral, s * 0.039, -0.05, 0).rotation.z = -s * 0.3;
      cyl(actor, 'rocket-flame', 0.022, 0.07, p.glow, 0, -0.099, 0, 0);
      slide(actor, 'y', 0.1, 2.8);
      const lever = pivot('launch-lever', 0.135, 0.28, 0.13); rod(lever, 'lever-shaft', [0, 0, 0], [0, 0.12, 0], 0.012, p.metal); ball(lever, 'lever-knob', 0.028, p.coral, 0, 0.12, 0); swing(lever, 'x', 0.6, 0, 2.8); break;
    }
    case 'tester': {
      cap('bug-hunter', p.lilac);
      box(group, 'test-block', 0.22, 0.065, 0.13, p.cream, 0, 0.285, 0.12);
      const bug = pivot('scurrying-bug', -0.04, 0.335, 0.13);
      ball(bug, 'bug-body', 0.025, dark); ball(bug, 'bug-head', 0.016, p.coral, 0.029, 0, 0);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rod(bug, `bug-leg-${s}-${i}`, [-0.018 + i * 0.018, 0, 0], [-0.024 + i * 0.023, -0.01, s * 0.037], 0.004, dark);
      slide(bug, 'x', 0.045, 2.4); actor = magnifier(group, 0.03, 0.44, 0.2); slide(actor, 'x', 0.075, 2.4); head.rotation.x = 0.16; break;
    }
    case 'fixer': {
      box(torso, 'tool-belt', 0.226, 0.045, 0.155, dark, 0, -0.06, 0);
      for (let i = 0; i < 3; i++) box(torso, `belt-tool-${i}`, 0.025, 0.078, 0.024, [p.metal, p.butter, p.coral][i], (i - 1) * 0.06, -0.08, 0.093);
      cyl(group, 'big-bolt', 0.045, 0.09, p.metal, -0.04, 0.29, 0.16);
      actor = pivot('ratchet-wrench', -0.04, 0.345, 0.16);
      rod(actor, 'wrench-shaft', [0, 0, 0], [0.13, 0, 0], 0.016, p.metal);
      const jaw = mesh(actor, 'open-wrench-jaw', new THREE.TorusGeometry(0.036, 0.012, 8, 16, Math.PI * 1.55), p.metal); jaw.rotation.x = Math.PI / 2;
      ball(actor, 'wrench-grip', 0.025, dark, 0.13, 0, 0); swing(actor, 'y', 0.68, 0, 2.4); break;
    }
    case 'librarian': {
      glasses(true); box(torso, 'librarian-cardigan', 0.04, 0.195, 0.02, p.cream, -0.055, -0.005, 0.08);
      for (const s of [-1, 1]) box(group, `shelf-upright-${s}`, 0.016, 0.48, 0.08, p.wood, -0.16 + s * 0.055, 0.24, -0.08);
      for (let i = 0; i < 2; i++) box(group, `library-shelf-${i}`, 0.14, 0.019, 0.12, p.wood, -0.16, 0.15 + i * 0.24, -0.07);
      actor = book(group, 'shelving-book', -0.075, 0.35, 0.11, p.coral, 0.115, 0.15); slide(actor, 'y', 0.105, 3); swing(actor, 'y', 0.25, 0, 3); break;
    }
    case 'file-archive': {
      cap('records-clerk', p.metal);
      box(group, 'filing-cabinet', 0.205, 0.255, 0.13, p.metal, -0.035, 0.25, 0.06);
      box(group, 'closed-drawer', 0.181, 0.105, 0.018, p.cream, -0.035, 0.19, 0.134);
      actor = pivot('opening-file-drawer', -0.035, 0.31, 0.15);
      box(actor, 'drawer-front', 0.184, 0.104, 0.018, p.cream); box(actor, 'drawer-handle', 0.066, 0.014, 0.022, dark, 0, 0, 0.018);
      box(actor, 'file-in-drawer', 0.14, 0.1, 0.012, p.butter, 0, 0.055, -0.025);
      slide(actor, 'z', 0.105, 2.7); pen(head, 'archive-pencil', -0.13, 0.02, 0, p.butter); break;
    }
    case 'content-archive': {
      cap('projectionist', dark);
      function reel(parent, name, x, y, z) {
        const r = pivot(name, x, y, z, parent); const disk = cyl(r, `${name}-disk`, 0.073, 0.026, p.metal); disk.rotation.x = Math.PI / 2;
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ball(r, `${name}-spoke-hole-${i}`, 0.018, dark, Math.cos(a) * 0.043, Math.sin(a) * 0.043, 0.015); }
        ball(r, `${name}-hub`, 0.014, p.butter, 0, 0, 0.017); return r;
      }
      reel(group, 'stored-reel', -0.1, 0.255, 0.13);
      box(group, 'video-tape', 0.155, 0.065, 0.085, dark, 0.025, 0.19, 0.12);
      box(group, 'tape-label', 0.11, 0.032, 0.008, p.cream, 0.025, 0.195, 0.166);
      actor = reel(group, 'stacking-reel', 0.055, 0.39, 0.16); slide(actor, 'y', 0.098, 2.9); swing(actor, 'z', 0.25, 0, 2.9); break;
    }
    case 'inspiration-house': {
      cap('curator-beret', p.coral);
      const b = board('mood-board', -0.025, 0.35, 0.26, 0.24, p.wood);
      for (let i = 0; i < 4; i++) { const c = box(b, `pinned-picture-${i}`, 0.088, 0.074, 0.008, [p.lilac, p.mint, p.cream, p.butter][i], (i % 2 - 0.5) * 0.113, (Math.floor(i / 2) - 0.5) * 0.11, 0.018); c.rotation.z = i % 2 ? 0.12 : -0.1; ball(c, `picture-pin-${i}`, 0.009, p.coral, 0, 0.026, 0.01); }
      actor = pivot('pinning-hand', 0.13, 0.415, 0.21); ball(actor, 'pinching-fingers', 0.025, body); pen(actor, 'pushpin', -0.025, -0.03, 0, p.coral); swing(actor, 'z', 0.56, -0.4); break;
    }
    case 'taste-standards': {
      tie(p.butter); cyl(group, 'scales-pedestal', 0.055, 0.025, p.wood, 0, 0.22, 0.15);
      rod(group, 'scales-post', [0, 0.22, 0.15], [0, 0.48, 0.15], 0.012, p.butter);
      actor = pivot('balancing-beam', 0, 0.48, 0.15); box(actor, 'scales-crossbar', 0.29, 0.018, 0.022, p.butter);
      for (const s of [-1, 1]) {
        const pan = pivot(`scale-pan-${s}`, s * 0.123, 0, 0, actor);
        rod(pan, `pan-chain-${s}`, [0, 0, 0], [0, -0.12, 0], 0.005, p.metal);
        const dish = cyl(pan, `pan-dish-${s}`, 0.049, 0.024, p.butter, 0, -0.127, 0, 0.06);
        ball(pan, `weighed-sample-${s}`, 0.027, s < 0 ? p.coral : p.mint, 0, -0.106, 0);
        animate(t => { pan.rotation.z = -0.56 * Math.sin(t * Math.PI * 2 / 3); }); dish.name = `pan-dish-${s}`;
      }
      swing(actor, 'z', 0.56, 0, 3); break;
    }
    case 'auditor': {
      cap('accountant-visor', p.mint); glasses();
      const b = board('long-audit-roll', -0.025, 0.315, 0.175, 0.285, p.paper);
      for (let i = 0; i < 5; i++) { box(b, `audit-line-${i}`, 0.08, 0.009, 0.008, p.metal, 0.026, 0.105 - i * 0.046, 0.017); tick(b, -0.049, 0.101 - i * 0.046, p.mint, 0.28); }
      const curl = cyl(b, 'checklist-curl', 0.024, 0.17, p.paper, 0, -0.14, 0); curl.rotation.z = Math.PI / 2;
      actor = pointer(group, 'audit-pen', 0.1, 0.34, 0.204, dark); slide(actor, 'y', 0.105, 3); break;
    }
    case 'analyst': {
      tie(p.mint); glasses(); actor = pivot('turning-pie-chart', 0, 0.36, 0.16);
      const mat = p.lilac.clone(); mat.side = THREE.DoubleSide;
      mesh(actor, 'pie-remainder', new THREE.CircleGeometry(0.115, 28, Math.PI * 0.55, Math.PI * 1.45), mat);
      const sliceMat = p.butter.clone(); sliceMat.side = THREE.DoubleSide;
      mesh(actor, 'exploded-pie-slice', new THREE.CircleGeometry(0.115, 16, 0, Math.PI * 0.55), sliceMat, 0.012, 0.012, 0.002);
      ring(actor, 'pie-chart-rim', 0.117, 0.006, p.cream);
      rod(group, 'analyst-point', [0.14, 0.35, 0.04], [0.09, 0.43, 0.18], 0.024, body);
      swing(actor, 'z', 0.59, 0, 3); break;
    }
    case 'trend-spotter': {
      cap('market-watcher', p.butter); const b = board('rising-line-chart', -0.02, 0.34, 0.25, 0.19, p.cream);
      const points = [[-0.1, -0.055, 0.021], [-0.04, -0.017, 0.021], [0.005, -0.03, 0.021], [0.085, 0.07, 0.021]];
      for (let i = 0; i < 3; i++) rod(b, `trend-segment-${i}`, points[i], points[i + 1], 0.009, p.coral);
      rod(b, 'up-arrow-a', [0.085, 0.07, 0.021], [0.052, 0.066, 0.021], 0.008, p.coral);
      rod(b, 'up-arrow-b', [0.085, 0.07, 0.021], [0.086, 0.033, 0.021], 0.008, p.coral);
      actor = pivot('tracing-finger', 0, 0.36, 0.21); ball(actor, 'trend-fingertip', 0.018, body);
      slide(actor, 'x', 0.08, 2.7); slide(actor, 'y', 0.05, 2.7); break;
    }
    case 'learnings': {
      cap('learner-beret', p.lilac); const b = book(group, 'lesson-notebook', -0.025, 0.33, 0.15, p.lilac, 0.225, 0.21);
      for (let i = 0; i < 2; i++) box(b, `saved-lesson-${i}`, 0.075, 0.071, 0.009, i ? p.butter : p.mint, -0.045 + i * 0.08, i ? -0.055 : 0.055, 0.035).rotation.z = i ? 0.1 : -0.1;
      actor = pivot('new-sticky-lesson', 0.11, 0.405, 0.2); box(actor, 'sticky-note', 0.105, 0.105, 0.009, p.coral);
      box(actor, 'sticky-fold', 0.025, 0.025, 0.012, p.butter, 0.04, -0.04, 0.005).rotation.z = 0.3;
      swing(actor, 'y', 0.58, 0, 2.7); slide(actor, 'x', 0.04, 2.7); break;
    }
    case 'chief-of-staff': {
      headset(); tie(p.butter);
      for (const s of [-1, 1]) {
        box(torso, `chief-epaulette-${s}`, 0.075, 0.025, 0.11, p.butter, s * 0.095, 0.094, 0);
        rod(torso, `lanyard-${s}`, [s * 0.048, 0.1, 0.086], [0, -0.025, 0.096], 0.006, p.mint);
        box(torso, `jacket-button-${s}`, 0.013, 0.013, 0.012, p.butter, s * 0.025, -0.064, 0.081);
      }
      box(torso, 'chief-id-badge', 0.052, 0.065, 0.014, p.cream, 0, -0.046, 0.102);
      ball(torso, 'badge-photo', 0.011, dark, 0, -0.035, 0.113);
      const b = board('chief-running-orders', -0.12, 0.337, 0.12, 0.202, p.wood);
      box(b, 'orders-sheet', 0.103, 0.176, 0.009, p.paper, 0, 0, 0.018); bars(b, 3, dark, 0.073);
      box(b, 'orders-clip', 0.049, 0.021, 0.019, p.metal, 0, 0.1, 0.02);
      actor = pivot('dispatching-arm', 0.115, 0.395, 0.04);
      rod(actor, 'chief-pointing-sleeve', [0, 0, 0], [0.057, 0.027, 0.073], 0.028, body);
      rod(actor, 'chief-index-finger', [0.057, 0.027, 0.073], [0.097, 0.054, 0.11], 0.013, body);
      ball(actor, 'chief-cuff', 0.029, p.cream, 0.06, 0.03, 0.075);
      pen(head, 'chief-spare-pencil', -0.143, 0.005, -0.018, p.butter);
      swing(actor, 'y', 0.7, -0.25, 2.8); swing(head, 'y', 0.25, 0, 2.8); break;
    }
    case 'courier': {
      cap('courier', p.coral); actor = group;
      box(group, 'delivery-parcel', 0.255, 0.2, 0.16, p.wood, 0, 0.35, 0.16);
      box(group, 'parcel-tape-horizontal', 0.259, 0.03, 0.008, p.cream, 0, 0.35, 0.245);
      box(group, 'parcel-tape-vertical', 0.033, 0.202, 0.008, p.cream, 0, 0.35, 0.247);
      for (const s of [-1, 1]) {
        rod(group, `parcel-holding-arm-${s}`, [s * 0.14, 0.35, 0.02], [s * 0.135, 0.32, 0.18], 0.027, body);
        ball(group, `parcel-grip-${s}`, 0.031, body, s * 0.128, 0.33, 0.2);
      }
      // The scene supplies lift travel; this group only bounces and sways.
      animate(t => { group.position.y = 0.031 + 0.03 * Math.sin(t * Math.PI * 2 / 2.3); });
      swing(group, 'y', 0.4, 0, 2.3); break;
    }
  }
  // Costume panels are deliberately narrow so the caller's body pigment dominates.
  function lapels(name, mat, length=.17) {
    for(const side of [-1,1]) {
      const panel=box(torso,`${name}-panel-${side}`,.049,length,.02,mat,side*(width*.31),-.004,.076);
      panel.rotation.z=side*.13;
      box(torso,`${name}-pocket-${side}`,.044,.034,.014,mat,side*(width*.31),-.047,.09);
    }
  }
  if(role==='call-prep') lapels('meeting-jacket',p.lilac,.205);
  if(role==='fixer') { lapels('work-vest',p.butter,.15); box(torso,'vest-zip',.013,.12,.012,p.metal,0,.025,.083); }
  if(role==='tester') {
    lapels('lab-coat',p.cream,.20);
    for(const side of [-1,1]) box(arms[side<0?0:1],`lab-coat-cuff-${side}`,.063,.035,.074,p.cream,0,-.06,.005);
    for(const a of arms) box(a,`${a.name}-coat-sleeve`,.065,.075,.076,p.cream,0,-.022,0);
    pen(torso,'coat-pocket-pen',-.075,.025,.103,p.coral);
  }
  if(role==='librarian') { lapels('knitted-cardigan',p.lilac,.20); for(let i=0;i<3;i++) ball(torso,`cardigan-button-${i}`,.008,p.cream,.023,.06-i*.04,.084); }
  if(role==='taste') {
    cyl(torso,'scarf-wrap',.095,.045,p.lilac,0,.14,.009).scale.z=.83;
    box(torso,'scarf-long-tail',.044,.148,.025,p.lilac,.053,.016,.093).rotation.z=-.22;
    for(let i=0;i<3;i++) rod(torso,`scarf-fringe-${i}`,[.04+i*.012,-.05,.099],[.037+i*.012,-.084,.099],.004,p.lilac);
  }
  if(role==='judgement') { lapels('robe',dark,.17); box(torso,'judge-white-jabot',.071,.092,.022,p.cream,0,.06,.098); }
  if(role==='cover-designer') {
    for(const side of [-1,1]) rod(torso,`apron-strap-${side}`,[side*.055,.112,.082],[side*.065,.025,.096],.009,p.cream);
    box(torso,'apron-paint-pocket',.09,.05,.012,p.lilac,0,-.044,.105);
  }
  // Every face has its own eyebrows and a readable mouth, below the logo's reserved rectangle.
  const severe=['stern','skeptic','squint','review'].includes(expression);
  const brows=[-1,1].map(side=>{
    const b=box(head,`eyebrow-${side}`,.058,.013,.012,dark,side*.056,.072,.105);
    b.rotation.z=side*(severe?.27:expression==='curious'?-.19:-.07);
    return b;
  });
  if(expression==='wry'||expression==='grin') brows[0].rotation.z=-.24;
  const mouthY=spec.head==='human'?-.043:-.091;
  function mouth(name,smile) {
    const corners=smile ? .006 : -.004, middle=smile ? -.008 : .009;
    const points=[new THREE.Vector3(-.037,mouthY+corners,.108),new THREE.Vector3(0,mouthY+middle,.111),new THREE.Vector3(.037,mouthY+corners,.108)];
    return mesh(head,name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.0055,6,false),dark);
  }
  const smile=mouth('mouth',!severe);
  if(expression==='grin'||expression==='wry') smile.rotation.z=expression==='grin'?.13:-.09;
  if(expression==='sing') { smile.visible=false; ring(head,'singing-mouth',.019,.006,dark,0,mouthY,.11).scale.y=1.3; }
  if(role==='reviewer') {
    const approval=mouth('approval-smile',true);
    animate(t=>{const yes=Math.sin(t*Math.PI*2/2.8)>.05;smile.visible=!yes;approval.visible=yes;brows.forEach((b,i)=>{b.rotation.z=(i?1:-1)*(yes?-.08:.27);});});
  }
  // The body, shoulders, head and hat lean together, while the dark logo-bearing legs stay planted.
  const posture=pivot('job-posture',0,.18,0);
  const anatomy=[torso,head,...arms,...group.children.filter(o=>o.name.endsWith('-hat'))];
  for(const o of anatomy){posture.add(o);o.position.y-=.18;}
  posture.rotation.x=lean; posture.rotation.z=attitude;
  const headBaseY=head.position.y;
  animate(t=>{head.position.y=headBaseY+.003*Math.sin(t*Math.PI*2/3.4);});
  const openness=expression==='squint'?.36:severe?.72:1;
  animate(t=>{const blink=.22+.78*Math.min(1,Math.abs(Math.sin(t*Math.PI/3.7))*14);eyes.forEach(e=>{e.scale.y=openness*blink;});});

  // Stage the recognisable held tools larger and at chest height. These wrappers leave
  // each action's original local coordinates intact, so scrubbing remains deterministic.
  const held = new Set([
    'telescope-sweep','gavel-strike','easy-sip','phone','swatch--1','swatch-1','standards-clipboard','checking-pencil',
    'tablet','swiping-finger','binocular-scan','search-terminal','search-answer','eureka-bulb',
    'rank-card-1','rank-card-2','rank-card-3','left-open-cover','right-open-cover','page-turn-hinge',
    'source-page','magnifier','red-check-pen','typewriter-base','typewriter-carriage','waveform-card','approval-thumb',
    'three-clear-points','coach-pointer','clapperboard','clapper-hinge','floating-music-note','motion-path','drawing-stylus',
    'easel-canvas','painting-brush','fanning-hand','hammer-swing','building-block','calendar-stand','calendar-page-flip',
    'paper-plane-flight','bar-chart','chart-top-pointer','reply-phone','conversation','megaphone','account-folder','company-dossier',
    'cue-card-hinge','index-box','incoming-contact-card','meeting-notebook','fast-note-pen','outgoing-envelope','folding-letter',
    'followup-envelope','laptop-keyboard','laptop-screen','review-printout','review-verdict-thumb','launching-rocket','launch-lever',
    'test-block','scurrying-bug','ratchet-wrench','big-bolt','shelving-book','opening-file-drawer','stored-reel','stacking-reel','video-tape',
    'mood-board','pinning-hand','balancing-beam','long-audit-roll','audit-pen','turning-pie-chart','rising-line-chart','tracing-finger',
    'lesson-notebook','new-sticky-lesson','chief-running-orders','dispatching-arm','delivery-parcel','parcel-tape-horizontal','parcel-tape-vertical',
  ]);
  const shared = {
    judgement: [/gavel-strike|sound-block/, [.04,.35,.14]],
    researcher: [/left-open-cover|right-open-cover|page-turn-hinge/, [0,.34,.16]],
    scriptwriter: [/typewriter-/, [0,.31,.12]],
    'video-editor': [/clapperboard|clapper-hinge/, [0,.35,.163]],
    scheduler: [/calendar-stand|calendar-page-flip/, [0,.35,.163]],
    coder: [/laptop-keyboard|laptop-screen/, [0,.32,.14]],
    fixer: [/ratchet-wrench|big-bolt/, [-.04,.32,.16]],
    tester: [/test-block|scurrying-bug|magnifier/, [0,.35,.16]],
    'crm-updater': [/index-box|incoming-contact-card|file-divider/, [0,.34,.14]],
    'outbound-drafts': [/outgoing-envelope|folding-letter|envelope-seal/, [0,.32,.16]],
    'file-archive': [/filing-cabinet|closed-drawer|opening-file-drawer/, [-.035,.27,.1]],
    courier: [/delivery-parcel|parcel-tape|parcel-holding-arm|parcel-grip/, [0,.35,.16]],
    'taste-standards': [/balancing-beam|scales-pedestal|scales-post/, [0,.36,.15]],
  };
  for(const o of [...group.children]) {
    const family=shared[role], linked=family && family[0].test(o.name);
    if(!held.has(o.name)&&!linked)continue;
    const scale=role==='idea-ranker'?1.17:role==='taste'?1.25:role==='taste-standards'?1.32:1.42;
    const stage=pivot(`${o.name}-stage`);
    const anchor=linked?new THREE.Vector3(...family[1]):o.position;
    const desiredX=anchor.x*.8;
    const desiredY=o.name==='launching-rocket'?.34:anchor.y<.23?anchor.y:.34+(anchor.y-.35)*.8;
    const depthScale=role==='courier'?scale:.86;
    const front=o.name==='dispatching-arm'?.1:role==='file-archive'?.125:role==='call-prep'?.15:.17;
    stage.position.set(desiredX-anchor.x*scale,desiredY-anchor.y*scale,front-anchor.z*depthScale);
    stage.scale.set(scale,scale,depthScale); stage.add(o);
  }
  // Articulated elbows keep the hands on the tools through the whole action.
  // Targets are in the tool's local space, so the scene can place/rotate the figurine freely.
  const handTargets = {
    vision: ['telescope-sweep',[-.06,-.015,0],'telescope-sweep',[.08,-.015,0]],
    judgement: ['sound-block',[-.03,.03,0],'gavel-strike',[-.025,-.055,0]],
    ceo: ['phone',[0,-.025,0],'easy-sip',[.045,0,0]],
    taste: ['swatch--1',[0,-.055,0],'swatch-1',[0,-.055,0]],
    standards: ['standards-clipboard',[-.065,-.06,0],'checking-pencil',[0,0,0]],
    'link-reader': ['tablet',[-.085,-.045,0],'swiping-finger',[0,0,0]],
    'inspiration-scout': ['binocular-scan',[-.065,-.025,0],'binocular-scan',[.065,-.025,0]],
    'search-probe': ['terminal-keys',[-.06,.02,.02],'terminal-keys',[.06,.02,.02]],
    'idea-ranker': ['rank-card-1',[0,-.05,0],'rank-card-3',[0,-.05,0]],
    researcher: ['left-open-cover',[-.04,-.05,0],'page-turn-hinge',[.08,-.04,0]],
    'fact-checker': ['source-page',[-.065,-.055,0],'magnifier',[.015,-.09,0]],
    scriptwriter: ['typewriter-base',[-.065,.035,.035],'typewriter-base',[.065,.035,.035]],
    'voice-checker': ['waveform-card',[-.07,-.04,0],'approval-thumb',[0,-.015,0]],
    'clarity-coach': ['three-clear-points',[-.08,-.04,0],'coach-pointer',[0,-.025,0]],
    'video-editor': ['clapperboard',[-.09,-.04,0],'clapper-hinge',[.15,0,0]],
    'voice-music': [null,null,'microphone',[0,-.025,0]],
    'motion-designer': [null,null,'drawing-stylus',[.095,0,0]],
    'cover-designer': [null,null,'painting-brush',[0,-.025,0]],
    carousels: ['fanning-hand',[-.025,.015,0],'fanning-hand',[.025,.015,0]],
    builder: ['building-block',[-.035,.04,0],'hammer-swing',[-.02,-.06,0]],
    scheduler: ['calendar-stand',[-.09,-.055,0],'calendar-page-flip',[.07,-.08,0]],
    poster: ['send-button',[0,.025,0],null,null],
    'results-reader': ['bar-chart',[-.09,-.065,0],'chart-top-pointer',[0,0,0]],
    replier: ['reply-phone',[-.03,-.04,0],'reply-phone',[.03,0,.025]],
    amplifier: [null,null,'megaphone',[-.04,-.06,0]],
    'account-researcher': ['account-folder',[-.08,-.05,0],'company-dossier',[.055,-.06,0]],
    'call-prep': ['cue-card-hinge',[-.075,-.04,0],'cue-card-hinge',[.075,-.04,0]],
    'crm-updater': ['index-box',[-.09,.02,0],'incoming-contact-card',[.045,-.03,0]],
    notetaker: ['meeting-notebook',[-.075,-.05,0],'fast-note-pen',[0,-.015,0]],
    'outbound-drafts': ['outgoing-envelope',[-.065,0,0],'folding-letter',[.055,0,0]],
    'follow-up': [null,null,'followup-envelope',[.055,-.03,0]],
    coder: ['laptop-keyboard',[-.065,.02,.015],'laptop-keyboard',[.065,.02,.015]],
    reviewer: ['review-printout',[-.055,-.07,0],'review-verdict-thumb',[0,-.015,0]],
    deployer: [null,null,'launch-lever',[0,.11,0]],
    tester: ['test-block',[-.075,.03,0],'magnifier',[.015,-.09,0]],
    fixer: ['big-bolt',[-.025,.025,0],'ratchet-wrench',[.12,0,0]],
    librarian: ['shelving-book',[-.035,-.05,0],'shelving-book',[.04,-.05,0]],
    'file-archive': ['filing-cabinet',[-.07,.08,0],'opening-file-drawer',[.035,0,.02]],
    'content-archive': ['stored-reel',[-.045,-.035,0],'stacking-reel',[.045,-.035,0]],
    'inspiration-house': ['mood-board',[-.09,-.07,0],'pinning-hand',[0,0,0]],
    'taste-standards': [null,null,null,null],
    auditor: ['long-audit-roll',[-.065,-.06,0],'audit-pen',[0,0,0]],
    analyst: [null,null,'turning-pie-chart',[.075,.045,.02]],
    'trend-spotter': ['rising-line-chart',[-.09,-.06,0],'tracing-finger',[0,0,0]],
    learnings: ['lesson-notebook',[-.08,-.07,0],'new-sticky-lesson',[.035,-.03,0]],
    'chief-of-staff': ['chief-running-orders',[-.03,-.06,0],null,null],
  };
  const reachers=[];
  let workingTime=0;
  const targets=handTargets[role];
  if(targets) for(let i=0;i<2;i++) {
    if(!targets[i*2])continue;
    const target=group.getObjectByName(targets[i*2]);
    const arm=arms[i], hand=arm.getObjectByName(`hand-${i?1:-1}`), sleeve=arm.getObjectByName(`sleeve-${i?1:-1}`);
    const elbow=ball(arm,`elbow-${i}`, .026,body);
    const forearm=cyl(arm,`forearm-${i}`,.024,1,body);
    const point=new THREE.Vector3(...targets[i*2+1]);
    reachers.push(()=>{
      const fingertip=point.clone();
      if(role==='coder'||role==='scriptwriter')fingertip.y+=.014*(1+Math.sin(workingTime*Math.PI*2/1.2+i*Math.PI));
      const grip=arm.worldToLocal(target.localToWorld(fingertip));
      const bend=new THREE.Vector3(grip.x*.3,Math.min(-.035,grip.y*.55),Math.max(.035,grip.z*.55));
      elbow.position.copy(bend);hand.position.copy(grip);
      sleeve.position.copy(bend).multiplyScalar(.5);sleeve.scale.y=bend.length()/.1;
      sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bend.clone().normalize());
      const delta=grip.clone().sub(bend);
      forearm.position.copy(grip).add(bend).multiplyScalar(.5);forearm.scale.y=delta.length();
      forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
      for(const cuff of arm.children.filter(o=>o.name.startsWith('lab-coat-cuff')))cuff.position.copy(bend);
      for(const coat of arm.children.filter(o=>o.name.endsWith('coat-sleeve'))){coat.position.copy(sleeve.position);coat.quaternion.copy(sleeve.quaternion);coat.scale.y=bend.length()/.075;}
    });
  }
  if (!actor) throw new Error(`Role has no actor: ${role}`);
  function update(t) {
    const phaseTime = t + (spec.seed ?? 0);
    for (const fn of motions) fn(phaseTime);
    workingTime=phaseTime;
    group.updateWorldMatrix(true,true);
    for(const reach of reachers)reach();
  }
  // Initialise the same pose whether or not the caller immediately supplies a time.
  update(0);
  return { group: placement, update, actor };
}
