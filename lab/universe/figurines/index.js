// A small toy cast. All pigment and decals belong to the calling scene.
export const PERSONALITIES = [
  'sipper', 'stamper', 'scanner', 'binoculars', 'bulb', 'pageflip',
  'typist', 'skeptic', 'bobber', 'pentap', 'talker', 'button',
  'waver', 'caller', 'pacer', 'magnifier', 'wrench', 'filer', 'chin', 'courier',
];

export function makeFigurine(THREE, spec) {
  if (!PERSONALITIES.includes(spec.personality)) throw new Error('Unknown figurine personality');
  const p = spec.personality;
  const group = new THREE.Group();
  group.name = `figurine-${p}`;
  const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  const body = material(spec.body), dark = material(spec.accent), skin = material(spec.skin ?? spec.body);
  function mesh(parent, name, geometry, mat, x = 0, y = 0, z = 0) {
    const obj = new THREE.Mesh(geometry, mat);
    obj.name = name; obj.position.set(x, y, z); parent.add(obj); return obj;
  }
  function ball(parent, name, radius, mat, x, y, z) {
    return mesh(parent, name, new THREE.SphereGeometry(radius, 20, 12), mat, x, y, z);
  }
  // Rounded cuboids without an addon: a bevelled, centred extrusion.
  function box(parent, name, w, h, d, mat, x = 0, y = 0, z = 0) {
    const r = Math.min(w, h, d) * 0.17;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2 + r);
    shape.lineTo(w / 2 - r, -h / 2 + r);
    shape.lineTo(w / 2 - r, h / 2 - r);
    shape.lineTo(-w / 2 + r, h / 2 - r); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, steps: 1,
      bevelEnabled: true, bevelSegments: 3, bevelSize: r, bevelThickness: r, curveSegments: 6 });
    geo.translate(0, 0, -d / 2 + r);
    return mesh(parent, name, geo, mat, x, y, z);
  }
  function pivot(name, x, y, z, parent = group) {
    const obj = new THREE.Group(); obj.name = name; obj.position.set(x, y, z); parent.add(obj); return obj;
  }
  function decal(parent, name, texture, w, h, x, y, z) {
    if (!texture) return;
    const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true,
      roughness: 0.9, metalness: 0, depthWrite: false });
    mesh(parent, name, new THREE.PlaneGeometry(w, h), mat, x, y, z);
  }
  const legs = [-1, 1].map((side) => {
    const leg = pivot(side < 0 ? 'left-hip' : 'right-hip', side * 0.063, 0.18, 0);
    box(leg, `${leg.name}-thigh`, 0.095, 0.15, 0.105, body, 0, -0.065, 0);
    box(leg, `${leg.name}-shoe`, 0.102, 0.055, 0.135, dark, 0, -0.1525, 0.009);
    decal(leg, `${leg.name}-logo`, spec.legLogo, 0.057, 0.057, 0, -0.05, 0.054);
    return leg;
  });
  box(group, 'torso', 0.225, 0.225, 0.14, body, 0, 0.288, 0);
  box(group, 'collar', 0.095, 0.035, 0.09, dark, 0, 0.405, 0);
  const head = pivot('head-pivot', 0, 0.509, 0);
  if (spec.head === 'human') {
    ball(head, 'human-head', 0.119, skin, 0, 0, 0);
    const cap = mesh(head, 'hair-cap', new THREE.SphereGeometry(0.122, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), dark);
    cap.position.y = 0.001;
  } else {
    box(head, 'bot-head', 0.255, 0.225, 0.19, body);
    box(head, 'bot-flat-face-panel', 0.203, 0.147, 0.008, body, 0, -0.01, 0.098);
    decal(head, 'head-logo', spec.headLogo, 0.105, 0.075, 0, -0.035, 0.104);
  }
  for (const side of [-1, 1]) {
    ball(head, side < 0 ? 'left-eye' : 'right-eye', 0.013, dark, side * 0.057, 0.025, spec.head === 'human' ? 0.103 : 0.105);
  }
  const arms = [-1, 1].map((side) => {
    const arm = pivot(side < 0 ? 'left-shoulder' : 'right-shoulder', side * 0.147, 0.36, 0);
    box(arm, `${arm.name}-sleeve`, 0.069, 0.116, 0.078, body, 0, -0.045, 0);
    ball(arm, `${arm.name}-hand`, 0.038, spec.head === 'human' ? skin : body, 0, -0.105, 0.007);
    return arm;
  });
  let actor = arms[1];
  let animate = () => {};
  const prop = pivot('held-prop', 0, -0.095, 0.035, actor);
  function cylinder(parent, name, radius, height, mat, x = 0, y = 0, z = 0) {
    return mesh(parent, name, new THREE.CylinderGeometry(radius, radius, height, 20), mat, x, y, z);
  }
  function ring(parent, name, radius, tube, x, y, z) {
    return mesh(parent, name, new THREE.TorusGeometry(radius, tube, 8, 24), dark, x, y, z);
  }
  // Reparenting preserves the neutral pose and makes the actor a truthful boundary.
  function combine(name, parts) {
    const a = pivot(name, 0, 0, 0);
    for (const part of parts) a.add(part);
    return a;
  }
  if (['scanner', 'skeptic', 'bobber', 'chin'].includes(p)) {
    actor = head;
    if (p === 'chin') {
      actor = combine('thinking-head-and-hand', [head, arms[1]]);
      arms[1].rotation.x = -1.9; arms[1].rotation.z = -0.45;
    }
    animate = (q, phase) => {
      head.rotation.y = p === 'scanner' ? (q - 0.5) * 0.9 : p === 'skeptic' && phase < 0.6 ? (q - 0.5) * 0.8 : 0;
      if (p === 'chin') actor.rotation.x = -q * 0.38;
      head.rotation.x = p === 'bobber' || (p === 'skeptic' && phase >= 0.6) ? -q * 0.38 : 0;
    };
  } else if (p === 'bulb') {
    actor = pivot('idea-bulb', 0, 0.655, 0);
    ball(actor, 'bulb-globe', 0.025, body, 0, 0, 0);
    cylinder(actor, 'bulb-socket', 0.014, 0.02, dark, 0, -0.027, 0);
    animate = (q) => { actor.position.y = 0.625 + q * 0.043; actor.scale.setScalar(0.7 + q * 0.3); };
  } else if (p === 'pacer' || p === 'courier') {
    actor = group;
    if (p === 'courier') {
      box(group, 'courier-parcel', 0.19, 0.14, 0.105, body, 0, 0.292, 0.11);
      box(group, 'parcel-band', 0.03, 0.144, 0.108, dark, 0, 0.292, 0.11);
      arms.forEach((a) => { a.rotation.x = -0.8; });
    }
    animate = (q, phase) => {
      group.position.x = p === 'pacer' ? (q - 0.5) * 0.3 : 0;
      group.position.y = p === 'courier' ? q * 0.047 : 0;
      legs[0].rotation.x = Math.sin(phase * Math.PI * 4) * 0.3;
      legs[1].rotation.x = -legs[0].rotation.x;
    };
  } else {
    if (p === 'sipper') {
      cylinder(prop, 'mug', 0.032, 0.061, body);
      cylinder(prop, 'mug-drink', 0.025, 0.003, dark, 0, 0.031, 0);
      ring(prop, 'mug-handle', 0.022, 0.007, 0.037, 0, 0);
    } else if (p === 'stamper') {
      cylinder(prop, 'stamp-handle', 0.018, 0.062, dark);
      box(prop, 'stamp-foot', 0.075, 0.022, 0.06, body, 0, -0.04, 0);
    } else if (p === 'binoculars') {
      actor = combine('binocular-sweep', [head, arms[0], arms[1]]);
      for (const x of [-0.045, 0.045]) {
        const tube = cylinder(head, `binocular-barrel-${x}`, 0.032, 0.065, dark, x, 0, 0.12);
        tube.rotation.x = Math.PI / 2;
      }
      arms.forEach((a) => { a.rotation.x = -2; });
    } else if (p === 'pageflip') {
      box(group, 'book-cover', 0.17, 0.016, 0.12, dark, 0, 0.29, 0.105);
      actor = pivot('page-hinge', -0.065, 0.303, 0.1);
      box(actor, 'turning-page', 0.13, 0.008, 0.105, body, 0.065, 0, 0);
    } else if (p === 'typist') {
      box(group, 'laptop-base', 0.19, 0.018, 0.105, dark, 0, 0.258, 0.104);
      box(group, 'laptop-screen', 0.19, 0.105, 0.016, body, 0, 0.312, 0.15);
      actor = combine('typing-hands', arms);
    } else if (p === 'pentap') {
      cylinder(prop, 'pen', 0.008, 0.108, dark);
    } else if (p === 'button') {
      box(group, 'button-base', 0.115, 0.025, 0.09, dark, 0.08, 0.22, 0.105);
      cylinder(group, 'big-button', 0.041, 0.023, body, 0.08, 0.243, 0.105);
    } else if (p === 'caller') {
      ring(head, 'headset-band', 0.126, 0.008, 0, 0, 0);
      ball(head, 'headset-earpiece', 0.026, dark, -0.12, 0, 0);
      box(head, 'headset-mic', 0.065, 0.012, 0.013, dark, -0.09, -0.058, 0.1);
      actor = combine('caller-head-and-hand', [head, arms[1]]);
    } else if (p === 'magnifier') {
      ring(prop, 'magnifier-rim', 0.043, 0.009, 0, 0.06, 0);
      cylinder(prop, 'magnifier-handle', 0.012, 0.067, dark);
    } else if (p === 'wrench') {
      box(prop, 'wrench-shaft', 0.018, 0.09, 0.02, dark);
      box(prop, 'wrench-jaw-left', 0.016, 0.04, 0.024, dark, -0.024, 0.055, 0);
      box(prop, 'wrench-jaw-right', 0.016, 0.04, 0.024, dark, 0.024, 0.055, 0);
      box(prop, 'wrench-jaw-base', 0.06, 0.018, 0.024, dark, 0, 0.033, 0);
    } else if (p === 'filer') {
      actor = combine('box-lifting-arms', arms);
      box(actor, 'filing-box', 0.17, 0.12, 0.11, body, 0, 0.27, 0.105);
      box(actor, 'filing-box-label', 0.08, 0.03, 0.006, dark, 0, 0.28, 0.163);
    }
    animate = (q) => {
      if (p === 'binoculars') actor.rotation.y = (q - 0.5) * 0.7;
      else if (p === 'pageflip') actor.rotation.z = q * 2.4;
      else if (p === 'typist') {
        arms[0].rotation.x = -0.7 - q * 0.4;
        arms[1].rotation.x = -1.1 + q * 0.4;
        actor.position.y = q * 0.045;
      } else if (p === 'filer') actor.position.y = q * 0.09;
      else if (p === 'caller') { head.rotation.z = (q - 0.5) * 0.35; arms[1].rotation.x = -q * 0.9; actor.rotation.y = q * 0.24; }
      else if (p === 'waver') actor.rotation.z = -0.7 - q * 0.9;
      else if (p === 'wrench') actor.rotation.z = (q - 0.5) * 0.9;
      else if (p === 'sipper') actor.rotation.x = -0.6 - q * 1.5;
      else if (p === 'pentap' || p === 'stamper' || p === 'button') actor.rotation.x = -0.3 - q * 0.65;
      else if (p === 'magnifier') actor.rotation.x = -0.8 - q * 1.0;
      else actor.rotation.x = -0.3 - q * 0.9;
    };
  }
  const smooth = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
  function update(t) {
    // One second: quick anticipation/action, readable hold, eased return, rest.
    const time = t + (Number.isFinite(spec.seed) ? spec.seed : 0) * 0.137;
    const phase = ((time % 1) + 1) % 1;
    const q = phase < 0.24 ? smooth(phase / 0.24) : phase < 0.47 ? 1
      : phase < 0.79 ? 1 - smooth((phase - 0.47) / 0.32) : 0;
    animate(q, phase);
  }
  update(0);
  return { group, update, actor };
}
