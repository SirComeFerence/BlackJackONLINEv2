const suits = ['♥', '♦', '♣', '♠'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

let deck = [];
let playerHand = [];
let dealerHand = [];
let balance = 1000;
let currentBet = 0;
let gameInProgress = false;

const dealerCardsDiv = document.getElementById('dealer-cards');
const playerCardsDiv = document.getElementById('player-cards');
const dealerScoreSpan = document.getElementById('dealer-score');
const playerScoreSpan = document.getElementById('player-score');
const balanceSpan = document.getElementById('balance');
const statusMessage = document.getElementById('status-message');
const betInput = document.getElementById('bet-input');

document.getElementById('deal-button').addEventListener('click', startGame);
document.getElementById('hit-button').addEventListener('click', hit);
document.getElementById('stand-button').addEventListener('click', stand);
document.getElementById('double-button').addEventListener('click', doubleDown);
document.getElementById('new-game-button').addEventListener('click', () => location.reload());

function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 11;
    return parseInt(card.rank);
}

function calculateHand(hand) {
    let value = 0;
    let aces = 0;
    for (let card of hand) {
        if (card.rank === 'A') aces++;
        value += getCardValue(card);
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    return value;
}

function createCardElement(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'card';
    if (hidden) {
        div.classList.add('back');
        div.textContent = '?';
    } else {
        const color = ['♥', '♦'].includes(card.suit) ? 'red' : 'black';
        div.classList.add(color);
        div.innerHTML = `${card.rank}<br>${card.suit}`;
        div.style.setProperty('--suit', `"${card.suit}"`);
    }
    return div;
}

function renderHands(hideDealerCard = true) {
    playerCardsDiv.innerHTML = '';
    playerHand.forEach(card => playerCardsDiv.appendChild(createCardElement(card)));

    dealerCardsDiv.innerHTML = '';
    dealerCardsDiv.appendChild(createCardElement(dealerHand[0]));
    if (dealerHand.length > 1) {
        dealerCardsDiv.appendChild(createCardElement(dealerHand[1], hideDealerCard));
    }

    playerScoreSpan.textContent = calculateHand(playerHand);
    dealerScoreSpan.textContent = hideDealerCard && dealerHand.length > 1 
        ? getCardValue(dealerHand[0]) 
        : calculateHand(dealerHand);
}

function startGame() {
    currentBet = parseInt(betInput.value);
    if (!currentBet || currentBet < 10 || currentBet > balance) {
        statusMessage.textContent = "Invalid bet amount!";
        return;
    }

    balance -= currentBet;
    balanceSpan.textContent = balance;
    statusMessage.textContent = "";
    gameInProgress = true;

    createDeck();
    playerHand = [deck.pop(), deck.pop()];
    dealerHand = [deck.pop(), deck.pop()];

    // Enable/disable buttons
    document.getElementById('deal-button').disabled = true;
    document.getElementById('hit-button').disabled = false;
    document.getElementById('stand-button').disabled = false;
    document.getElementById('double-button').disabled = playerHand.length !== 2 || balance < currentBet;

    if (calculateHand(playerHand) === 21) {
        statusMessage.textContent = "Blackjack! You win!";
        payout(currentBet * 2.5);
        endGame();
        return;
    }

    renderHands();
}

function hit() {
    playerHand.push(deck.pop());
    renderHands();
    document.getElementById('double-button').disabled = true;

    if (calculateHand(playerHand) > 21) {
        statusMessage.textContent = "Bust! You lose.";
        endGame();
    }
}

function stand() {
    while (calculateHand(dealerHand) < 17) {
        dealerHand.push(deck.pop());
    }
    renderHands(false);

    const playerVal = calculateHand(playerHand);
    const dealerVal = calculateHand(dealerHand);

    let message = "";
    if (dealerVal > 21 || playerVal > dealerVal) {
        message = playerHand.length === 2 && playerVal === 21 ? "Blackjack!" : "You win!";
        payout(currentBet * 2);
    } else if (playerVal === dealerVal) {
        message = "Push!";
        payout(currentBet);
    } else {
        message = "Dealer wins.";
    }

    statusMessage.textContent = message;
    endGame();
}

function doubleDown() {
    if (balance < currentBet) return;
    balance -= currentBet;
    currentBet *= 2;
    balanceSpan.textContent = balance;

    playerHand.push(deck.pop());
    renderHands();
    document.getElementById('double-button').disabled = true;

    if (calculateHand(playerHand) <= 21) stand();
}

function payout(amount) {
    balance += amount;
    balanceSpan.textContent = balance;
}

function endGame() {
    gameInProgress = false;
    document.getElementById('hit-button').disabled = true;
    document.getElementById('stand-button').disabled = true;
    document.getElementById('double-button').disabled = true;
    document.getElementById('deal-button').disabled = false;
    renderHands(false);
}

// Initial state
document.getElementById('hit-button').disabled = true;
document.getElementById('stand-button').disabled = true;
document.getElementById('double-button').disabled = true;
statusMessage.textContent = "Place your bet and click DEAL";