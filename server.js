const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const path = require("path");

for (const file of ["index.html", "style.css", "game.js"]) {
    app.get("/" + file, (req, res) => {
        res.sendFile(path.join(__dirname, file));
    });
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

const COINS = [
    { name: "Bitcoin", price: 300 },
    { name: "Ethereum", price: 220 },
    { name: "Solana", price: 140 },
    { name: "BNB", price: 90 },
    { name: "XRP", price: 60 },
    { name: "Cardano", price: 45 },
    { name: "Avalanche", price: 75 },
    { name: "Polygon", price: 35 },
    { name: "Dogecoin", price: 20 },
    { name: "Chainlink", price: 55 },
    { name: "TRON", price: 25 }
];

const SPACES = [
    { type: "start", title: "СТАРТ" },
    { type: "asset", title: "Bitcoin", price: 300, rent: 60 },
    { type: "event", title: "Новости рынка" },
    { type: "asset", title: "Ethereum", price: 240, rent: 45 },
    { type: "tax", title: "Налог", amount: 100 },
    { type: "asset", title: "Solana", price: 180, rent: 35 },
    { type: "event", title: "Случайное событие" },
    { type: "asset", title: "BNB", price: 150, rent: 30 },
    { type: "tax", title: "Комиссия", amount: 70 },
    { type: "asset", title: "XRP", price: 120, rent: 25 },
    { type: "event", title: "Новости рынка" },
    { type: "asset", title: "Cardano", price: 100, rent: 20 },
    { type: "asset", title: "Avalanche", price: 140, rent: 28 },
    { type: "tax", title: "Налог", amount: 90 },
    { type: "asset", title: "Polygon", price: 80, rent: 16 },
    { type: "event", title: "Случайное событие" },
    { type: "asset", title: "Dogecoin", price: 70, rent: 14 },
    { type: "asset", title: "Chainlink", price: 110, rent: 22 },
    { type: "tax", title: "Комиссия", amount: 60 },
    { type: "asset", title: "TRON", price: 75, rent: 15 }
];

const rooms = new Map();

/* =========================
   СОЗДАНИЕ КОДА КОМНАТЫ
========================= */

function generateRoomCode() {
    let code;

    do {
        code = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();

    } while (rooms.has(code));

    return code;
}

/* =========================
   СОЗДАНИЕ ИГРОКА
========================= */

function createPlayer(id, name) {
    return {
        id,
        name: String(name || "Игрок").trim().slice(0, 18) || "Игрок",
        cash: 1800,
        position: 0,
        assets: [],
        portfolio: {},
        bankrupt: false
    };
}

/* =========================
   СОСТОЯНИЕ КОМНАТЫ
========================= */

function getPublicState(room) {
    return {
        code: room.code,
        status: room.status,
        currentTurn: room.currentTurn,

        players: room.players.map(player => ({
            ...player,
            assets: [...player.assets],
            portfolio: { ...player.portfolio }
        })),

        spaces: SPACES,

        market: room.market.map(coin => ({
            ...coin
        })),

        log: room.log.slice(-50),
        lastRoll: room.lastRoll,
        winner: room.winner,
        pendingPurchase: room.pendingPurchase
    };
}

function addLog(room, text) {
    room.log.push(text);

    if (room.log.length > 60) {
        room.log.shift();
    }
}

function sendState(room) {
    io.to(room.code).emit(
        "roomUpdate",
        getPublicState(room)
    );
}

function sendError(socket, text) {
    socket.emit("gameError", text);
}

function getRoom(socket, payload = {}) {
    const code = String(
        payload.roomCode || socket.data.roomCode || ""
    ).toUpperCase();

    return rooms.get(code);
}

function getPlayer(room, socket) {
    return room.players.find(
        player => player.id === socket.id
    );
}

function isPlayerTurn(room, socket) {
    return (
        room.status === "playing" &&
        room.players[room.currentTurn]?.id === socket.id
    );
}

/* =========================
   ЗАВЕРШЕНИЕ ИГРЫ
========================= */

function checkWinner(room) {
    const alivePlayers = room.players.filter(
        player => !player.bankrupt
    );

    if (alivePlayers.length <= 1) {
        room.status = "finished";

        room.winner = alivePlayers[0]?.id || null;

        if (alivePlayers[0]) {
            addLog(
                room,
                `🏆 ${alivePlayers[0].name} победил!`
            );
        }

        return true;
    }

    return false;
}

/* =========================
   СЛЕДУЮЩИЙ ХОД
========================= */

function nextTurn(room) {
    if (checkWinner(room)) {
        return;
    }

    for (let i = 0; i < room.players.length; i++) {
        room.currentTurn =
            (room.currentTurn + 1) % room.players.length;

        if (!room.players[room.currentTurn].bankrupt) {
            return;
        }
    }

    checkWinner(room);
}

/* =========================
   СПИСАНИЕ ДЕНЕГ
========================= */

function chargePlayer(room, player, amount) {
    player.cash -= amount;

    if (player.cash < 0) {
        player.cash = 0;
        player.bankrupt = true;

        addLog(
            room,
            `💀 ${player.name} обанкротился!`
        );
    }
}

/* =========================
   ПОЛУЧЕНИЕ КОМНАТЫ
========================= */

function roomAction(socket, payload, callback) {
    const room = getRoom(socket, payload);

    if (!room) {
        sendError(socket, "Комната не найдена.");
        return;
    }

    callback(room);

    sendState(room);
}

/* =========================
   СОЗДАНИЕ КОМНАТЫ
========================= */

function createRoom(socket, name) {
    if (socket.data.roomCode) {
        sendError(socket, "Ты уже находишься в комнате.");
        return;
    }

    const code = generateRoomCode();

    const player = createPlayer(socket.id, name);

    const room = {
        code,
        status: "waiting",
        players: [player],
        currentTurn: 0,

        market: COINS.map(coin => ({
            ...coin,
            change: 0
        })),

        log: [],
        lastRoll: null,
        winner: null,
        pendingPurchase: null
    };

    rooms.set(code, room);

    socket.join(code);

    socket.data.roomCode = code;

    addLog(
        room,
        `${player.name} создал комнату ${code}.`
    );

    socket.emit("roomCreated", {
        code
    });

    sendState(room);
}

/* =========================
   БРОСОК КУБИКА
========================= */

function rollDice(room, socket) {
    if (!isPlayerTurn(room, socket)) {
        sendError(socket, "Сейчас не твой ход.");
        return;
    }

    if (room.pendingPurchase) {
        sendError(socket, "Сначала реши вопрос с покупкой.");
        return;
    }

    const player = getPlayer(room, socket);

    const roll = Math.floor(Math.random() * 6) + 1;

    const oldPosition = player.position;

    const newPosition =
        (oldPosition + roll) % SPACES.length;

    if (oldPosition + roll >= SPACES.length) {
        player.cash += 200;

        addLog(
            room,
            `${player.name} прошёл старт и получил 200 CR.`
        );
    }

    player.position = newPosition;

    room.lastRoll = {
        player: player.name,
        value: roll
    };

    const cell = SPACES[newPosition];

    addLog(
        room,
        `🎲 ${player.name} выбросил ${roll} и попал на ${cell.title}.`
    );

    /* НАЛОГ */

    if (cell.type === "tax") {
        chargePlayer(room, player, cell.amount);

        addLog(
            room,
            `${player.name} заплатил ${cell.amount} CR.`
        );
    }

    /* СОБЫТИЕ */

    if (cell.type === "event") {
        const won = Math.random() < 0.5;

        const amount = won ? 120 : 90;

        if (won) {
            player.cash += amount;

            addLog(
                room,
                `📈 ${player.name} получил бонус ${amount} CR.`
            );
        } else {
            chargePlayer(room, player, amount);

            addLog(
                room,
                `📉 ${player.name} потерял ${amount} CR.`
            );
        }
    }

    /* КРИПТОАКТИВ */

    if (cell.type === "asset") {
        const owner = room.players.find(
            p => p.assets.includes(newPosition)
        );

        if (owner && owner.id !== player.id) {
            chargePlayer(room, player, cell.rent);

            if (!player.bankrupt) {
                owner.cash += cell.rent;
            }

            addLog(
                room,
                `${player.name} заплатил аренду ${cell.rent} CR игроку ${owner.name}.`
            );
        }

        else if (!owner && player.cash >= cell.price) {
            room.pendingPurchase = {
                playerId: player.id,
                position: newPosition
            };

            return;
        }
    }

    nextTurn(room);
}

/* =========================
   ПОДКЛЮЧЕНИЕ ИГРОКОВ
========================= */

io.on("connection", socket => {

    console.log("Игрок подключился:", socket.id);

    /* СОЗДАТЬ КОМНАТУ */

    socket.on("createRoom", ({ name } = {}) => {
        createRoom(socket, name);
    });

    /* ВОЙТИ В КОМНАТУ */

    socket.on("joinRoom", ({ name, roomCode } = {}) => {

        if (socket.data.roomCode) {
            sendError(socket, "Ты уже находишься в комнате.");
            return;
        }

        const code = String(roomCode || "").toUpperCase();

        const room = rooms.get(code);

        if (!room) {
            sendError(socket, "Комната не найдена.");
            return;
        }

        if (room.status !== "waiting") {
            sendError(socket, "Игра уже началась.");
            return;
        }

        if (room.players.length >= 6) {
            sendError(socket, "В комнате уже 6 игроков.");
            return;
        }

        const player = createPlayer(socket.id, name);

        room.players.push(player);

        socket.join(room.code);

        socket.data.roomCode = room.code;

        addLog(
            room,
            `${player.name} присоединился к игре.`
        );

        sendState(room);
    });

    /* НАЧАТЬ ИГРУ */

    socket.on("startGame", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (room.players[0].id !== socket.id) {
                sendError(
                    socket,
                    "Начать игру может только создатель комнаты."
                );
                return;
            }

            if (room.status !== "waiting") {
                return;
            }

            if (room.players.length < 2) {
                sendError(
                    socket,
                    "Нужно минимум 2 игрока."
                );
                return;
            }

            room.status = "playing";

            room.currentTurn = 0;

            addLog(
                room,
                "🚀 Онлайн-игра началась!"
            );
        });
    });

    /* БРОСИТЬ КУБИК */

    socket.on("rollDice", (payload = {}) => {

        roomAction(socket, payload, room => {
            rollDice(room, socket);
        });

    });

    /* КУПИТЬ АКТИВ */

    socket.on("buyAsset", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (!isPlayerTurn(room, socket)) {
                sendError(socket, "Сейчас не твой ход.");
                return;
            }

            const player = getPlayer(room, socket);

            const position = player.position;

            const cell = SPACES[position];

            if (
                !room.pendingPurchase ||
                room.pendingPurchase.playerId !== socket.id ||
                room.pendingPurchase.position !== position
            ) {
                sendError(socket, "Сейчас нельзя купить актив.");
                return;
            }

            if (
                cell.type !== "asset" ||
                room.players.some(p => p.assets.includes(position))
            ) {
                sendError(socket, "Актив уже куплен.");
                return;
            }

            if (player.cash < cell.price) {
                sendError(socket, "Недостаточно CR.");
                return;
            }

            player.cash -= cell.price;

            player.assets.push(position);

            room.pendingPurchase = null;

            addLog(
                room,
                `💰 ${player.name} купил ${cell.title} за ${cell.price} CR.`
            );

            nextTurn(room);
        });

    });

    /* ПРОПУСТИТЬ ПОКУПКУ */

    socket.on("skipPurchase", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (!isPlayerTurn(room, socket)) {
                sendError(socket, "Сейчас не твой ход.");
                return;
            }

            if (
                !room.pendingPurchase ||
                room.pendingPurchase.playerId !== socket.id
            ) {
                sendError(socket, "Сейчас нечего пропускать.");
                return;
            }

            const player = getPlayer(room, socket);

            room.pendingPurchase = null;

            addLog(
                room,
                `${player.name} отказался от покупки.`
            );

            nextTurn(room);
        });

    });

    /* КУПИТЬ МОНЕТУ */

    socket.on("buyCoin", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (room.status !== "playing") {
                sendError(socket, "Игра ещё не началась.");
                return;
            }

            const player = getPlayer(room, socket);

            const coin = room.market.find(
                c => c.name === payload.coin
            );

            const quantity = Number(payload.quantity);

            if (
                !player ||
                !coin ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity > 100000
            ) {
                sendError(socket, "Проверь монету и количество.");
                return;
            }

            const cost = Math.round(
                coin.price * quantity * 100
            ) / 100;

            if (player.cash < cost) {
                sendError(socket, "Недостаточно CR.");
                return;
            }

            player.cash -= cost;

            player.portfolio[payload.coin] =
                (player.portfolio[payload.coin] || 0) + quantity;

            addLog(
                room,
                `${player.name} купил ${quantity} ${payload.coin} за ${cost.toFixed(2)} CR.`
            );
        });

    });

    /* ПРОДАТЬ МОНЕТУ */

    socket.on("sellCoin", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (room.status !== "playing") {
                sendError(socket, "Игра ещё не началась.");
                return;
            }

            const player = getPlayer(room, socket);

            const coin = room.market.find(
                c => c.name === payload.coin
            );

            const quantity = Number(payload.quantity);

            if (
                !player ||
                !coin ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity > (player.portfolio[payload.coin] || 0)
            ) {
                sendError(
                    socket,
                    "Недостаточно монет или неверное количество."
                );
                return;
            }

            const revenue = Math.round(
                coin.price * quantity * 100
            ) / 100;

            player.portfolio[payload.coin] -= quantity;

            player.cash += revenue;

            addLog(
                room,
                `${player.name} продал ${quantity} ${payload.coin} за ${revenue.toFixed(2)} CR.`
            );
        });

    });

    /* СТАВКА НА РЫНОК */

    socket.on("placeMarketBet", (payload = {}) => {

        roomAction(socket, payload, room => {

            if (room.status !== "playing") {
                sendError(socket, "Игра ещё не началась.");
                return;
            }

            const player = getPlayer(room, socket);

            const coin = room.market.find(
                c => c.name === payload.coin
            );

            const amount = Number(payload.amount);

            const direction = payload.direction;

            if (
                !player ||
                !coin ||
                !["up", "down"].includes(direction) ||
                !Number.isFinite(amount) ||
                amount <= 0 ||
                amount > player.cash
            ) {
                sendError(socket, "Неверная ставка.");
                return;
            }

            player.cash -= amount;

            const oldPrice = coin.price;

            coin.price = Math.max(
                1,
                Math.round(
                    oldPrice * (0.85 + Math.random() * 0.30) * 100
                ) / 100
            );

            coin.change = Math.round(
                (coin.price / oldPrice - 1) * 10000
            ) / 100;

            const won = direction === "up"
                ? coin.price > oldPrice
                : coin.price < oldPrice;

            if (won) {
                player.cash += amount * 1.8;
            }

            addLog(
                room,
                `${player.name} поставил ${amount} CR на ${payload.coin}. ${won ? "Победа!" : "Проигрыш."}`
            );
        });

    });

    /* ОТКЛЮЧЕНИЕ ИГРОКА */

    socket.on("disconnect", () => {

        const code = socket.data.roomCode;

        if (!code) return;

        const room = rooms.get(code);

        if (!room) return;

        const oldTurnPlayerId =
            room.players[room.currentTurn]?.id;

        const leavingPlayer = getPlayer(room, socket);

        if (leavingPlayer) {
            addLog(
                room,
                `${leavingPlayer.name} отключился.`
            );
        }

        room.players = room.players.filter(
            player => player.id !== socket.id
        );

        if (room.players.length === 0) {
            rooms.delete(code);
            return;
        }

        if (
            room.pendingPurchase &&
            room.pendingPurchase.playerId === socket.id
        ) {
            room.pendingPurchase = null;
        }

        const newTurnIndex = room.players.findIndex(
            player => player.id === oldTurnPlayerId
        );

        if (newTurnIndex >= 0) {
            room.currentTurn = newTurnIndex;
        } else {
            room.currentTurn = Math.min(
                room.currentTurn,
                room.players.length - 1
            );
        }

        if (
            room.status === "playing" &&
            room.players.length === 1
        ) {
            room.status = "finished";

            room.winner = room.players[0].id;

            addLog(
                room,
                `🏆 ${room.players[0].name} победил!`
            );
        }

        sendState(room);
    });

});

/* =========================
   ЗАПУСК СЕРВЕРА
========================= */

server.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("       CRYPTO GAME SERVER");
    console.log("--------------------------------");
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log("Ожидание игроков...");
});