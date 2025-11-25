// ChronoCraft Demo v2
// Демо-версия Telegram Mini App игры с прокачкой, боями и магазином.

const STORAGE_KEY = "chronocraft_demo_v2";

const defaultState = {
  level: 1,
  exp: 0,
  expToNext: 100,
  hpMax: 50,
  hpCurrent: 50,
  attack: 8,
  gold: 300,
  crystals: 0,
  energy: 5,
  energyMax: 5,
  stats: {
    wins: 0,
    losses: 0,
    bestTier: 0,
  },
  artifacts: [],
  lastOfflineClaim: 0,
};

let state = loadState();
let currentRun = null; // { tier, enemyHp, room, rewardGold, rewardExp, alive }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch (e) {
    console.error("Failed to load state", e);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function updateHeader() {
  byId("goldAmount").textContent = state.gold;
  byId("crystalAmount").textContent = state.crystals;
  byId("energyAmount").textContent = state.energy;
  byId("energyMax").textContent = state.energyMax;
}

function updatePlayerPanel() {
  byId("playerLevel").textContent = state.level;
  byId("hpCurrent").textContent = Math.max(0, Math.round(state.hpCurrent));
  byId("hpMax").textContent = state.hpMax;
  byId("attackPower").textContent = state.attack;
  byId("artifactCount").textContent = state.artifacts.length;

  byId("expCurrent").textContent = state.exp;
  byId("expToNext").textContent = state.expToNext;
  const fill = Math.max(0, Math.min(1, state.exp / state.expToNext));
  byId("expFill").style.width = `${fill * 100}%`;
}

function updateStatsPanel() {
  byId("statWins").textContent = state.stats.wins;
  byId("statLosses").textContent = state.stats.losses;
  byId("statBestTier").textContent = state.stats.bestTier;
}

function renderArtifacts() {
  const list = byId("artifactList");
  list.innerHTML = "";
  if (!state.artifacts.length) {
    const li = document.createElement("li");
    li.textContent = "Пока нет артефактов.";
    li.className = "artifact-rarity-common";
    list.appendChild(li);
    return;
  }
  state.artifacts.forEach((a) => {
    const li = document.createElement("li");
    li.textContent = `${a.name} (${a.rarity}) — ${a.desc}`;
    li.className = `artifact-rarity-${a.rarity.toLowerCase()}`;
    list.appendChild(li);
  });
}

function logBattle(message) {
  const container = byId("battleLogContent");
  const entry = document.createElement("div");
  entry.className = "battle-log-entry";
  entry.innerHTML = `<span class="turn">•</span>${message}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function setRunStatus(text) {
  byId("runStatus").textContent = text;
}

function setBattleButtonsEnabled(enabled) {
  byId("manualAttackBtn").disabled = !enabled;
  byId("manualSkillBtn").disabled = !enabled;
  byId("manualFleeBtn").disabled = !enabled;
}

// EXP / Level

function gainExp(amount) {
  state.exp += amount;
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level += 1;
    state.hpMax += 6;
    state.attack += 2;
    state.hpCurrent = state.hpMax;
    state.expToNext = Math.round(state.expToNext * 1.25);
  }
}

// Run / Battle

function startRun(tier) {
  if (state.energy <= 0) {
    alert("Недостаточно энергии для забега!");
    return;
  }

  const baseEnemyHp = 30 + tier * 25 + state.level * 3;
  const rewardGold = 70 * tier + state.level * 10;
  const rewardExp = 40 * tier + state.level * 8;

  currentRun = {
    tier,
    enemyHp: baseEnemyHp,
    room: 1,
    rewardGold,
    rewardExp,
    alive: true,
  };

  state.energy -= 1;
  state.hpCurrent = state.hpMax;
  saveState();
  updateHeader();
  updatePlayerPanel();

  byId("battleLogContent").innerHTML = "";
  setRunStatus(`Сложность ${tier}, комната 1. Враг HP: ${Math.round(currentRun.enemyHp)}.`);
  logBattle("Ты входишь в подземелье. На тебя бросается первый враг!");

  setBattleButtonsEnabled(true);
}

function enemyAttack() {
  if (!currentRun || !currentRun.alive) return;
  const tier = currentRun.tier;
  const baseDamage = 4 + tier * 3;
  const spread = Math.random() * 4;
  const dmg = Math.round(baseDamage + spread);
  state.hpCurrent -= dmg;
  logBattle(
    `Враг ударяет по тебе на ${dmg} урона. (HP героя: ${Math.max(
      0,
      Math.round(state.hpCurrent)
    )}/${state.hpMax})`
  );

  if (state.hpCurrent <= 0) {
    state.hpCurrent = 0;
    currentRun.alive = false;
    endRun(false);
  } else {
    saveState();
    updatePlayerPanel();
  }
}

function playerAttack(isSkill = false) {
  if (!currentRun || !currentRun.alive) return;
  let dmg = state.attack + Math.floor(Math.random() * 4);
  if (isSkill) {
    dmg = Math.round(dmg * 1.8);
    state.hpCurrent = Math.max(1, state.hpCurrent - 2);
  }

  currentRun.enemyHp -= dmg;
  logBattle(
    `${isSkill ? "Мощный удар" : "Удар"} по врагу на ${dmg} урона. (HP врага: ${Math.max(
      0,
      Math.round(currentRun.enemyHp)
    )})`
  );

  if (state.hpCurrent <= 0) {
    state.hpCurrent = 0;
  }
  updatePlayerPanel();

  if (currentRun.enemyHp <= 0) {
    logBattle("Враг повержен!");
    nextRoomOrEnd();
  } else {
    enemyAttack();
  }
}

function nextRoomOrEnd() {
  if (!currentRun) return;
  const tier = currentRun.tier;
  const roomsTotal = 3 + tier;
  const partialGold = Math.round(currentRun.rewardGold * 0.25);
  const partialExp = Math.round(currentRun.rewardExp * 0.25);

  state.gold += partialGold;
  gainExp(partialExp);

  logBattle(
    `Промежуточная награда: +${partialGold} 🪙, +${partialExp} опыта.`
  );

  saveState();
  updateHeader();
  updatePlayerPanel();

  if (currentRun.room >= roomsTotal) {
    endRun(true);
    return;
  }

  currentRun.room += 1;
  const scale = 1 + currentRun.room * 0.2;
  currentRun.enemyHp = Math.round(currentRun.enemyHp * scale);
  state.hpCurrent = Math.min(state.hpMax, state.hpCurrent + 5);

  logBattle(
    `Ты переходишь в комнату ${currentRun.room}. Враг усилился! HP врага: ${Math.round(
      currentRun.enemyHp
    )}.`
  );

  setRunStatus(
    `Сложность ${tier}, комната ${currentRun.room}. Враг HP: ${Math.round(
      currentRun.enemyHp
    )}.`
  );
  saveState();
  updatePlayerPanel();
}

function endRun(success) {
  if (!currentRun) return;

  setBattleButtonsEnabled(false);

  if (success) {
    const remainingGold = Math.max(0, currentRun.rewardGold - 0);
    const remainingExp = Math.max(0, currentRun.rewardExp - 0);
    state.gold += remainingGold;
    gainExp(remainingExp);
    state.stats.wins += 1;
    state.stats.bestTier = Math.max(state.stats.bestTier, currentRun.tier);

    logBattle(
      `Забег завершён! Доп. награда: +${remainingGold} 🪙, +${remainingExp} опыта.`
    );
    setRunStatus("Забег успешно завершён! Можешь начать новый.");
  } else {
    state.stats.losses += 1;
    setRunStatus("Ты пал в подземелье. Награда урезана, но опыт — это тоже прогресс.");
  }

  currentRun = null;
  state.hpCurrent = Math.max(1, state.hpCurrent);
  saveState();
  updateHeader();
  updatePlayerPanel();
  updateStatsPanel();
}

// Artifacts

const demoArtifactsPool = [
  {
    name: "Кольцо временных петель",
    rarity: "Epic",
    desc: "+10% к опыту (в демо просто снижает порог уровня).",
  },
  {
    name: "Амулет хладного расчёта",
    rarity: "Rare",
    desc: "+3 к атаке.",
  },
  {
    name: "Часы берсерка",
    rarity: "Legendary",
    desc: "Даёт +4 к атаке (в демо).",
  },
  {
    name: "Талисман удачи фармера",
    rarity: "Rare",
    desc: "+200 🪙 при получении.",
  },
  {
    name: "Треснувший песочные часы",
    rarity: "Common",
    desc: "+5 к HP.",
  },
];

function addRandomArtifact() {
  const pick = demoArtifactsPool[Math.floor(Math.random() * demoArtifactsPool.length)];
  state.artifacts.push(pick);

  if (pick.desc.includes("опыту")) {
    state.expToNext = Math.max(20, Math.round(state.expToNext * 0.95));
  }
  if (pick.desc.includes("+3 к атаке")) {
    state.attack += 3;
  }
  if (pick.desc.includes("+5 к HP")) {
    state.hpMax += 5;
  }
  if (pick.desc.includes("+4 к атаке")) {
    state.attack += 4;
  }
  if (pick.desc.includes("+200 🪙")) {
    state.gold += 200;
  }

  saveState();
  updateHeader();
  updatePlayerPanel();
  renderArtifacts();
}

// Offline reward (simplified)

function claimOfflineReward() {
  const now = Date.now();
  const minInterval = 3 * 60 * 1000; // 3 минуты
  if (state.lastOfflineClaim && now - state.lastOfflineClaim < minInterval) {
    alert("Оффлайн-награда уже забрана. Попробуй чуть позже (в демо интервал 3 минуты).");
    return;
  }
  state.lastOfflineClaim = now;
  state.gold += 150;
  state.energy = Math.min(state.energyMax, state.energy + 1);
  saveState();
  updateHeader();
  alert("Ты забрал оффлайн-награду: +150 🪙 и +1 ⚡.");
}

// Upgrades

function buyUpgrade(type, cost) {
  if (state.gold < cost) {
    alert("Недостаточно золота.");
    return;
  }
  state.gold -= cost;
  if (type === "hp") {
    state.hpMax += 10;
    state.hpCurrent = state.hpMax;
  } else if (type === "atk") {
    state.attack += 2;
  } else if (type === "energy") {
    state.energyMax += 1;
    state.energy = state.energyMax;
  }
  saveState();
  updateHeader();
  updatePlayerPanel();
}

// Shop

function buyCrystals(amount) {
  // В реальной игре здесь был бы вызов Telegram Payments
  state.crystals += amount;
  saveState();
  updateHeader();
  alert(`Демо-покупка: начислено ${amount} 💎.`);
}

function exchangeCrystalsForGold(cost, gain) {
  if (state.crystals < cost) {
    alert("Недостаточно кристаллов.");
    return;
  }
  state.crystals -= cost;
  state.gold += gain;
  saveState();
  updateHeader();
  alert(`Обмен успешно выполнен: -${cost} 💎, +${gain} 🪙.`);
}

function buyEnergyWithCrystals(cost, gain) {
  if (state.crystals < cost) {
    alert("Недостаточно кристаллов.");
    return;
  }
  state.crystals -= cost;
  state.energy = Math.min(state.energyMax, state.energy + gain);
  saveState();
  updateHeader();
  alert(`Куплено: +${gain} ⚡ за ${cost} 💎.`);
}

// Tabs

function initTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const tabs = document.querySelectorAll(".tab");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      buttons.forEach((b) => b.classList.remove("active"));
      tabs.forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");
    });
  });
}

// Difficulty

function initDifficultyButtons() {
  const buttons = document.querySelectorAll(".difficulty-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function getSelectedTier() {
  const btn = document.querySelector(".difficulty-button.active");
  if (!btn) return 1;
  return parseInt(btn.getAttribute("data-tier") || "1", 10);
}

// Init

function initBattleControls() {
  byId("startRunBtn").addEventListener("click", () => {
    const tier = getSelectedTier();
    startRun(tier);
  });

  byId("manualAttackBtn").addEventListener("click", () => playerAttack(false));
  byId("manualSkillBtn").addEventListener("click", () => playerAttack(true));
  byId("manualFleeBtn").addEventListener("click", () => {
    if (!currentRun) return;
    logBattle("Ты решаешь отступить и покидаешь подземелье.");
    endRun(false);
  });
}

function initTownControls() {
  byId("claimOffline").addEventListener("click", claimOfflineReward);
}

function initUpgradeControls() {
  document.querySelectorAll(".upgrade-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-upgrade");
      const cost = parseInt(btn.getAttribute("data-cost") || "0", 10);
      buyUpgrade(type, cost);
    });
  });

  byId("getDemoArtifact").addEventListener("click", () => {
    addRandomArtifact();
    alert("Ты получил новый демо-артефакт!");
  });
}

function initShopControls() {
  document.querySelectorAll(".buy-crystals").forEach((btn) => {
    btn.addEventListener("click", () => {
      const amount = parseInt(btn.getAttribute("data-amount") || "0", 10);
      buyCrystals(amount);
    });
  });

  document.querySelectorAll(".buy-gold").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cost = parseInt(btn.getAttribute("data-cost") || "0", 10);
      const gain = parseInt(btn.getAttribute("data-gain") || "0", 10);
      exchangeCrystalsForGold(cost, gain);
    });
  });

  document.querySelectorAll(".buy-energy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cost = parseInt(btn.getAttribute("data-cost") || "0", 10);
      const gain = parseInt(btn.getAttribute("data-gain") || "0", 10);
      buyEnergyWithCrystals(cost, gain);
    });
  });
}

function initTelegram() {
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  } catch (e) {
    console.warn("Telegram WebApp init failed or not in Telegram context.", e);
  }
}

window.addEventListener("load", () => {
  updateHeader();
  updatePlayerPanel();
  updateStatsPanel();
  renderArtifacts();
  initTabs();
  initDifficultyButtons();
  initBattleControls();
  initTownControls();
  initUpgradeControls();
  initShopControls();
  initTelegram();
});
