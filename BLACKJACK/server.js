const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

// ROUTES
// Add this near the top with your other routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'lobby.html'));
});

app.get('/multi', (req, res) => {
  res.sendFile(path.join(__dirname, 'multi.html'));
});

// Optional: fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'lobby.html'));
});
// GAME STATE
const tables = { main: { players: {}, dealer: [], gameState: 'waiting', bets: {}, turnOrder: [] }};
let deck = [];

function createDeck() {
  deck = [];
  const suits = ['♥','♦','♣','♠'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  for (let s of suits) for (let r of ranks) deck.push({suit:s, rank:r});
  for (let i = deck.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function cardValue(card) {
  if (['J','Q','K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank);
}

function handValue(hand) {
  let val = 0, aces = 0;
  for (let c of hand) { val += cardValue(c); if (c.rank==='A') aces++; }
  while (val > 21 && aces--) val -= 10;
  return val;
}

io.on('connection', socket => {
  const table = tables.main;
  if (Object.keys(table.players).length >= 6) return socket.disconnect();

  table.players[socket.id] = { id: socket.id, name: 'Player', chips: 1000, hand: [], bet: 0, result: null };
  broadcast();

  socket.on('setName', name => { table.players[socket.id].name = name; broadcast(); });
  socket.on('placeBet', amt => {
    const p = table.players[socket.id];
    if (table.gameState !== 'betting' || amt < 10 || amt > p.chips) return;
    p.bet = amt; p.chips -= amt; table.bets[socket.id] = amt;
    if (Object.keys(table.bets).length >= 2) setTimeout(startRound, 3000);
    broadcast();
  });

  socket.on('playerAction', action => {
    if (table.gameState !== 'playing' || table.turnOrder[0] !== socket.id) return;
    const p = table.players[socket.id];
    if (action === 'hit') { p.hand.push(deck.pop()); if (handValue(p.hand) > 21) p.result = 'bust'; }
    if (action === 'double') { if (p.chips >= p.bet) { p.chips -= p.bet; p.bet *= 2; p.hand.push(deck.pop()); p.result = handValue(p.hand) > 21 ? 'bust' : 'stand'; } }
    if (action === 'stand' || p.result) nextTurn();
    broadcast();
  });

  socket.on('chat', msg => io.emit('chat', `${table.players[socket.id].name}: ${msg}`));
  socket.on('disconnect', () => { delete table.players[socket.id]; delete table.bets[socket.id]; broadcast(); });

  function broadcast() {
    const data = {
      players: table.players,
      dealerCards: table.dealer.map((c,i) => ({...c, hidden: table.gameState==='playing' && i===1})),
      dealerScore: table.gameState==='finished' ? handValue(table.dealer) : cardValue(table.dealer[0]),
      gameState: table.gameState,
      currentTurn: table.turnOrder[0],
      message: getStatusMessage()
    };
    io.emit('tableUpdate', data);
  }

  function getStatusMessage() {
    if (table.gameState === 'betting') return 'Place your bets!';
    if (table.gameState === 'playing') return 'Game in progress...';
    return 'Waiting for players...';
  }

  function startRound() {
    createDeck();
    table.gameState = 'playing';
    table.dealer = [deck.pop(), deck.pop()];
    table.turnOrder = Object.keys(table.players).filter(id => table.bets[id]);
    for (let id of table.turnOrder) {
      table.players[id].hand = [deck.pop(), deck.pop()];
      table.players[id].result = null;
    }
    broadcast();
    nextTurn();
  }

  function nextTurn() {
    if (table.turnOrder.length === 0) { dealerPlay(); return; }
    const current = table.turnOrder[0];
    const p = table.players[current];
    if (p.result || handValue(p.hand) >= 21) table.turnOrder.shift();
    if (table.turnOrder.length === 0) dealerPlay();
    broadcast();
  }

  function dealerPlay() {
    while (handValue(table.dealer) < 17) table.dealer.push(deck.pop());
    const dealerVal = handValue(table.dealer);
    for (let id in table.players) {
      const p = table.players[id];
      if (!p.bet) continue;
      const playerVal = handValue(p.hand);
      if (playerVal > 21) p.result = 'lose';
      else if (dealerVal > 21 || playerVal > dealerVal) {
        const payout = (p.hand.length === 2 && playerVal === 21) ? p.bet * 2.5 : p.bet * 2;
        p.chips += payout;
        p.result = (p.hand.length === 2 && playerVal === 21) ? 'blackjack' : 'win';
      }
      else if (playerVal === dealerVal) { p.chips += p.bet; p.result = 'push'; }
      else p.result = 'lose';
    }
    table.gameState = 'finished';
    setTimeout(() => { table.gameState = 'betting'; table.bets = {}; broadcast(); }, 8000);
    broadcast();
  }
});

createDeck();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LIVE → https://localhost:${PORT}`));