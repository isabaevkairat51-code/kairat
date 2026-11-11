(() => {
"use strict";

/* =========================
   ОСНОВНЫЕ НАСТРОЙКИ
========================= */

const $ = id => document.getElementById(id);

const socket = typeof io === "function" ? io() : null;

const COINS = [
    {name:"Bitcoin",price:300},
    {name:"Ethereum",price:220},
    {name:"Solana",price:140},
    {name:"BNB",price:90},
    {name:"XRP",price:60},
    {name:"Cardano",price:45},
    {name:"Avalanche",price:75},
    {name:"Polygon",price:35},
    {name:"Dogecoin",price:20},
    {name:"Chainlink",price:55},
    {name:"TRON",price:25}
];

const SPACES = [
    {type:"start",title:"СТАРТ"},
    {type:"asset",title:"Bitcoin",price:300,rent:60},
    {type:"event",title:"Новости рынка"},
    {type:"asset",title:"Ethereum",price:240,rent:45},
    {type:"tax",title:"Налог",amount:100},
    {type:"asset",title:"Solana",price:180,rent:35},
    {type:"event",title:"Случайное событие"},
    {type:"asset",title:"BNB",price:150,rent:30},
    {type:"tax",title:"Комиссия",amount:70},
    {type:"asset",title:"XRP",price:120,rent:25},
    {type:"event",title:"Новости рынка"},
    {type:"asset",title:"Cardano",price:100,rent:20},
    {type:"asset",title:"Avalanche",price:140,rent:28},
    {type:"tax",title:"Налог",amount:90},
    {type:"asset",title:"Polygon",price:80,rent:16},
    {type:"event",title:"Случайное событие"},
    {type:"asset",title:"Dogecoin",price:70,rent:14},
    {type:"asset",title:"Chainlink",price:110,rent:22},
    {type:"tax",title:"Комиссия",amount:60},
    {type:"asset",title:"TRON",price:75,rent:15}
];

/* =========================
   СОСТОЯНИЕ ИГРЫ
========================= */

let mode = "local";
let selectedCount = 4;

let localState = null;
let onlineState = null;

let roomCode = "";
let myId = null;

let pendingPurchase = false;

/* =========================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================= */

function showMessage(text,error=false,target="menuMessage") {
    const el = $(target);

    if (!el) {
        console.warn("Не найден элемент:",target);
        return;
    }

    el.textContent = text;
    el.style.color = error ? "#ff7373" : "#91a0b8";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g,char=>({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
    }[char]));
}

function showScreen(game) {
    const menu = $("menuScreen");
    const screen = $("gameScreen");

    if (!menu || !screen) return;

    menu.classList.toggle("hidden",game);
    screen.classList.toggle("hidden",!game);
}

function currentState() {
    return mode === "local" ? localState : onlineState;
}

function emit(event,data={}) {
    if (!socket || !socket.connected) {
        showMessage(
            "Нет соединения с сервером.",
            true,
            "gameMessage"
        );
        return;
    }

    if (!roomCode) {
        showMessage(
            "Сначала создай комнату или войди в неё.",
            true,
            "gameMessage"
        );
        return;
    }

    socket.emit(event,{
        roomCode,
        ...data
    });
}

function setText(id,value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setDisabled(id,value) {
    const el = $(id);
    if (el) el.disabled = value;
}

function setHidden(id,value) {
    const el = $(id);
    if (el) el.classList.toggle("hidden",value);
}

/* =========================
   ВЫБОР РЕЖИМА
========================= */

function setMode(value) {
    mode = value;

    $("localModeBtn")?.classList.toggle(
        "selected",
        value==="local"
    );

    $("onlineModeBtn")?.classList.toggle(
        "selected",
        value==="online"
    );

    setHidden("localSetup",value!=="local");
    setHidden("onlineSetup",value!=="online");

    showMessage("");
}

$("localModeBtn")?.addEventListener("click",()=>{
    setMode("local");
});

$("onlineModeBtn")?.addEventListener("click",()=>{
    setMode("online");
});

/* =========================
   ИМЕНА ИГРОКОВ
========================= */

function drawLocalNames() {
    const container = $("localNames");

    if (!container) return;

    container.innerHTML = "";

    for (let i=0;i<selectedCount;i++) {
        const div = document.createElement("div");

        div.style.minWidth = "130px";

        div.innerHTML = `
            <label>Игрок ${i+1}</label>
            <input
                id="localName${i}"
                maxlength="18"
                value="Игрок ${i+1}"
            >
        `;

        container.appendChild(div);
    }

    document.querySelectorAll(".player-option").forEach(btn=>{
        btn.classList.toggle(
            "active",
            Number(btn.dataset.count)===selectedCount
        );
    });
}

$("playerOptions")?.addEventListener("click",event=>{
    const btn = event.target.closest("[data-count]");

    if (!btn) return;

    const count = Number(btn.dataset.count);

    if (!Number.isInteger(count) || count<2 || count>6) {
        return;
    }

    selectedCount = count;
    drawLocalNames();
});

/* =========================
   СОЗДАНИЕ СОСТОЯНИЯ
========================= */

function createState(players) {
    return {
        status:"playing",
        currentTurn:0,

        players:players.map(player=>({
            ...player,
            cash:1800,
            position:0,
            assets:[],
            portfolio:{},
            bankrupt:false
        })),

        spaces:SPACES.map(space=>({...space})),

        market:COINS.map(coin=>({
            ...coin,
            change:0
        })),

        log:["🚀 Игра началась!"],

        lastRoll:null,
        winner:null
    };
}

/* =========================
   НАЧАЛО ЛОКАЛЬНОЙ ИГРЫ
========================= */

$("startLocalBtn")?.addEventListener("click",()=>{
    const names = [];

    for (let i=0;i<selectedCount;i++) {
        const input = $(`localName${i}`);

        const value = input
            ? input.value.trim()
            : "";

        names.push({
            id:`local-${i}`,
            name:value || `Игрок ${i+1}`
        });
    }

    localState = createState(names);

    pendingPurchase = false;
    onlineState = null;

    mode = "local";

    setText("modeLabel","Локальная игра");

    showScreen(true);

    showMessage(
        "Локальная игра началась.",
        false,
        "gameMessage"
    );

    render();
});

/* =========================
   ONLINE SOCKET.IO
========================= */

if (socket) {

    socket.on("connect",()=>{
        myId = socket.id;

        console.log("Socket.IO подключён:",myId);
    });

    socket.on("connect_error",error=>{
        console.error("Ошибка подключения:",error);

        showMessage(
            "Не удалось подключиться к серверу.",
            true
        );
    });

    socket.on("disconnect",()=>{
        showMessage(
            "Соединение с сервером потеряно.",
            true
        );
    });

    socket.on("roomCreated",data=>{
        if (!data || !data.code) return;

        mode = "online";
        roomCode = data.code;

        setText("roomCodeLabel",roomCode);

        setHidden("onlineLobby",false);

        showMessage(
            "Комната создана. Отправь код друзьям."
        );
    });

    socket.on("gameError",message=>{
        const target = $("gameScreen")?.classList.contains("hidden")
            ? "menuMessage"
            : "gameMessage";

        showMessage(
            typeof message==="string"
                ? message
                : "Произошла ошибка.",
            true,
            target
        );
    });

    socket.on("roomUpdate",state=>{
        if (!state || !Array.isArray(state.players)) {
            console.error("Получено неправильное состояние комнаты:",state);
            return;
        }

        onlineState = state;
        roomCode = state.code || roomCode;
        mode = "online";

        setText("roomCodeLabel",roomCode);

        setHidden("onlineLobby",false);

        const playersContainer = $("onlinePlayers");

        if (playersContainer) {
            playersContainer.innerHTML =
                state.players.map(player=>`
                    <div class="player-row">
                        <span>${escapeHTML(player.name)}</span>
                        <strong>${Number(player.cash||0).toFixed(2)} CR</strong>
                    </div>
                `).join("");
        }

        if (
            state.status==="playing" ||
            state.status==="finished"
        ) {
            setText("modeLabel",`Онлайн · ${roomCode}`);

            showScreen(true);
            render();
        }
    });
}

/* =========================
   СОЗДАНИЕ ОНЛАЙН-КОМНАТЫ
========================= */

$("createRoomBtn")?.addEventListener("click",()=>{
    if (!socket) {
        return showMessage(
            "Socket.IO не загружен. Проверь index.html.",
            true
        );
    }

    if (!socket.connected) {
        return showMessage(
            "Сервер недоступен. Запусти сервер.",
            true
        );
    }

    mode = "online";

    const name =
        $("onlineName")?.value.trim() || "Игрок";

    socket.emit("createRoom",{name});
});

/* =========================
   ВХОД В КОМНАТУ
========================= */

$("joinRoomBtn")?.addEventListener("click",()=>{
    const code =
        $("roomCodeInput")?.value.trim().toUpperCase() || "";

    if (!code) {
        return showMessage(
            "Введи код комнаты.",
            true
        );
    }

    if (!socket || !socket.connected) {
        return showMessage(
            "Сервер недоступен.",
            true
        );
    }

    mode = "online";

    const name =
        $("onlineName")?.value.trim() || "Игрок";

    socket.emit("joinRoom",{
        name,
        roomCode:code
    });
});

/* =========================
   НАЧАТЬ ОНЛАЙН-ИГРУ
========================= */

$("startOnlineBtn")?.addEventListener("click",()=>{
    emit("startGame");
});

/* =========================
   ВЫХОД В МЕНЮ
========================= */

$("backToMenuBtn")?.addEventListener("click",()=>{
    if (mode==="local") {
        localState = null;
        pendingPurchase = false;

        showScreen(false);
        return;
    }

    showMessage(
        "Для выхода из онлайн-комнаты обнови страницу."
    );
});

/* =========================
   ИГРОКИ И ХОДЫ
========================= */

function activePlayer() {
    if (!localState) return null;

    return localState.players[localState.currentTurn] || null;
}

function addLog(state,text) {
    if (!state || !Array.isArray(state.log)) return;

    state.log.push(text);

    if (state.log.length>60) {
        state.log.shift();
    }
}

function charge(player,amount,state) {
    if (!player || !state) return;

    player.cash -= amount;

    if (player.cash<0) {
        player.cash = 0;
        player.bankrupt = true;

        addLog(
            state,
            `💀 ${player.name} обанкротился!`
        );
    }
}

function finishLocal() {
    if (!localState) return false;

    const alive = localState.players.filter(
        player=>!player.bankrupt
    );

    if (alive.length<=1) {
        localState.status = "finished";

        localState.winner =
            alive[0]?.id || null;

        if (alive[0]) {
            addLog(
                localState,
                `🏆 ${alive[0].name} победил!`
            );
        }

        return true;
    }

    return false;
}

function nextLocalTurn() {
    if (!localState) return;

    if (finishLocal()) return;

    for (let i=0;i<localState.players.length;i++) {
        localState.currentTurn =
            (localState.currentTurn+1)%localState.players.length;

        const player = activePlayer();

        if (player && !player.bankrupt) {
            break;
        }
    }
}

/* =========================
   БРОСОК КУБИКА
========================= */

$("rollDiceBtn")?.addEventListener("click",()=>{
    if (mode==="online") {
        emit("rollDice");
    } else {
        localRoll();
    }
});

function localRoll() {
    const state = localState;
    const player = activePlayer();

    if (
        !state ||
        state.status!=="playing" ||
        pendingPurchase ||
        !player ||
        player.bankrupt
    ) {
        return;
    }

    const roll = 1+Math.floor(Math.random()*6);

    const oldPosition = player.position;

    const newPosition =
        (oldPosition+roll)%SPACES.length;

    if (oldPosition+roll>=SPACES.length) {
        player.cash += 200;

        addLog(
            state,
            `${player.name} прошёл старт и получил 200 CR.`
        );
    }

    player.position = newPosition;

    state.lastRoll = {
        player:player.name,
        value:roll
    };

    const cell = SPACES[newPosition];

    addLog(
        state,
        `🎲 ${player.name} выбросил ${roll} и попал на ${cell.title}.`
    );

    if (cell.type==="tax") {
        charge(player,cell.amount,state);

        addLog(
            state,
            `${player.name} заплатил ${cell.amount} CR.`
        );
    }

    if (cell.type==="event") {
        const won = Math.random()<0.5;
        const amount = won ? 120 : 90;

        if (won) {
            player.cash += amount;

            addLog(
                state,
                `${player.name} получил бонус ${amount} CR.`
            );
        } else {
            charge(player,amount,state);

            addLog(
                state,
                `${player.name} потерял ${amount} CR.`
            );
        }
    }

    if (cell.type==="asset") {
        const owner = state.players.find(
            p=>p.assets.includes(newPosition)
        );

        if (owner && owner.id!==player.id) {
            charge(player,cell.rent,state);

            if (!player.bankrupt) {
                owner.cash += cell.rent;
            }

            addLog(
                state,
                `${player.name} заплатил аренду ${cell.rent} CR игроку ${owner.name}.`
            );
        }

        else if (!owner && player.cash>=cell.price) {
            pendingPurchase = true;

            render();
            return;
        }
    }

    if (player.bankrupt) {
        finishLocal();
    }

    nextLocalTurn();
    render();
}

/* =========================
   ПОКУПКА АКТИВА
========================= */

$("buyAssetBtn")?.addEventListener("click",()=>{
    if (mode==="online") {
        emit("buyAsset");
    } else {
        localBuy();
    }
});

function localBuy() {
    const player = activePlayer();

    if (!player || !pendingPurchase || !localState) {
        return;
    }

    const cell = SPACES[player.position];

    if (
        cell.type!=="asset" ||
        player.cash<cell.price
    ) {
        return;
    }

    player.cash -= cell.price;

    player.assets.push(player.position);

    addLog(
        localState,
        `💰 ${player.name} купил ${cell.title} за ${cell.price} CR.`
    );

    pendingPurchase = false;

    nextLocalTurn();
    render();
}

/* =========================
   ПРОПУСК ПОКУПКИ
========================= */

$("skipPurchaseBtn")?.addEventListener("click",()=>{
    if (mode==="online") {
        emit("skipPurchase");
        return;
    }

    if (!pendingPurchase || !localState) {
        return;
    }

    const player = activePlayer();

    if (player) {
        addLog(
            localState,
            `${player.name} пропустил покупку.`
        );
    }

    pendingPurchase = false;

    nextLocalTurn();
    render();
});

/* =========================
   ПОКУПКА И ПРОДАЖА МОНЕТ
========================= */

$("buyCoinBtn")?.addEventListener("click",()=>{
    tradeCoin(true);
});

$("sellCoinBtn")?.addEventListener("click",()=>{
    tradeCoin(false);
});

function tradeCoin(isBuy) {
    const coin = $("tradeCoin")?.value;

    const quantity = Number(
        $("tradeQuantity")?.value
    );

    if (
        !Number.isFinite(quantity) ||
        quantity<=0
    ) {
        return showMessage(
            "Введи количество больше нуля.",
            true,
            "gameMessage"
        );
    }

    if (!coin) {
        return showMessage(
            "Выбери криптовалюту.",
            true,
            "gameMessage"
        );
    }

    if (mode==="online") {
        emit(
            isBuy ? "buyCoin" : "sellCoin",
            {coin,quantity}
        );

        return;
    }

    const state = localState;
    const player = activePlayer();

    if (!state || !player) return;

    const marketCoin = state.market.find(
        c=>c.name===coin
    );

    if (!marketCoin) {
        return showMessage(
            "Эта монета не найдена.",
            true,
            "gameMessage"
        );
    }

    if (isBuy) {
        const cost = Math.round(
            marketCoin.price*quantity*100
        )/100;

        if (player.cash<cost) {
            return showMessage(
                "Недостаточно CR.",
                true,
                "gameMessage"
            );
        }

        player.cash -= cost;

        player.portfolio[coin] =
            (player.portfolio[coin]||0)+quantity;

        addLog(
            state,
            `${player.name} купил ${quantity} ${coin} за ${cost.toFixed(2)} CR.`
        );
    }

    else {
        const owned = player.portfolio[coin]||0;

        if (quantity>owned) {
            return showMessage(
                "Недостаточно монет в портфеле.",
                true,
                "gameMessage"
            );
        }

        player.portfolio[coin] =
            owned-quantity;

        const revenue = Math.round(
            marketCoin.price*quantity*100
        )/100;

        player.cash += revenue;

        addLog(
            state,
            `${player.name} продал ${quantity} ${coin} за ${revenue.toFixed(2)} CR.`
        );
    }

    render();
}

/* =========================
   СТАВКА НА РЫНОК
========================= */

$("marketBetBtn")?.addEventListener("click",()=>{
    const coin = $("betCoin")?.value;

    const direction =
        $("betDirection")?.value;

    const amount = Number(
        $("marketBetAmount")?.value
    );

    if (
        !Number.isFinite(amount) ||
        amount<=0
    ) {
        return showMessage(
            "Введи правильную сумму.",
            true,
            "gameMessage"
        );
    }

    if (!coin) {
        return showMessage(
            "Выбери криптовалюту.",
            true,
            "gameMessage"
        );
    }

    if (mode==="online") {
        emit("placeMarketBet",{
            coin,
            direction,
            amount
        });

        return;
    }

    const state = localState;
    const player = activePlayer();

    if (!state || !player) return;

    const marketCoin = state.market.find(
        c=>c.name===coin
    );

    if (!marketCoin) {
        return showMessage(
            "Монета не найдена.",
            true,
            "gameMessage"
        );
    }

    if (amount>player.cash) {
        return showMessage(
            "Недостаточно CR.",
            true,
            "gameMessage"
        );
    }

    player.cash -= amount;

    const oldPrice = marketCoin.price;

    marketCoin.price = Math.max(
        1,
        Math.round(
            oldPrice*(0.85+Math.random()*0.30)*100
        )/100
    );

    marketCoin.change = Math.round(
        (marketCoin.price/oldPrice-1)*10000
    )/100;

    const won = direction==="up"
        ? marketCoin.price>oldPrice
        : marketCoin.price<oldPrice;

    if (won) {
        player.cash += amount*1.8;
    }

    addLog(
        state,
        `${player.name} поставил ${amount} CR на ${coin}. ${won?"Победа!":"Проигрыш."}`
    );

    render();
});

/* =========================
   ПРОВЕРКА ОНЛАЙН-ПОКУПКИ
========================= */

function canBuyOnlineAsset(state,active) {
    if (
        !state ||
        !active ||
        state.status!=="playing" ||
        active.id!==myId ||
        active.bankrupt
    ) {
        return false;
    }

    const position = Number(active.position);
    const cell = state.spaces?.[position] || SPACES[position];

    if (!cell || cell.type!=="asset") {
        return false;
    }

    const owner = state.players.find(
        p=>Array.isArray(p.assets) &&
        p.assets.includes(position)
    );

    if (owner) return false;

    if (!state.pendingPurchase) return false;

    if (Number(active.cash)<Number(cell.price)) {
        return false;
    }

    // Если сервер передаёт pendingPurchase,
    // дополнительно проверяем его.
    if (state.pendingPurchase) {
        const pending = state.pendingPurchase;

        if (typeof pending==="object") {
            return pending.playerId===myId ||
                   pending.player===myId;
        }

        if (typeof pending==="boolean") {
            return pending;
        }
    }

    // Покупка возможна только если сервер ждёт решения от этого игрока.
    return false;
}

/* =========================
   ОТРИСОВКА ИГРЫ
========================= */

function render() {
    const state = currentState();

    if (!state || !Array.isArray(state.players)) {
        return;
    }

    const players = state.players;

    const active =
        players[state.currentTurn] || null;

    const player = mode==="local"
        ? activePlayer()
        : players.find(p=>p.id===myId) || null;

    /* ИНФОРМАЦИЯ О ХОДЕ */

    setText(
        "turnInfo",
        state.status==="finished"
            ? `🏆 Игра завершена. Победитель: ${players.find(p=>p.id===state.winner)?.name||"нет"}`
            : `ХОД: ${active?.name||"—"}${mode==="local"?" — передай устройство игроку":""}`
    );

    setText(
        "diceResult",
        state.lastRoll
            ? `${state.lastRoll.player} выбросил ${state.lastRoll.value}`
            : "Ожидание броска"
    );

    /* СПИСОК ИГРОКОВ */

    const playersList = $("playersList");

    if (playersList) {
        playersList.innerHTML = players.map(p=>`
            <div class="player-row">
                <span>
                    ${escapeHTML(p.name)}
                    ${p.id===active?.id?"◀":""}
                    ${mode==="online"&&p.id===myId?"(Вы)":""}
                </span>

                <strong>
                    ${Number(p.cash||0).toFixed(2)} CR
                    ${p.bankrupt?"💀":""}
                </strong>
            </div>
        `).join("");
    }

    /* ИГРОВОЕ ПОЛЕ */

    const board = $("board");

    if (board) {
        const spaces = state.spaces || SPACES;

        board.innerHTML = spaces.map((cell,i)=>{
            const here = players
                .filter(p=>Number(p.position)===i)
                .map(p=>p.id===myId?"🟢":"🔵")
                .join("");

            const owner = players.find(
                p=>Array.isArray(p.assets) &&
                p.assets.includes(i)
            );

            let detail = "";

            if (cell.type==="asset") {
                detail =
                    `${cell.price} CR · аренда ${cell.rent}`;
            }

            if (cell.type==="tax") {
                detail = `−${cell.amount} CR`;
            }

            if (cell.type==="start") {
                detail = "+200 CR за круг";
            }

            if (cell.type==="event") {
                detail = "Случайное событие";
            }

            return `
                <div class="cell ${escapeHTML(cell.type)}">
                    <strong>
                        ${i+1}. ${escapeHTML(cell.title)}
                    </strong>

                    <small>
                        ${detail}
                        ${owner
                            ? `<br>Владелец: ${escapeHTML(owner.name)}`
                            : ""}
                    </small>

                    <div>${here}</div>
                </div>
            `;
        }).join("");
    }

    /* СПИСОК МОНЕТ */

    const market = state.market || COINS;

    const options = market.map(c=>`
        <option value="${escapeHTML(c.name)}">
            ${escapeHTML(c.name)}
        </option>
    `).join("");

    const tradeSelect = $("tradeCoin");
    const betSelect = $("betCoin");

    if (tradeSelect && tradeSelect.dataset.ready!=="1") {
        tradeSelect.innerHTML = options;
        tradeSelect.dataset.ready = "1";
    }

    if (betSelect && betSelect.dataset.ready!=="1") {
        betSelect.innerHTML = options;
        betSelect.dataset.ready = "1";
    }

    /* РЫНОК */

    const marketList = $("marketList");

    if (marketList) {
        marketList.innerHTML = market.map(c=>`
            <div class="market-row">
                <span>${escapeHTML(c.name)}</span>

                <strong>
                    ${Number(c.price||0).toFixed(2)} CR

                    <small class="${Number(c.change||0)>=0?"positive":"negative"}">
                        ${Number(c.change||0)>=0?"+":""}${Number(c.change||0).toFixed(2)}%
                    </small>
                </strong>
            </div>
        `).join("");
    }

    /* МОЙ ПОРТФЕЛЬ */

    const portfolio = player?.portfolio || {};

    const entries = Object.entries(portfolio)
        .filter(([,quantity])=>Number(quantity)>0.0000001);

    const myPortfolio = $("myPortfolio");

    if (myPortfolio) {
        myPortfolio.innerHTML = `
            <p>
                Игрок:
                <strong>${escapeHTML(player?.name||"—")}</strong>
            </p>

            <p>
                Баланс:
                <strong>${Number(player?.cash||0).toFixed(2)} CR</strong>
            </p>
        ` + (
            entries.length
                ? entries.map(([coin,quantity])=>`
                    <div class="market-row">
                        <span>${escapeHTML(coin)}</span>
                        <strong>${Number(quantity).toFixed(6)}</strong>
                    </div>
                `).join("")
                : "<p class='muted'>Портфель пока пуст.</p>"
        );
    }

    /* ИСТОРИЯ */

    const gameLog = $("gameLog");

    if (gameLog) {
        gameLog.innerHTML = (state.log || [])
            .slice()
            .reverse()
            .map(line=>`
                <div class="log-row">
                    ${escapeHTML(line)}
                </div>
            `)
            .join("");
    }

    /* =========================
       КНОПКИ ХОДА
    ========================= */

    const localTurn =
        mode==="local" &&
        state.status==="playing" &&
        !pendingPurchase &&
        active?.id===player?.id &&
        !active?.bankrupt;

    const onlineTurn =
        mode==="online" &&
        state.status==="playing" &&
        active?.id===myId &&
        !active?.bankrupt;

    setDisabled(
        "rollDiceBtn",
        !(localTurn||(onlineTurn&&!state.pendingPurchase))
    );

    /* =========================
       КНОПКИ ПОКУПКИ
    ========================= */

   const localCanBuy =
    mode==="local" &&
    pendingPurchase &&
    state.status==="playing" &&
    active?.id===player?.id &&
    !active?.bankrupt;

    const onlineCanBuy =
        mode==="online" &&
        canBuyOnlineAsset(state,active);

    const canBuy =
        localCanBuy || onlineCanBuy;

    setHidden("buyAssetBtn",!canBuy);
    setHidden("skipPurchaseBtn",!canBuy);

    setDisabled("buyAssetBtn",!canBuy);
    setDisabled("skipPurchaseBtn",!canBuy);

    /* =========================
       ЗАВЕРШЕНИЕ ИГРЫ
    ========================= */

    if (state.status==="finished") {
        setDisabled("rollDiceBtn",true);

        setHidden("buyAssetBtn",true);
        setHidden("skipPurchaseBtn",true);
    }
}

/* =========================
   ЗАПУСК
========================= */

drawLocalNames();
setMode("local");

console.log("CRYPTO GAME: game.js загружен!");

})();