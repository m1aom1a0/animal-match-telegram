const ANIMALS = ["🐱", "🐶", "🐼", "🦊", "🐸", "🐵"];
const SPECIAL_MARKS = {
  bomb: "💥",
  row: "↔",
  column: "↕",
  rainbow: "✨"
};
const SOUND_SOURCES = {
  tap: "./assets/sfx-tap.wav",
  miss: "./assets/sfx-miss.wav",
  clear: "./assets/sfx-clear.wav",
  burst: "./assets/sfx-burst.wav",
  special: "./assets/sfx-special.wav",
  ad: "./assets/sfx-ad.wav",
  reward: "./assets/sfx-reward.wav"
};
const SIZE = 7;
const LEVEL_CURVE = [
  { target: 420, moves: 28, animals: 5, minMoves: 5, bomb: 1, hammer: 2, bonusBomb: 0, bonusHammer: 0 },
  { target: 620, moves: 27, animals: 5, minMoves: 5, bomb: 1, hammer: 2, bonusBomb: 0, bonusHammer: 0 },
  { target: 860, moves: 26, animals: 5, minMoves: 4, bomb: 1, hammer: 2, bonusBomb: 1, bonusHammer: 0 },
  { target: 1120, moves: 26, animals: 6, minMoves: 4, bomb: 1, hammer: 1, bonusBomb: 0, bonusHammer: 1 },
  { target: 1420, moves: 25, animals: 6, minMoves: 4, bomb: 1, hammer: 1, bonusBomb: 1, bonusHammer: 0 },
  { target: 1740, moves: 25, animals: 6, minMoves: 3, bomb: 1, hammer: 1, bonusBomb: 0, bonusHammer: 0 },
  { target: 2100, moves: 24, animals: 6, minMoves: 3, bomb: 1, hammer: 1, bonusBomb: 1, bonusHammer: 0 },
  { target: 2480, moves: 24, animals: 6, minMoves: 3, bomb: 1, hammer: 1, bonusBomb: 0, bonusHammer: 1 },
  { target: 2920, moves: 23, animals: 6, minMoves: 3, bomb: 1, hammer: 1, bonusBomb: 0, bonusHammer: 0 },
  { target: 3380, moves: 23, animals: 6, minMoves: 3, bomb: 1, hammer: 1, bonusBomb: 1, bonusHammer: 0 }
];

const state = {
  board: [],
  selected: null,
  score: 0,
  level: 1,
  target: LEVEL_CURVE[0].target,
  moves: LEVEL_CURVE[0].moves,
  levelConfig: LEVEL_CURVE[0],
  locked: false,
  activeTool: null,
  tools: {
    bomb: 1,
    hammer: 2
  }
};

const els = {
  board: document.getElementById("board"),
  score: document.getElementById("score"),
  level: document.getElementById("level"),
  target: document.getElementById("target"),
  moves: document.getElementById("moves"),
  bombTools: document.getElementById("bombTools"),
  hammerTools: document.getElementById("hammerTools"),
  comboPop: document.getElementById("comboPop"),
  resultDialog: document.getElementById("resultDialog"),
  resultKicker: document.getElementById("resultKicker"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),
  nextButton: document.getElementById("nextButton"),
  rewardButton: document.getElementById("rewardButton"),
  bannerAd: document.getElementById("bannerAd"),
  newGameButton: document.getElementById("newGameButton"),
  shuffleButton: document.getElementById("shuffleButton"),
  hintButton: document.getElementById("hintButton"),
  bombToolButton: document.getElementById("bombToolButton"),
  hammerToolButton: document.getElementById("hammerToolButton"),
  adPowerButton: document.getElementById("adPowerButton")
};

document.addEventListener("DOMContentLoaded", async () => {
  window.gameAudio = { play: playSound, unlock: unlockAudio };
  initAudioPool();
  document.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
  ensureAdsAdapter();
  bindControls();
  startGame();
  loadBannerAd();
});

async function loadBannerAd() {
  try {
    await window.roiifyAds.init(window.telegramGame?.adContext || {});
    await window.roiifyAds.showBanner(els.bannerAd);
  } catch (error) {
    console.warn("[ads] banner skipped", error);
  }
}

function ensureAdsAdapter() {
  if (window.roiifyAds) return;
  window.roiifyAds = {
    init: async () => false,
    showBanner: async () => false,
    refreshBannerForReward: async () => ({ completed: false, source: "fallback" }),
    showRewarded: async () => ({ completed: true, source: "fallback" }),
    showInterstitial: async () => false,
    track: () => {}
  };
}

function bindControls() {
  els.newGameButton.addEventListener("click", () => {
    playSound("tap");
    startGame();
  });
  els.shuffleButton.addEventListener("click", () => {
    if (state.locked) return;
    playSound("tap");
    shuffleBoard();
    state.moves = Math.max(0, state.moves - 1);
    state.activeTool = null;
    render();
    checkEnd();
  });
  els.hintButton.addEventListener("click", () => {
    playSound("tap");
    showHint();
  });
  els.bombToolButton.addEventListener("click", () => toggleTool("bomb"));
  els.hammerToolButton.addEventListener("click", () => toggleTool("hammer"));
  els.adPowerButton.addEventListener("click", () => grantToolsByAd("button"));
  window.addEventListener("animal-match:restart", () => {
    playSound("tap");
    if (els.resultDialog.open) els.resultDialog.close();
    startGame();
  });
  els.nextButton.addEventListener("click", () => {
    els.resultDialog.close();
    if (state.score >= state.target) {
      state.level += 1;
      const nextConfig = getLevelConfig(state.level);
      state.tools.bomb += nextConfig.bonusBomb;
      state.tools.hammer += nextConfig.bonusHammer;
    }
    resetRound();
  });
  els.rewardButton.addEventListener("click", async () => {
    els.rewardButton.disabled = true;
    const result = await window.roiifyAds.showRewarded("moves");
    els.rewardButton.disabled = false;
    if (result?.rewarded || result?.completed) {
      state.moves += 5;
      els.resultDialog.close();
      render();
      playSound("reward");
      window.roiifyAds.track("reward_granted", { reward: "moves", level: state.level, moves: state.moves });
    }
  });
}

function startGame() {
  state.score = 0;
  state.level = 1;
  state.levelConfig = getLevelConfig(state.level);
  state.target = state.levelConfig.target;
  state.tools.bomb = state.levelConfig.bomb;
  state.tools.hammer = state.levelConfig.hammer;
  resetRound();
  window.roiifyAds.track("game_start");
}

function resetRound() {
  state.levelConfig = getLevelConfig(state.level);
  state.target = state.levelConfig.target;
  state.score = 0;
  state.moves = state.levelConfig.moves;
  state.selected = null;
  state.activeTool = null;
  state.locked = false;
  state.board = createBoard();
  render();
  window.roiifyAds.track("level_start", {
    level: state.level,
    target: state.target,
    moves: state.moves,
    animals: state.levelConfig.animals
  });
}

function getLevelConfig(level) {
  const base = LEVEL_CURVE[level - 1];
  if (base) return base;

  const extra = level - LEVEL_CURVE.length;
  return {
    target: 3380 + extra * 480 + Math.floor(extra * extra * 22),
    moves: Math.max(21, 23 - Math.floor(extra / 4)),
    animals: 6,
    minMoves: 3,
    bomb: 1,
    hammer: 1,
    bonusBomb: level % 4 === 0 ? 1 : 0,
    bonusHammer: level % 6 === 0 ? 1 : 0
  };
}

function createBoard() {
  const minMoves = state.levelConfig.minMoves || 3;
  let bestBoard = null;
  let bestMoveCount = 0;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        let animal;
        do {
          animal = randomAnimal();
        } while (
          (col >= 2 && animalOf(board[row][col - 1]) === animal && animalOf(board[row][col - 2]) === animal) ||
          (row >= 2 && animalOf(board[row - 1][col]) === animal && animalOf(board[row - 2][col]) === animal)
        );
        board[row][col] = makeTile(animal);
      }
    }

    const moveCount = countPossibleMoves(board);
    if (moveCount >= minMoves) return board;
    if (moveCount > bestMoveCount) {
      bestBoard = board;
      bestMoveCount = moveCount;
    }
  }

  return bestMoveCount > 0 ? bestBoard : createBoard();
}

function render() {
  els.score.textContent = state.score;
  els.level.textContent = state.level;
  els.target.textContent = state.target;
  els.moves.textContent = state.moves;
  els.bombTools.textContent = state.tools.bomb;
  els.hammerTools.textContent = state.tools.hammer;
  els.bombToolButton.disabled = state.locked;
  els.hammerToolButton.disabled = state.locked;
  els.adPowerButton.disabled = state.locked;
  els.bombToolButton.classList.toggle("active", state.activeTool === "bomb");
  els.hammerToolButton.classList.toggle("active", state.activeTool === "hammer");
  els.bombToolButton.classList.toggle("depleted", state.tools.bomb <= 0);
  els.hammerToolButton.classList.toggle("depleted", state.tools.hammer <= 0);
  els.bombToolButton.title = state.tools.bomb > 0 ? "使用炸弹" : "看广告补充炸弹";
  els.hammerToolButton.title = state.tools.hammer > 0 ? "使用小锤" : "看广告补充小锤";
  els.board.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = state.board[row][col];
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.role = "gridcell";
      tile.dataset.row = row;
      tile.dataset.col = col;

      if (cell.special) tile.classList.add(`special-${cell.special}`);
      if (state.activeTool) tile.classList.add("tool-target");
      if (state.selected?.row === row && state.selected?.col === col) {
        tile.classList.add("selected");
      }

      const animal = document.createElement("span");
      animal.className = "animal-face";
      const faceStyle = getAnimalFaceStyle(cell.animal);
      animal.style.setProperty("--face-x", faceStyle.x);
      animal.style.setProperty("--face-y", faceStyle.y);
      animal.style.setProperty("--face-scale", faceStyle.scale);
      animal.textContent = cell.animal;
      tile.appendChild(animal);

      if (cell.special) {
        const mark = document.createElement("span");
        mark.className = "special-mark";
        mark.textContent = SPECIAL_MARKS[cell.special];
        tile.appendChild(mark);
      }

      tile.setAttribute("aria-label", describeTile(cell, row, col));
      tile.addEventListener("click", () => selectTile(row, col));
      els.board.appendChild(tile);
    }
  }
}

async function selectTile(row, col) {
  if (state.locked) return;

  if (state.activeTool) {
    await useTool(row, col);
    return;
  }

  if (!state.selected) {
    playSound("tap");
    state.selected = { row, col };
    render();
    return;
  }

  if (state.selected.row === row && state.selected.col === col) {
    playSound("tap");
    state.selected = null;
    render();
    return;
  }

  const previous = state.selected;
  const current = { row, col };
  state.selected = null;

  if (!areNeighbors(previous, current)) {
    playSound("tap");
    state.selected = current;
    render();
    return;
  }

  swap(previous, current);
  const specialMove = getSpecialSwap(previous, current);
  const groups = findMatchGroups(state.board);

  if (!groups.length && !specialMove) {
    swap(previous, current);
    playSound("miss");
    render();
    return;
  }

  state.moves -= 1;
  render();

  if (specialMove) {
    await resolveManualClear(expandSpecialClears(new Set([keyOf(specialMove.position)]), specialMove.targetAnimal), "特效触发");
  } else {
    await resolveMatches(groups, current);
  }

  checkEnd();
}

async function resolveMatches(initialGroups, preferredPosition = null) {
  state.locked = true;
  let groups = initialGroups;
  let combo = 1;

  while (groups.length) {
    const matchKeys = new Set();
    groups.forEach((group) => group.cells.forEach((cell) => matchKeys.add(keyOf(cell))));
    const specialToCreate = pickCreatedSpecial(groups, preferredPosition);
    const clearKeys = expandSpecialClears(matchKeys);

    if (specialToCreate) clearKeys.delete(keyOf(specialToCreate.position));
    markClearing([...clearKeys].map(posOf));
    await wait(190);

    const gained = clearKeys.size * 28 * combo + (specialToCreate ? 160 : 0);
    state.score += gained;
    showCombo(combo > 1 ? `连消 x${combo} +${gained}` : `+${gained}`);
    playSound(clearKeys.size >= 5 ? "burst" : "clear");

    clearKeys.forEach((key) => {
      const { row, col } = posOf(key);
      state.board[row][col] = null;
    });

    if (specialToCreate) {
      const { row, col } = specialToCreate.position;
      state.board[row][col] = makeTile(specialToCreate.animal, specialToCreate.special);
      showCombo(`${SPECIAL_MARKS[specialToCreate.special]} 特殊动物`);
      playSound("special");
      window.roiifyAds.track("special_created", {
        special: specialToCreate.special,
        level: state.level,
        combo
      });
    }

    dropTiles();
    fillTiles();
    render();
    await wait(180);
    groups = findMatchGroups(state.board);
    preferredPosition = null;
    combo += 1;
  }

  if (!hasMove(state.board)) {
    shuffleBoard();
    render();
  }

  state.locked = false;
}

async function resolveManualClear(seedKeys, label) {
  state.locked = true;
  const clearKeys = expandSpecialClears(seedKeys);
  markClearing([...clearKeys].map(posOf));
  await wait(190);
  const gained = clearKeys.size * 30;
  state.score += gained;
  showCombo(`${label} +${gained}`);
  playSound(clearKeys.size >= 4 ? "burst" : "clear");

  clearKeys.forEach((key) => {
    const { row, col } = posOf(key);
    state.board[row][col] = null;
  });

  dropTiles();
  fillTiles();
  render();
  await wait(160);
  const groups = findMatchGroups(state.board);
  if (groups.length) await resolveMatches(groups);
  state.locked = false;
  checkEnd();
}

function findMatchGroups(board) {
  const groups = [];

  for (let row = 0; row < SIZE; row += 1) {
    let run = [position(row, 0)];
    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && animalOf(board[row][col]) === animalOf(board[row][col - 1])) {
        run.push(position(row, col));
      } else {
        if (run.length >= 3) groups.push(makeGroup(run, "row", board));
        run = col < SIZE ? [position(row, col)] : [];
      }
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let run = [position(0, col)];
    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && animalOf(board[row][col]) === animalOf(board[row - 1][col])) {
        run.push(position(row, col));
      } else {
        if (run.length >= 3) groups.push(makeGroup(run, "column", board));
        run = row < SIZE ? [position(row, col)] : [];
      }
    }
  }

  return groups;
}

function makeGroup(cells, orientation, board) {
  const first = cells[0];
  return {
    cells,
    orientation,
    animal: animalOf(board[first.row][first.col]),
    length: cells.length
  };
}

function pickCreatedSpecial(groups, preferredPosition) {
  const longest = [...groups].sort((a, b) => b.length - a.length)[0];
  if (!longest || longest.length < 4) return null;

  let special = longest.orientation === "row" ? "row" : "column";
  if (longest.length >= 5) special = "bomb";
  if (groups.length >= 2) special = "rainbow";

  const allCells = groups.flatMap((group) => group.cells);
  const preferredKey = preferredPosition ? keyOf(preferredPosition) : "";
  const positionToUse = allCells.find((cell) => keyOf(cell) === preferredKey) || longest.cells[Math.floor(longest.cells.length / 2)];

  return {
    position: positionToUse,
    animal: special === "rainbow" ? "🐾" : longest.animal,
    special
  };
}

function expandSpecialClears(seedKeys, targetAnimal = null) {
  const clearKeys = new Set(seedKeys);
  const queue = [...seedKeys];
  const visitedSpecials = new Set();

  while (queue.length) {
    const key = queue.shift();
    if (visitedSpecials.has(key)) continue;
    visitedSpecials.add(key);

    const { row, col } = posOf(key);
    const cell = state.board[row]?.[col];
    if (!cell?.special) continue;

    const additions = specialAffectedKeys(cell, row, col, targetAnimal);
    additions.forEach((nextKey) => {
      if (!clearKeys.has(nextKey)) {
        clearKeys.add(nextKey);
        queue.push(nextKey);
      }
    });
  }

  return clearKeys;
}

function specialAffectedKeys(cell, row, col, targetAnimal) {
  const keys = [];

  if (cell.special === "bomb") {
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        if (inBounds(r, c)) keys.push(keyOf(position(r, c)));
      }
    }
  }

  if (cell.special === "row") {
    for (let c = 0; c < SIZE; c += 1) keys.push(keyOf(position(row, c)));
  }

  if (cell.special === "column") {
    for (let r = 0; r < SIZE; r += 1) keys.push(keyOf(position(r, col)));
  }

  if (cell.special === "rainbow") {
    const animal = targetAnimal || mostCommonAnimal();
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (animalOf(state.board[r][c]) === animal) keys.push(keyOf(position(r, c)));
      }
    }
    keys.push(keyOf(position(row, col)));
  }

  return keys;
}

function getSpecialSwap(a, b) {
  const first = state.board[a.row][a.col];
  const second = state.board[b.row][b.col];
  if (first.special) return { position: a, targetAnimal: second.animal };
  if (second.special) return { position: b, targetAnimal: first.animal };
  return null;
}

async function useTool(row, col) {
  const tool = state.activeTool;
  if (!tool || state.tools[tool] <= 0) return;

  state.tools[tool] -= 1;
  state.activeTool = null;
  playSound(tool === "bomb" ? "burst" : "clear");
  window.roiifyAds.track("tool_used", { tool, level: state.level, row, col });

  if (tool === "bomb") {
    const keys = new Set();
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        if (inBounds(r, c)) keys.add(keyOf(position(r, c)));
      }
    }
    await resolveManualClear(keys, "炸弹");
  }

  if (tool === "hammer") {
    await resolveManualClear(new Set([keyOf(position(row, col))]), "小锤");
  }
}

function toggleTool(tool) {
  if (state.locked) return;
  if (state.tools[tool] <= 0) {
    playSound("ad");
    grantToolsByAd(tool);
    return;
  }
  playSound("tap");
  state.selected = null;
  state.activeTool = state.activeTool === tool ? null : tool;
  render();
}

async function grantToolsByAd(source = "button") {
  if (state.locked || els.adPowerButton.disabled) return;
  els.adPowerButton.disabled = true;
  playSound("ad");
  showCombo("正在加载广告...");
  const result = await window.roiifyAds.refreshBannerForReward(els.bannerAd, source);
  els.adPowerButton.disabled = false;
  if (result?.rewarded || result?.completed) {
    state.tools.bomb += 1;
    state.tools.hammer += 1;
    render();
    showCombo("广告奖励 +道具");
    playSound("reward");
    window.roiifyAds.track("reward_granted", {
      reward: "tools",
      source,
      level: state.level,
      bomb: state.tools.bomb,
      hammer: state.tools.hammer
    });
  } else {
    showCombo("广告暂时不可用");
    window.roiifyAds.track("reward_skipped", {
      reward: "tools",
      source,
      level: state.level
    });
  }
}

function markClearing(matches) {
  matches.forEach(({ row, col }) => {
    const tile = els.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    tile?.classList.add("clearing");
  });
}

function dropTiles() {
  for (let col = 0; col < SIZE; col += 1) {
    const stack = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (state.board[row][col]) stack.push(state.board[row][col]);
    }
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      state.board[row][col] = stack[SIZE - 1 - row] || null;
    }
  }
}

function fillTiles() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!state.board[row][col]) state.board[row][col] = makeTile(randomAnimal());
    }
  }
}

async function checkEnd() {
  render();
  if (state.score >= state.target) {
    state.locked = true;
    state.activeTool = null;
    window.telegramGame?.notify("success");
    window.telegramGame?.sendScore(state.score, state.level, {
      target: state.target,
      movesLeft: state.moves
    });
    window.roiifyAds.track("level_complete", {
      score: state.score,
      level: state.level,
      target: state.target,
      movesLeft: state.moves
    });
    await window.roiifyAds.showInterstitial("level_complete");
    showResult("闯关成功", "可以进入下一关", `第 ${state.level} 关完成，得分 ${state.score}，剩余 ${state.moves} 步。`);
    return;
  }

  if (state.moves <= 0) {
    state.locked = true;
    state.activeTool = null;
    window.telegramGame?.notify("warning");
    const gap = Math.max(0, state.target - state.score);
    window.roiifyAds.track("level_failed", {
      score: state.score,
      level: state.level,
      target: state.target,
      gap
    });
    showResult("步数用完", `还差 ${gap} 分`, "观看激励广告可以获得 5 步，或者重新开始本关。");
  }
}

function showResult(kicker, title, text) {
  els.resultKicker.textContent = kicker;
  els.resultTitle.textContent = title;
  els.resultText.textContent = text;
  els.rewardButton.hidden = state.score >= state.target;
  els.nextButton.textContent = state.score >= state.target ? "下一关" : "重开本关";
  els.resultDialog.showModal();
}

function showHint() {
  if (state.locked) return;
  const move = findPossibleMove(state.board);
  if (!move) {
    shuffleBoard();
    render();
    return;
  }

  render();
  [move.from, move.to].forEach(({ row, col }) => {
    els.board.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.classList.add("hint");
  });
}

function findPossibleMove(board) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const from = { row, col };
      const candidates = [{ row, col: col + 1 }, { row: row + 1, col }];
      for (const to of candidates) {
        if (to.row >= SIZE || to.col >= SIZE) continue;
        if (board[row][col].special || board[to.row][to.col].special) return { from, to };
        swapOnBoard(board, from, to);
        const works = findMatchGroups(board).length > 0;
        swapOnBoard(board, from, to);
        if (works) return { from, to };
      }
    }
  }
  return null;
}

function countPossibleMoves(board) {
  let count = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const from = { row, col };
      const candidates = [{ row, col: col + 1 }, { row: row + 1, col }];
      for (const to of candidates) {
        if (to.row >= SIZE || to.col >= SIZE) continue;
        if (board[row][col].special || board[to.row][to.col].special) {
          count += 1;
          continue;
        }
        swapOnBoard(board, from, to);
        if (findMatchGroups(board).length > 0) count += 1;
        swapOnBoard(board, from, to);
      }
    }
  }
  return count;
}

function hasMove(board) {
  return Boolean(findPossibleMove(board));
}

function shuffleBoard() {
  do {
    const flat = state.board.flat().sort(() => Math.random() - 0.5);
    state.board = Array.from({ length: SIZE }, (_, row) => flat.slice(row * SIZE, row * SIZE + SIZE));
  } while (findMatchGroups(state.board).length || !hasMove(state.board));
  window.roiifyAds.track("board_shuffle", { level: state.level });
}

function mostCommonAnimal() {
  const counts = new Map();
  state.board.flat().forEach((cell) => {
    if (!cell) return;
    counts.set(cell.animal, (counts.get(cell.animal) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || randomAnimal();
}

function swap(a, b) {
  swapOnBoard(state.board, a, b);
}

function swapOnBoard(board, a, b) {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

function makeTile(animal, special = null) {
  return { animal, special };
}

function animalOf(cell) {
  return cell?.animal || "";
}

function describeTile(cell, row, col) {
  const special = cell.special ? `，${SPECIAL_MARKS[cell.special]} 特殊效果` : "";
  return `${cell.animal}${special}，第 ${row + 1} 行第 ${col + 1} 列`;
}

function areNeighbors(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function randomAnimal() {
  const poolSize = Math.min(ANIMALS.length, state.levelConfig?.animals || ANIMALS.length);
  const pool = ANIMALS.slice(0, poolSize);
  return pool[Math.floor(Math.random() * pool.length)];
}

function getAnimalFaceStyle(animal) {
  const styles = {
    "🐱": { x: "0px", y: "-2px", scale: "0.92" },
    "🐶": { x: "0px", y: "-3px", scale: "0.9" },
    "🐼": { x: "0px", y: "-2px", scale: "0.92" },
    "🦊": { x: "0px", y: "-3px", scale: "0.92" },
    "🐸": { x: "0px", y: "1px", scale: "0.88" },
    "🐵": { x: "0px", y: "-2px", scale: "0.9" },
    "🐾": { x: "0px", y: "-1px", scale: "0.9" }
  };
  return styles[animal] || { x: "0px", y: "-2px", scale: "0.9" };
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function position(row, col) {
  return { row, col };
}

function keyOf({ row, col }) {
  return `${row},${col}`;
}

function posOf(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

function showCombo(text) {
  els.comboPop.textContent = text;
  els.comboPop.classList.remove("show");
  void els.comboPop.offsetWidth;
  els.comboPop.classList.add("show");
}

function initAudioPool() {
  if (playSound.pool) return;
  playSound.pool = {};
  playSound.poolIndex = {};

  Object.entries(SOUND_SOURCES).forEach(([type, src]) => {
    playSound.pool[type] = Array.from({ length: 4 }, () => {
      const audio = document.createElement("audio");
      audio.src = `${src}?v=2`;
      audio.preload = "auto";
      audio.volume = 0.95;
      audio.setAttribute("playsinline", "");
      audio.style.display = "none";
      document.body.appendChild(audio);
      return audio;
    });
    playSound.poolIndex[type] = 0;
  });
}

function playSound(type) {
  if (playPooledAudio(type)) return;

  const audio = getAudioContext();
  if (!audio) {
    playAudioElementTone(type);
    return;
  }

  const play = () => {
    const patterns = {
      tap: [520, 0.055, "sine", 0.045],
      miss: [160, 0.1, "triangle", 0.05],
      clear: [700, 0.1, "sine", 0.07],
      burst: [120, 0.18, "sawtooth", 0.08],
      special: [920, 0.16, "triangle", 0.075],
      ad: [560, 0.1, "square", 0.055],
      reward: [780, 0.2, "sine", 0.08]
    };
    const [frequency, duration, wave, gainValue] = patterns[type] || patterns.tap;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (type === "reward" || type === "special") {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.45, now + duration);
    }
    if (type === "burst") {
      oscillator.frequency.exponentialRampToValueAtTime(70, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  };

  if (audio.state === "suspended") {
    audio.resume().then(play).catch(() => {});
    return;
  }

  play();
}

function unlockAudio() {
  initAudioPool();
  Object.values(playSound.pool || {}).forEach((items) => {
    const audio = items[0];
    if (!audio) return;
    const volume = audio.volume;
    audio.volume = 0;
    audio.muted = true;
    const result = audio.play();
    if (result?.then) {
      result
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = volume;
        })
        .catch(() => {
          audio.muted = false;
          audio.volume = volume;
        });
    } else {
      audio.muted = false;
      audio.volume = volume;
    }
  });

  const audio = getAudioContext();
  if (!audio) return Promise.resolve();
  if (audio.state === "running") return Promise.resolve();
  return audio.resume().catch(() => {});
}

function playPooledAudio(type) {
  initAudioPool();
  const items = playSound.pool?.[type] || playSound.pool?.tap;
  if (!items?.length) return false;

  const index = playSound.poolIndex[type] || 0;
  const audio = items[index % items.length];
  playSound.poolIndex[type] = index + 1;

  audio.muted = false;
  audio.volume = type === "burst" || type === "reward" ? 1 : 0.92;
  audio.pause();
  audio.currentTime = 0;
  const result = audio.play();
  if (result?.catch) {
    result.catch(() => playAudioElementTone(type));
  }
  return true;
}

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!getAudioContext.context) {
    getAudioContext.context = new AudioContext();
  }
  return getAudioContext.context;
}

function playAudioElementTone(type) {
  if (!document?.createElement) return;
  const patterns = {
    tap: [520, 0.055, 0.28],
    miss: [160, 0.1, 0.24],
    clear: [700, 0.1, 0.34],
    burst: [120, 0.18, 0.38],
    special: [920, 0.16, 0.36],
    ad: [560, 0.1, 0.28],
    reward: [780, 0.2, 0.38]
  };
  const [frequency, duration, volume] = patterns[type] || patterns.tap;
  const audio = document.createElement("audio");
  audio.src = makeToneWav(frequency, duration, volume);
  audio.volume = 1;
  audio.preload = "auto";
  audio.play().catch(() => {});
}

function makeToneWav(frequency, duration, volume) {
  const sampleRate = 22050;
  const sampleCount = Math.max(1, Math.floor(sampleRate * duration));
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.sin(Math.PI * i / sampleCount);
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * volume;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
