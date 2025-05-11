# Dealer Contract Documentation

The Dealer contract implements a blockchain-based blackjack game where players can place bets using tokenized assets. Below is a comprehensive overview of its functionality.

## Overview

The Dealer contract allows players to:

* Start blackjack games by placing bets
* Perform standard blackjack actions (hit, stand, double down)
* Receive payouts based on game outcomes

The game uses **Chainlink VRF** (Verifiable Random Function) for fair card dealing through the VRFConsumer contract.

---

## Core Components

### Game States

| State | Description |
|-------|-------------|
| `WAITING_FOR_BET` | Initial state after game creation |
| `WAITING_FOR_PLAYER_ACTION` | Player's turn to make a move |
| `WAITING_FOR_PLAYER_RANDOMNESS` | Waiting for randomness after player action |
| `WAITING_FOR_DEALER_ACTION` | Dealer's turn |
| `WAITING_FOR_DEALER_RANDOMNESS` | Waiting for randomness for dealer's card |
| `GAME_COMPLETED` | Game has ended |

### Player Actions

* **HIT**: Draw another card
* **STAND**: End turn with current hand
* **DOUBLE_DOWN**: Double bet and receive one more card

### Game Results

* **IN_PROGRESS**: Game still ongoing
* **PLAYER_WIN**: Player won
* **DEALER_WIN**: Dealer won
* **PUSH**: Tie game (player gets bet back)

---

## Game Flow

### Starting a Game

1. Player calls `startGame` with bet amount
2. Contract requests randomness for initial cards
3. Contract creates a game record with unique ID

### Initial Deal

1. Player calls `dealInitialCards` once randomness is available
2. Player receives two cards, dealer receives one card
3. If player has blackjack, game proceeds to completion

### Player Actions

* **Hit**: Player calls `hit` to request another card, then `dealHitCard` once randomness is ready
* **Stand**: Player calls `stand` to end their turn
* **Double Down**: Player calls `doubleDown` to double bet and take one final card, then calls `dealDoubleDownCard`

### Dealer's Turn

* Initiated automatically after player stands or doubles down
* Dealer draws cards (triggered by `dealDealerCard`) until score is 17 or higher

### Game Resolution

* Game result is determined in `finishGame`
* Payouts are calculated and distributed:
  * **Player win**: 1:1 (2:3 for blackjack)
  * **Push**: Return original bet
  * **Dealer win**: Player loses bet to treasury

---

## Administration Functions

* `setBetLimits`: Set minimum/maximum bet amounts
* `setHouseEdge`: Set house edge percentage (in basis points)
* `withdrawEarnings`: Allow admin to withdraw house earnings

---

## Key Parameters

| Parameter | Description |
|-----------|-------------|
| `minBet`/`maxBet` | Bet size limits |
| `houseEdge` | House advantage (basis points, e.g., 250 = 2.5%) |
| `gamesCount` | Total games played |

---

## Interacting with the Contract

See `console-commands.js` for examples of how to:

* Start games
* Perform player actions
* Check game states
* Deal cards after randomness is available

---

## Deployed Instances

* **Sepolia Testnet**: `0x6d79ae1789eD18a276b7bAFb12Ecf5E2878bCDa6`
* **Local development**: See `deploy-localhost.ts`
