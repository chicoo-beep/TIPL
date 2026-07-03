const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const fireBtn = document.getElementById("fireBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

const world = { width: 420, height: 720 };
const keys = { left: false, right: false };
const powers = {
  missile: { label: "Missile", color: "#f0c94c", duration: 9500 },
  electric: { label: "Electric", color: "#6fc2b0", duration: 8000 },
  fireball: { label: "Fireball", color: "#e2674f", duration: 8000 },
  magnet: { label: "Magnet", color: "#b38cff", duration: 11000 },
  freeze: { label: "Freeze", color: "#9fd8ff", duration: 7000 },
  revive: { label: "Revive", color: "#ff8daf", duration: 0 },
  gravity: { label: "Gravity", color: "#c7f06a", duration: 9000 },
  mystery: { label: "Mystery", color: "#ffffff", duration: 0 },
  shrink: { label: "Shrink", color: "#777777", duration: 6500 }
};

let score = 0;
let lives = 3;
let level = 1;
let combo = 0;
let running = false;
let paused = false;
let pointerActive = false;
let animationId = 0;
let lastTime = 0;
let activeMessage = "";
let messageTimer = 0;
let reviveReady = false;
let nextMissile = 0;

const paddle = {
  x: 150,
  y: 650,
  width: 120,
  baseWidth: 120,
  height: 18,
  speed: 8.2,
  targetX: 150
};

const ball = {
  x: 210,
  y: 612,
  radius: 8,
  dx: 4.1,
  dy: -5.5,
  speed: 7,
  stuck: false,
  stickOffset: 0
};

let bricks = [];
let drops = [];
let missiles = [];
let enemyShots = [];
let sparks = [];
let boss = null;
let activePowers = {};

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(
    (rect.width * scale) / world.width,
    0,
    0,
    (rect.height * scale) / world.height,
    0,
    0
  );
}

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  combo = 0;
  reviveReady = false;
  paddle.x = 150;
  paddle.width = paddle.baseWidth;
  paddle.targetX = paddle.x;
  ball.speed = 7;
  drops = [];
  missiles = [];
  enemyShots = [];
  sparks = [];
  activePowers = {};
  buildLevel();
  resetBall();
  running = true;
  paused = false;
  activeMessage = "Mission start";
  messageTimer = 1200;
  overlay.querySelector("h1").textContent = "Break the bunker line";
  overlay.querySelector("p").textContent = "Drag the command pad, bounce the shell, and clear every armored block.";
  startBtn.textContent = "Start Mission";
  overlay.classList.add("hidden");
  updateHud();
}

function buildLevel() {
  drops = [];
  missiles = [];
  enemyShots = [];
  sparks = [];
  boss = null;
  if (level % 10 === 0) {
    buildBoss();
  } else {
    buildBricks();
  }
}

function buildBricks() {
  bricks = [];
  const rows = Math.min(5 + level, 8);
  const cols = 7;
  const gap = 8;
  const brickWidth = (world.width - 40 - gap * (cols - 1)) / cols;
  const palette = ["#f0c94c", "#6fc2b0", "#e2674f", "#9fb06a"];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const roll = Math.random();
      const armored = row < Math.min(level, 3) && (row + col) % 3 === 0;
      let type = "normal";
      if (roll < 0.07) type = "bomb";
      else if (roll < 0.13) type = "rainbow";
      else if (roll < 0.2) type = "mystery";
      else if (roll < 0.34) type = "power";

      bricks.push({
        x: 20 + col * (brickWidth + gap),
        y: 92 + row * 32,
        width: brickWidth,
        height: 22,
        hp: armored ? 2 : 1,
        maxHp: armored ? 2 : 1,
        type,
        color: palette[(row + col) % palette.length],
        wobble: Math.random() * Math.PI * 2
      });
    }
  }
}

function buildBoss() {
  bricks = [];
  boss = {
    x: 76,
    y: 96,
    width: 268,
    height: 82,
    hp: 28 + level * 3,
    maxHp: 28 + level * 3,
    dir: 1,
    fireTimer: 700
  };
}

function resetBall(serving = true) {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 4;
  ball.stuck = activePowers.magnet > 0;
  ball.stickOffset = paddle.width / 2;
  const direction = Math.random() > 0.5 ? 1 : -1;
  ball.dx = direction * (3.6 + level * 0.25);
  ball.dy = serving ? -(5.2 + level * 0.25) : -5.5;
}

function launchBall() {
  if (!ball.stuck) return;
  ball.stuck = false;
  const aim = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
  ball.dx = clamp(aim * ball.speed, -ball.speed + 1.5, ball.speed - 1.5);
  ball.dy = -Math.sqrt(Math.max(18, ball.speed * ball.speed - ball.dx * ball.dx));
}

function updateHud() {
  scoreEl.textContent = score;
  comboEl.textContent = "x" + comboMultiplier();
  livesEl.textContent = reviveReady ? lives + "+R" : lives;
  pauseBtn.textContent = paused ? "GO" : "II";
}

function comboMultiplier() {
  if (combo >= 24) return 5;
  if (combo >= 14) return 3;
  if (combo >= 6) return 2;
  return 1;
}

function addScore(base) {
  score += Math.round(base * comboMultiplier());
  updateHud();
}

function update(now = 0) {
  const dt = Math.min(32, now - lastTime || 16);
  lastTime = now;
  if (!running || paused) return;

  tickTimers(dt);
  movePaddle();
  updateMissiles(dt);
  updateDrops(dt);
  updateEnemyShots(dt);
  updateSparks(dt);
  updateBoss(dt);
  updateBall(dt);
  checkLevelClear();
}

function tickTimers(dt) {
  messageTimer = Math.max(0, messageTimer - dt);
  Object.keys(activePowers).forEach((name) => {
    activePowers[name] -= dt;
    if (activePowers[name] <= 0) {
      delete activePowers[name];
      if (name === "shrink") paddle.width = paddle.baseWidth;
      if (name === "magnet" && ball.stuck) launchBall();
    }
  });

  if (activePowers.missile) {
    nextMissile -= dt;
    if (nextMissile <= 0) {
      fireMissiles();
      nextMissile = 360;
    }
  }
}

function movePaddle() {
  if (keys.left) paddle.targetX -= paddle.speed;
  if (keys.right) paddle.targetX += paddle.speed;
  paddle.targetX = clamp(paddle.targetX, 10, world.width - paddle.width - 10);
  paddle.x += (paddle.targetX - paddle.x) * (pointerActive ? 0.45 : 0.3);
  if (ball.stuck) {
    ball.x = paddle.x + ball.stickOffset;
    ball.y = paddle.y - ball.radius - 4;
  }
}

function updateBall(dt) {
  if (ball.stuck) return;

  const speedScale = activePowers.freeze ? 0.48 : 1;
  if (activePowers.gravity) {
    const centerPull = (world.width / 2 - ball.x) * 0.00022 * dt;
    ball.dx += centerPull;
  }

  ball.x += ball.dx * speedScale;
  ball.y += ball.dy * speedScale;

  if (ball.x - ball.radius < 0 || ball.x + ball.radius > world.width) {
    ball.dx *= -1;
    ball.x = clamp(ball.x, ball.radius, world.width - ball.radius);
  }

  if (ball.y - ball.radius < 0) {
    ball.dy *= -1;
    ball.y = ball.radius;
  }

  if (hitsPaddle()) {
    if (activePowers.magnet) {
      ball.stuck = true;
      ball.stickOffset = clamp(ball.x - paddle.x, 18, paddle.width - 18);
      showMessage("Magnet locked");
    } else {
      bounceFromPaddle();
    }
  }

  collideBricks();
  collideBoss();

  if (ball.y - ball.radius > world.height) {
    loseLife();
  }
}

function hitsPaddle() {
  return (
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width &&
    ball.dy > 0
  );
}

function bounceFromPaddle() {
  const hit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
  ball.dx = hit * ball.speed;
  ball.dy = -Math.sqrt(Math.max(20, ball.speed * ball.speed - ball.dx * ball.dx));
  ball.y = paddle.y - ball.radius - 1;
}

function collideBricks() {
  for (const brick of bricks) {
    if (brick.hp <= 0) continue;
    if (!circleRect(ball.x, ball.y, ball.radius, brick)) continue;

    const pierce = activePowers.electric || activePowers.fireball;
    damageBrick(brick, activePowers.fireball ? 99 : 1, "ball");
    if (!pierce) bounceFromBrick(brick);
    break;
  }
}

function bounceFromBrick(brick) {
  const overlapX = Math.min(
    Math.abs(ball.x - brick.x),
    Math.abs(ball.x - (brick.x + brick.width))
  );
  const overlapY = Math.min(
    Math.abs(ball.y - brick.y),
    Math.abs(ball.y - (brick.y + brick.height))
  );
  if (overlapX < overlapY) ball.dx *= -1;
  else ball.dy *= -1;
}

function damageBrick(brick, amount, source) {
  brick.hp -= amount;
  combo += 1;
  if (brick.hp > 0) {
    addScore(15);
    spark(brick.x + brick.width / 2, brick.y + brick.height / 2, "#d9d4c5");
    return;
  }

  addScore(brick.type === "rainbow" ? 150 : 45 + level * 5);
  spark(brick.x + brick.width / 2, brick.y + brick.height / 2, brickColor(brick), 10);

  if (brick.type === "bomb") explodeBrick(brick);
  if (brick.type === "rainbow") showMessage("Rainbow bonus");
  if (brick.type === "power" || brick.type === "mystery" || (source === "ball" && Math.random() < 0.16)) {
    dropPower(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.type === "mystery");
  }
}

function explodeBrick(centerBrick) {
  showMessage("Bomb blast");
  bricks.forEach((brick) => {
    if (brick.hp <= 0 || brick === centerBrick) return;
    const dx = brick.x + brick.width / 2 - (centerBrick.x + centerBrick.width / 2);
    const dy = brick.y + brick.height / 2 - (centerBrick.y + centerBrick.height / 2);
    if (Math.hypot(dx, dy) < 72) {
      brick.hp = 0;
      addScore(30);
      spark(brick.x + brick.width / 2, brick.y + brick.height / 2, "#e2674f", 8);
    }
  });
}

function dropPower(x, y, mystery = false) {
  const names = mystery
    ? ["missile", "electric", "fireball", "magnet", "freeze", "revive", "gravity", "shrink"]
    : ["missile", "electric", "fireball", "magnet", "freeze", "revive"];
  const name = mystery ? "mystery" : names[Math.floor(Math.random() * names.length)];
  drops.push({ x, y, vy: 2.2, name, mysteryPool: names, radius: 11 });
}

function collectPower(drop) {
  const name = drop.name === "mystery"
    ? drop.mysteryPool[Math.floor(Math.random() * drop.mysteryPool.length)]
    : drop.name;
  const power = powers[name];
  if (!power) return;

  if (name === "revive") {
    reviveReady = true;
  } else if (name === "shrink") {
    paddle.width = 82;
    activePowers.shrink = power.duration;
  } else {
    activePowers[name] = power.duration;
    if (name === "missile") nextMissile = 0;
  }
  showMessage(power.label);
  updateHud();
}

function fireMissiles() {
  missiles.push({ x: paddle.x + 22, y: paddle.y - 18, vy: -9 });
  missiles.push({ x: paddle.x + paddle.width - 22, y: paddle.y - 18, vy: -9 });
}

function updateMissiles(dt) {
  missiles.forEach((missile) => {
    missile.y += missile.vy * (dt / 16);
    for (const brick of bricks) {
      if (brick.hp > 0 && pointRect(missile.x, missile.y, brick)) {
        damageBrick(brick, 99, "missile");
        missile.dead = true;
        break;
      }
    }
    if (boss && pointRect(missile.x, missile.y, boss)) {
      damageBoss(2);
      missile.dead = true;
    }
    if (missile.y < -20) missile.dead = true;
  });
  missiles = missiles.filter((missile) => !missile.dead);
}

function updateDrops(dt) {
  drops.forEach((drop) => {
    drop.y += drop.vy * (activePowers.freeze ? 0.55 : 1) * (dt / 16);
    if (
      drop.y + drop.radius >= paddle.y &&
      drop.y - drop.radius <= paddle.y + paddle.height &&
      drop.x >= paddle.x &&
      drop.x <= paddle.x + paddle.width
    ) {
      collectPower(drop);
      drop.dead = true;
    }
    if (drop.y > world.height + 30) drop.dead = true;
  });
  drops = drops.filter((drop) => !drop.dead);
}

function updateBoss(dt) {
  if (!boss) return;
  const slow = activePowers.freeze ? 0.45 : 1;
  boss.x += boss.dir * (1.25 + level * 0.05) * slow * (dt / 16);
  if (boss.x < 28 || boss.x + boss.width > world.width - 28) boss.dir *= -1;

  boss.fireTimer -= dt * slow;
  if (boss.fireTimer <= 0) {
    enemyShots.push({ x: boss.x + boss.width * Math.random(), y: boss.y + boss.height + 8, vy: 3.6 });
    boss.fireTimer = 540 + Math.random() * 460;
  }
}

function collideBoss() {
  if (!boss || !circleRect(ball.x, ball.y, ball.radius, boss)) return;
  damageBoss(activePowers.fireball ? 3 : 1);
  if (!activePowers.electric && !activePowers.fireball) ball.dy *= -1;
}

function damageBoss(amount) {
  if (!boss) return;
  boss.hp -= amount;
  combo += 1;
  addScore(35);
  spark(ball.x, ball.y, "#f0c94c", 7);
  if (boss.hp <= 0) {
    addScore(800);
    showMessage("Boss cleared");
    boss = null;
  }
}

function updateEnemyShots(dt) {
  enemyShots.forEach((shot) => {
    shot.y += shot.vy * (dt / 16);
    if (
      shot.y >= paddle.y &&
      shot.y <= paddle.y + paddle.height &&
      shot.x >= paddle.x &&
      shot.x <= paddle.x + paddle.width
    ) {
      shot.dead = true;
      loseLife();
    }
    if (shot.y > world.height + 20) shot.dead = true;
  });
  enemyShots = enemyShots.filter((shot) => !shot.dead);
}

function loseLife() {
  combo = 0;
  if (reviveReady) {
    reviveReady = false;
    resetBall();
    showMessage("Revive saved you");
    updateHud();
    return;
  }

  lives -= 1;
  updateHud();
  if (lives <= 0) {
    endGame("Mission failed", "The bunker line held. Refit and punch through again.");
  } else {
    resetBall();
  }
}

function checkLevelClear() {
  const clearedBricks = bricks.length > 0 && bricks.every((brick) => brick.hp <= 0);
  if (!clearedBricks && boss !== null) return;
  if (!clearedBricks && bricks.length === 0 && boss !== null) return;
  if (!clearedBricks && bricks.length > 0) return;

  level += 1;
  combo = 0;
  addScore(250);
  paddle.width = Math.max(86, paddle.baseWidth - Math.floor(level / 2) * 2);
  ball.speed = Math.min(10.3, ball.speed + 0.35);
  buildLevel();
  resetBall();
  showMessage(level % 10 === 0 ? "Boss level" : "Level " + level);
  updateHud();
}

function draw() {
  drawBackground();
  drawTankariaWatermark();
  drawBricks();
  drawBoss();
  drawDrops();
  drawMissiles();
  drawEnemyShots();
  drawPaddle();
  drawBall();
  drawSparks();
  drawPowerStatus();
  drawStatusText();
}

function drawBackground() {
  ctx.fillStyle = activePowers.gravity ? "#141821" : "#121813";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.strokeStyle = "rgba(244, 240, 230, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(240, 201, 76, 0.08)";
  ctx.fillRect(0, 70, world.width, 2);
}

function drawTankariaWatermark() {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#f0c94c";
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TANKARIA", world.width / 2, 372);
  ctx.restore();
}

function drawBricks() {
  bricks.forEach((brick) => {
    if (brick.hp <= 0) return;
    ctx.fillStyle = brickColor(brick);
    roundRect(brick.x, brick.y, brick.width, brick.height, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fillRect(brick.x + 6, brick.y + brick.height - 6, brick.width - 12, 3);
    if (brick.maxHp > 1) {
      ctx.fillStyle = "rgba(18, 24, 19, 0.55)";
      ctx.fillRect(brick.x + brick.width - 15, brick.y + 5, 8, 8);
    }
    if (brick.type !== "normal") {
      ctx.fillStyle = "rgba(16, 20, 18, 0.74)";
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(brickIcon(brick.type), brick.x + brick.width / 2, brick.y + 16);
    }
  });
}

function brickColor(brick) {
  if (brick.hp < brick.maxHp) return "#d9d4c5";
  if (brick.type === "bomb") return "#242424";
  if (brick.type === "rainbow") {
    const hue = (Date.now() / 18 + brick.wobble * 30) % 360;
    return "hsl(" + hue + " 85% 62%)";
  }
  if (brick.type === "mystery") return "#ffffff";
  if (brick.type === "power") return "#b38cff";
  return brick.color;
}

function brickIcon(type) {
  if (type === "bomb") return "B";
  if (type === "rainbow") return "+";
  if (type === "mystery") return "?";
  if (type === "power") return "P";
  return "";
}

function drawBoss() {
  if (!boss) return;
  ctx.fillStyle = "#26382f";
  roundRect(boss.x, boss.y, boss.width, boss.height, 10);
  ctx.fill();
  ctx.fillStyle = "#f0c94c";
  roundRect(boss.x + 48, boss.y + 22, boss.width - 96, 34, 9);
  ctx.fill();
  ctx.fillStyle = "#101412";
  ctx.fillRect(boss.x + 16, boss.y + boss.height + 12, boss.width, 9);
  ctx.fillStyle = "#e2674f";
  ctx.fillRect(boss.x + 16, boss.y + boss.height + 12, boss.width * (boss.hp / boss.maxHp), 9);
  ctx.fillStyle = "#f4f0e6";
  ctx.font = "900 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BOSS " + level, world.width / 2, boss.y + 52);
}

function drawPaddle() {
  ctx.fillStyle = activePowers.magnet ? "#5f468f" : "#29382f";
  roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
  ctx.fill();
  ctx.fillStyle = activePowers.missile ? "#e2674f" : "#f0c94c";
  roundRect(paddle.x + 24, paddle.y - 12, Math.max(24, paddle.width - 48), 17, 6);
  ctx.fill();
  ctx.strokeStyle = "#101412";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(paddle.x + paddle.width / 2, paddle.y - 8);
  ctx.lineTo(paddle.x + paddle.width / 2 + 38, paddle.y - 18);
  ctx.stroke();
  ctx.fillStyle = "#0e1511";
  for (let x = paddle.x + 8; x < paddle.x + paddle.width - 4; x += 14) {
    ctx.fillRect(x, paddle.y + 4, 7, 6);
  }
}

function drawBall() {
  const color = activePowers.fireball ? "#e2674f" : activePowers.electric ? "#6fc2b0" : "#f0c94c";
  const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius + 5);
  gradient.addColorStop(0, "#fff7cf");
  gradient.addColorStop(0.45, color);
  gradient.addColorStop(1, activePowers.fireball ? "#7f241a" : "#c85c42");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius + (activePowers.fireball ? 2 : 0), 0, Math.PI * 2);
  ctx.fill();
  if (activePowers.electric || activePowers.fireball) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawDrops() {
  drops.forEach((drop) => {
    const power = powers[drop.name] || powers.mystery;
    ctx.fillStyle = power.color;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101412";
    ctx.font = "900 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(drop.name === "mystery" ? "?" : power.label[0], drop.x, drop.y + 4);
  });
}

function drawMissiles() {
  ctx.fillStyle = "#e2674f";
  missiles.forEach((missile) => {
    roundRect(missile.x - 3, missile.y - 12, 6, 18, 3);
    ctx.fill();
  });
}

function drawEnemyShots() {
  ctx.fillStyle = "#ff8daf";
  enemyShots.forEach((shot) => {
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSparks() {
  sparks.forEach((particle) => {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  });
  ctx.globalAlpha = 1;
}

function drawPowerStatus() {
  const names = Object.keys(activePowers).filter((name) => activePowers[name] > 0);
  if (!names.length && messageTimer <= 0) return;
  ctx.textAlign = "center";
  ctx.font = "800 13px system-ui, sans-serif";
  if (names.length) {
    const text = names.map((name) => powers[name].label).join(" + ");
    ctx.fillStyle = "rgba(16, 20, 18, 0.72)";
    roundRect(54, 28, world.width - 108, 28, 8);
    ctx.fill();
    ctx.fillStyle = "#f4f0e6";
    ctx.fillText(text, world.width / 2, 47);
  }
  if (messageTimer > 0) {
    ctx.fillStyle = "#f0c94c";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.fillText(activeMessage, world.width / 2, 235);
  }
}

function drawStatusText() {
  if (!paused || !running) return;
  ctx.fillStyle = "rgba(16, 20, 18, 0.72)";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#f4f0e6";
  ctx.font = "900 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Paused", world.width / 2, world.height / 2);
}

function updateSparks(dt) {
  sparks.forEach((particle) => {
    particle.x += particle.dx * (dt / 16);
    particle.y += particle.dy * (dt / 16);
    particle.life -= dt;
  });
  sparks = sparks.filter((particle) => particle.life > 0);
}

function spark(x, y, color, count = 5) {
  for (let i = 0; i < count; i += 1) {
    sparks.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 5,
      dy: (Math.random() - 0.5) * 5,
      color,
      life: 360,
      maxLife: 360
    });
  }
}

function showMessage(text) {
  activeMessage = text;
  messageTimer = 1000;
}

function endGame(title, message) {
  running = false;
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = message;
  startBtn.textContent = "Restart Mission";
  overlay.classList.remove("hidden");
}

function loop(now) {
  update(now);
  draw();
  animationId = requestAnimationFrame(loop);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function circleRect(cx, cy, radius, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.width);
  const closestY = clamp(cy, rect.y, rect.y + rect.height);
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY <= radius * radius;
}

function pointRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setPointerTarget(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * world.width;
  paddle.targetX = clamp(x - paddle.width / 2, 10, world.width - paddle.width - 10);
}

canvas.addEventListener("pointerdown", (event) => {
  pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  setPointerTarget(event);
  if (ball.stuck) launchBall();
});

canvas.addEventListener("pointermove", (event) => {
  if (pointerActive) setPointerTarget(event);
});

canvas.addEventListener("pointerup", () => {
  pointerActive = false;
});

canvas.addEventListener("pointercancel", () => {
  pointerActive = false;
});

startBtn.addEventListener("click", newGame);

pauseBtn.addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
  updateHud();
});

fireBtn.addEventListener("click", () => {
  if (ball.stuck) launchBall();
  if (activePowers.missile) fireMissiles();
});

function bindHold(button, key) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    keys[key] = true;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => {
    keys[key] = false;
  });
  button.addEventListener("pointercancel", () => {
    keys[key] = false;
  });
  button.addEventListener("pointerleave", () => {
    keys[key] = false;
  });
}

bindHold(leftBtn, "left");
bindHold(rightBtn, "right");

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") keys.left = true;
  if (event.key === "ArrowRight" || key === "d") keys.right = true;
  if ((event.key === " " || key === "w") && running) {
    if (ball.stuck) launchBall();
    else if (activePowers.missile) fireMissiles();
  }
  if (key === "p" && running) {
    paused = !paused;
    updateHud();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") keys.left = false;
  if (event.key === "ArrowRight" || key === "d") keys.right = false;
});

window.addEventListener("resize", () => {
  fitCanvas();
  draw();
});

fitCanvas();
buildLevel();
resetBall();
draw();
cancelAnimationFrame(animationId);
loop();
