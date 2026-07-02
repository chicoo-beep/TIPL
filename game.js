const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

const world = { width: 420, height: 720 };
const keys = { left: false, right: false };

let score = 0;
let lives = 3;
let level = 1;
let running = false;
let paused = false;
let pointerActive = false;
let animationId = 0;

const paddle = {
  x: 150,
  y: 650,
  width: 120,
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
  speed: 7
};

let bricks = [];

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

function resetBall(serving = true) {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 4;
  const direction = Math.random() > 0.5 ? 1 : -1;
  ball.dx = direction * (3.6 + level * 0.25);
  ball.dy = serving ? -(5.2 + level * 0.25) : -5.5;
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
      const armored = row < Math.min(level, 3) && (row + col) % 3 === 0;
      bricks.push({
        x: 20 + col * (brickWidth + gap),
        y: 92 + row * 32,
        width: brickWidth,
        height: 22,
        hp: armored ? 2 : 1,
        maxHp: armored ? 2 : 1,
        color: palette[(row + col) % palette.length]
      });
    }
  }
}

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  paddle.x = 150;
  paddle.width = 120;
  paddle.targetX = paddle.x;
  ball.speed = 7;
  buildBricks();
  resetBall();
  running = true;
  paused = false;
  overlay.querySelector("h1").textContent = "Break the bunker line";
  overlay.querySelector("p").textContent = "Drag the command pad, bounce the shell, and clear every armored block.";
  startBtn.textContent = "Start Mission";
  overlay.classList.add("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  pauseBtn.textContent = paused ? "▶" : "II";
}

function drawBackground() {
  ctx.fillStyle = "#121813";
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
    ctx.fillStyle = brick.hp < brick.maxHp ? "#d9d4c5" : brick.color;
    roundRect(brick.x, brick.y, brick.width, brick.height, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(brick.x + 6, brick.y + brick.height - 6, brick.width - 12, 3);
    if (brick.maxHp > 1) {
      ctx.fillStyle = "rgba(18, 24, 19, 0.55)";
      ctx.fillRect(brick.x + brick.width - 15, brick.y + 5, 8, 8);
    }
  });
}

function drawPaddle() {
  ctx.fillStyle = "#29382f";
  roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
  ctx.fill();

  ctx.fillStyle = "#f0c94c";
  roundRect(paddle.x + 24, paddle.y - 12, paddle.width - 48, 17, 6);
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
  const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius + 2);
  gradient.addColorStop(0, "#fff7cf");
  gradient.addColorStop(0.45, "#f0c94c");
  gradient.addColorStop(1, "#c85c42");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
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

function draw() {
  drawBackground();
  drawTankariaWatermark();
  drawBricks();
  drawPaddle();
  drawBall();
  drawStatusText();
}

function update() {
  if (!running || paused) return;

  if (keys.left) paddle.targetX -= paddle.speed;
  if (keys.right) paddle.targetX += paddle.speed;
  paddle.targetX = clamp(paddle.targetX, 10, world.width - paddle.width - 10);
  paddle.x += (paddle.targetX - paddle.x) * (pointerActive ? 0.45 : 0.3);

  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x - ball.radius < 0 || ball.x + ball.radius > world.width) {
    ball.dx *= -1;
    ball.x = clamp(ball.x, ball.radius, world.width - ball.radius);
  }

  if (ball.y - ball.radius < 0) {
    ball.dy *= -1;
    ball.y = ball.radius;
  }

  if (
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width &&
    ball.dy > 0
  ) {
    const hit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    ball.dx = hit * ball.speed;
    ball.dy = -Math.sqrt(Math.max(20, ball.speed * ball.speed - ball.dx * ball.dx));
    ball.y = paddle.y - ball.radius - 1;
  }

  collideBricks();

  if (ball.y - ball.radius > world.height) {
    lives -= 1;
    updateHud();
    if (lives <= 0) {
      endGame("Mission failed", "The bunker line held. Refit and punch through again.");
    } else {
      resetBall();
    }
  }

  if (bricks.every((brick) => brick.hp <= 0)) {
    level += 1;
    score += 250;
    paddle.width = Math.max(86, paddle.width - 6);
    ball.speed = Math.min(9.5, ball.speed + 0.45);
    buildBricks();
    resetBall();
    updateHud();
  }
}

function collideBricks() {
  for (const brick of bricks) {
    if (brick.hp <= 0) continue;

    const closestX = clamp(ball.x, brick.x, brick.x + brick.width);
    const closestY = clamp(ball.y, brick.y, brick.y + brick.height);
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;

    if (distX * distX + distY * distY <= ball.radius * ball.radius) {
      brick.hp -= 1;
      score += brick.hp <= 0 ? 40 + level * 5 : 15;

      const overlapX = Math.min(
        Math.abs(ball.x - brick.x),
        Math.abs(ball.x - (brick.x + brick.width))
      );
      const overlapY = Math.min(
        Math.abs(ball.y - brick.y),
        Math.abs(ball.y - (brick.y + brick.height))
      );

      if (overlapX < overlapY) {
        ball.dx *= -1;
      } else {
        ball.dy *= -1;
      }
      updateHud();
      break;
    }
  }
}

function endGame(title, message) {
  running = false;
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = message;
  startBtn.textContent = "Restart Mission";
  overlay.classList.remove("hidden");
}

function loop() {
  update();
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
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = true;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = true;
  if (event.key === " " && running) {
    paused = !paused;
    updateHud();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false;
});

window.addEventListener("resize", () => {
  fitCanvas();
  draw();
});

fitCanvas();
buildBricks();
resetBall();
draw();
cancelAnimationFrame(animationId);
loop();
