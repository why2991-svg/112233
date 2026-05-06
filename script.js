/* ===================== 音效系统 (Web Audio API) ===================== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function play8Bit(type) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'coin') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(987, now);
    osc.frequency.setValueAtTime(1318, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'jump') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.12);
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'door') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

/* ===================== 响应式缩放 ===================== */
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const gameWrap = document.getElementById('game-wrap');

function resizeGame() {
  const maxW = window.innerWidth - 16;
  const maxH = window.innerHeight - 16;
  const scale = Math.min(maxW / GAME_WIDTH, maxH / GAME_HEIGHT, 1);
  if (gameWrap) {
    gameWrap.style.transform = `scale(${scale})`;
    gameWrap.style.marginTop = `${(window.innerHeight - GAME_HEIGHT * scale) / 2}px`;
  }
}
window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', () => setTimeout(resizeGame, 200));

/* ===================== 游戏配置 ===================== */
const GROUND_Y = 80;

// 玩家
const player = {
  el: document.getElementById('player'),
  x: 300,
  y: 0,
  w: 32,
  h: 52,
  vx: 0,
  vy: 0,
  speed: 3.5,
  jumpForce: 13.5,
  gravity: 0.55,
  grounded: true,
  facing: 1,
};

// 互动区域
const interactables = {
  door: { x: 330, w: 60, y: 0, h: 80, label: '按空格开门', action: 'about' },
  pipe: { x: 800, w: 80, y: 110, h: 20, label: '按空格进入', action: 'projects' },
};

// 金币
const coin = {
  el: document.getElementById('coin'),
  x: 520, y: 130, r: 18,
  collected: false
};

// 键盘状态
const keys = {};
let spacePressed = false;

/* ===================== 触摸控制 ===================== */
function bindTouch(btnId, keyName) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const start = (e) => { e.preventDefault(); keys[keyName] = true; if (keyName === 'Space') spacePressed = true; };
  const end = (e) => { e.preventDefault(); keys[keyName] = false; };
  btn.addEventListener('touchstart', start, { passive: false });
  btn.addEventListener('touchend', end, { passive: false });
  btn.addEventListener('touchcancel', end, { passive: false });
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
}

bindTouch('btnLeft', 'ArrowLeft');
bindTouch('btnRight', 'ArrowRight');
bindTouch('btnSpace', 'Space');

// 阻止 iOS 默认滑动手势
document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

/* ===================== 输入处理 ===================== */
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!keys['Space']) spacePressed = true;
  }
  keys[e.code] = true;

  if (introState.active && !introState.skipped) {
    skipIntro();
  } else if (introState.waitingForStart) {
    startGame();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

/* ===================== 弹窗内容 ===================== */
const modalData = {
  about: {
    title: '关于我',
    body: `<p>你好！我是一个热爱像素风和前端开发的学生。</p>
           <p>正在学习 HTML、CSS、JavaScript，喜欢把代码和创意结合起来，做出有趣的东西。</p>
           <p>这个页面就是我用原生技术写的一个小 Demo，希望你喜欢！</p>`
  },
  skills: {
    title: '技能',
    body: `<ul>
             <li>HTML5 / CSS3 / JavaScript（ES6+）</li>
             <li>React（Vite 生态）</li>
             <li>像素画设计 & 8bit 风格视觉</li>
             <li>基础游戏逻辑与物理系统</li>
           </ul>
           <p>持续学习中...</p>`
  },
  projects: {
    title: '项目',
    body: `<p><strong>像素风个人主页</strong> —— 就是这个页面！一个可玩的 2D 平台游戏式个人介绍。</p>
           <p><strong>更多项目</strong> —— Coming soon...</p>`
  }
};

function openModal(key) {
  const data = modalData[key];
  if (!data) return;
  document.getElementById('modalBody').innerHTML = '<h2>' + data.title + '</h2>' + data.body;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal(e) {
  if (!e || e.target.id === 'modalOverlay' || e.target.className === 'modal-close') {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('door').classList.remove('open');
  }
}

/* ===================== 开场动画系统 ===================== */
const introState = {
  active: true,
  skipped: false,
  waitingForStart: false,
  gameStarted: false
};

const introElements = {
  screen: document.getElementById('introScreen'),
  startHint: document.getElementById('startHint'),
  ground: document.getElementById('groundWrap'),
  house: document.getElementById('house'),
  tree: document.getElementById('tree'),
  pipe: document.getElementById('pipe'),
  coin: document.getElementById('coin'),
  player: document.getElementById('player'),
  clouds: [document.getElementById('cloud1'), document.getElementById('cloud2'), document.getElementById('cloud3')],
  hills: [document.getElementById('hill1'), document.getElementById('hill2')]
};

function showElement(el) {
  if (el) el.classList.add('visible');
}

function runIntroSequence() {
  setTimeout(() => {
    if (introState.skipped) return;
    introElements.screen.classList.add('hidden');
  }, 2000);

  setTimeout(() => {
    if (introState.skipped) return;
    introElements.clouds.forEach(c => showElement(c));
    introElements.hills.forEach(h => showElement(h));
  }, 2200);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.ground);
  }, 2500);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.house);
  }, 2900);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.tree);
  }, 3300);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.pipe);
  }, 3600);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.coin);
  }, 4000);

  setTimeout(() => {
    if (introState.skipped) return;
    showElement(introElements.player);
  }, 4400);

  setTimeout(() => {
    if (introState.skipped) return;
    introState.waitingForStart = true;
    introElements.startHint.classList.add('show');
  }, 4800);
}

function skipIntro() {
  introState.skipped = true;
  introState.active = false;

  introElements.screen.classList.add('hidden');
  introElements.clouds.forEach(c => showElement(c));
  introElements.hills.forEach(h => showElement(h));
  showElement(introElements.ground);
  showElement(introElements.house);
  showElement(introElements.tree);
  showElement(introElements.pipe);
  showElement(introElements.coin);
  showElement(introElements.player);

  startGame();
}

function startGame() {
  introState.waitingForStart = false;
  introState.gameStarted = true;
  introState.active = false;
  introElements.startHint.classList.remove('show');
  resizeGame();
}

/* ===================== 游戏循环 ===================== */
function update() {
  if (!introState.gameStarted) return;

  // 水平移动
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.vx = -player.speed;
    player.facing = -1;
  } else if (keys['ArrowRight'] || keys['KeyD']) {
    player.vx = player.speed;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  player.x += player.vx;
  player.x = Math.max(0, Math.min(GAME_WIDTH - player.w, player.x));

  // 垂直物理
  let prevY = player.y;

  if (!player.grounded) {
    player.vy -= player.gravity;
  }

  player.y += player.vy;

  // 地面碰撞
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }

  // 水管平台碰撞
  const pipeTopY = 110;
  if (prevY > pipeTopY && player.y <= pipeTopY &&
      player.x + player.w > 800 && player.x < 880) {
    player.y = pipeTopY;
    player.vy = 0;
    player.grounded = true;
  }

  // 空格处理
  if (spacePressed) {
    const near = getNearbyInteractable();
    if (near) {
      if (near === 'door') {
        play8Bit('door');
        document.getElementById('door').classList.add('open');
        setTimeout(() => openModal('about'), 200);
      } else if (near === 'pipe') {
        play8Bit('door');
        openModal('projects');
      }
    } else if (player.grounded) {
      play8Bit('jump');
      player.vy = player.jumpForce;
      player.grounded = false;
    }
    spacePressed = false;
  }

  // 金币碰撞
  if (!coin.collected) {
    let px = player.x + player.w / 2;
    let py = player.y + player.h / 2;
    let dx = px - coin.x;
    let dy = py - coin.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < coin.r + player.w/2) {
      play8Bit('coin');
      coin.collected = true;
      coin.el.classList.add('collected');
      setTimeout(() => openModal('skills'), 100);
    }
  }

  render();
}

function getNearbyInteractable() {
  const hintEl = document.getElementById('hint');
  for (let key in interactables) {
    let zone = interactables[key];
    let inX = player.x + player.w > zone.x && player.x < zone.x + zone.w;
    let inY = player.y + player.h >= zone.y && player.y <= zone.y + zone.h;
    if (inX && inY) {
      hintEl.textContent = zone.label;
      hintEl.classList.add('show');
      return key;
    }
  }
  hintEl.classList.remove('show');
  return null;
}

function render() {
  player.el.style.left = player.x + 'px';
  player.el.style.bottom = (GROUND_Y + player.y) + 'px';
  player.el.style.setProperty('--facing', player.facing);

  player.el.classList.remove('walking', 'jumping');
  if (!player.grounded) {
    player.el.classList.add('jumping');
  } else if (Math.abs(player.vx) > 0) {
    player.el.classList.add('walking');
  }
}

function gameLoop() {
  update();
  requestAnimationFrame(gameLoop);
}

// 初始化
resizeGame();
render();
runIntroSequence();
gameLoop();
