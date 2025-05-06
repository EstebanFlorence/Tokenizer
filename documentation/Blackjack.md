**Dealer.sol Smart Contract Documentation**

---

## Overview

**Dealer** is a Solidity implementation of a simple on-chain Blackjack game using an ERC‑20 token (via the `Tokenizer` contract) for betting and Chainlink VRF for provably fair randomness. Players can place bets, receive cards, and play against the dealer, who follows the standard Blackjack “hit until 17” rule. Winnings are paid out automatically according to Blackjack payout rules.

---

## Key Components

### Enums

* `GameStates`

  * `WAITING_FOR_BET` — Player has submitted a bet, waiting to deal.
  * `WAITING_FOR_PLAYER_ACTION` — Player’s turn: can `hit`, `stand`, or `doubleDown`.
  * `WAITING_FOR_DEALER_ACTION` — Dealer’s turn: drawing cards via VRF callbacks.
  * `GAME_COMPLETED` — Game over; result settled and payout made.

* `PlayerActions` — Player-initiated actions:

  * `HIT`
  * `STAND`
  * `DOUBLE_DOWN`

* `GameResults` — Final outcomes:

  * `IN_PROGRESS`
  * `PLAYER_WIN`
  * `DEALER_WIN`
  * `PUSH` (tie)

### Struct: `Game`

Each game (identified by a `gameId`) tracks:

| Field                | Type          | Description                                     |
| -------------------- | ------------- | ----------------------------------------------- |
| `player`             | `address`     | The player’s wallet address.                    |
| `bet`                | `uint256`     | Amount wagered (in tokens).                     |
| `requestId`          | `uint256`     | Latest VRF request ID.                          |
| `playerCards`        | `uint8[]`     | Player’s hand (card indices 1–52).              |
| `dealerCards`        | `uint8[]`     | Dealer’s hand (card indices 1–52).              |
| `playerScore`        | `uint8`       | Blackjack score of player’s hand.               |
| `dealerScore`        | `uint8`       | Blackjack score of dealer’s hand.               |
| `playerHasBlackjack` | `bool`        | Whether player hit a natural (21 on two cards). |
| `dealerHasBlackjack` | `bool`        | Whether dealer’s first two cards make 21.       |
| `playerHasSplit`     | `bool`        | (Reserved for future split support.)            |
| `isDealerTurn`       | `bool`        | Whether control has passed to dealer.           |
| `isActive`           | `bool`        | Whether the game is in progress.                |
| `state`              | `GameStates`  | Current game state.                             |
| `result`             | `GameResults` | Final outcome once completed.                   |

---

## State Variables

| Variable      | Type                       | Description                                   |
| ------------- | -------------------------- | --------------------------------------------- |
| `minBet`      | `uint256`                  | Minimum accepted bet.                         |
| `maxBet`      | `uint256`                  | Maximum accepted bet.                         |
| `houseEdge`   | `uint256`                  | House edge in basis points (e.g. 250 = 2.5%). |
| `gamesCount`  | `uint256`                  | Incremental counter for assigning `gameId`s.  |
| `vrfConsumer` | `IVRFConsumer`             | Chainlink VRF consumer contract reference.    |
| `tokenizer`   | `Tokenizer`                | ERC‑20 token used for betting & payout.       |
| `games`       | `mapping(uint256 => Game)` | All active & completed games by ID.           |

---

## Events

* `GameCreated(uint256 gameId, address player, uint256 bet)` — Emitted when a new game is started.
* `CardRequested(uint256 requestId, address trigger)` — Emitted whenever a VRF randomness request is made.
* `CardDealt(address player, uint8 card, bool isPlayerCard)` — Emitted when a card is dealt (player or dealer).
* `PlayerAction(address player, PlayerActions action)` — Emitted when the player hits, stands, or doubles down.
* `GameResult(address player, GameResults result, uint256 payout)` — Emitted when the game ends and payout is sent.

---

## Public & External Functions

### 1. `startGame(uint256 bet)`

* **Description:** Player approves and transfers `bet` tokens to the contract, then requests VRF randomness to deal initial cards.
* **Requirements:** `bet` between `minBet` and `maxBet`, and `transferFrom` must succeed.
* **Emits:** `GameCreated` & `CardRequested`.

### 2. `dealInitialCards(uint256 gameId)`

* **Description:** Once VRF fulfills `requestId`, pulls randomness and deals two cards to the player and one to the dealer.
* **Requirements:** Caller must be the player, game state `WAITING_FOR_BET`, and randomness ready.
* **Emits:** Three `CardDealt` events. If player got natural blackjack, calls `completeGame` immediately.

### 3. `hit(uint256 gameId)`

* **Description:** Player chooses to take another card. Requests VRF randomness.
* **Emits:** `PlayerAction(HIT)` & `CardRequested`.

### 4. `dealHitCard(uint256 gameId)`

* **Description:** After VRF fulfills, deals one more card to the player and updates score. If bust, calls `completeGame`.
* **Emits:** `CardDealt` (and possibly `GameResult`).

### 5. `stand(uint256 gameId)`

* **Description:** Player ends turn. Transitions to dealer’s turn and invokes `startDealerTurn`.
* **Emits:** `PlayerAction(STAND)`.

### 6. `doubleDown(uint256 gameId)`

* **Description:** Player doubles bet (requires another token transfer), receives exactly one more card, then game ends.
* **Emits:** `PlayerAction(DOUBLE_DOWN)` & `CardRequested`.

### 7. `dealDoubleDownCard(uint256 gameId)`

* **Description:** After VRF fulfills, deals one card, updates score, then calls `completeGame`.
* **Emits:** `CardDealt` (and then `GameResult`).

### 8. `dealDealerCard(uint256 gameId)`

* **Description:** Called repeatedly as VRF fulfills randomness during dealer’s turn. Dealer draws one card per invocation until score ≥17.
* **Emits:** `CardDealt` each draw, `CardRequested` for each new draw, then `GameResult` when finished.

### 9. `getGameState(uint256 gameId)`

* **Description:** View function to fetch player & dealer hands, scores, current state, and result.
* **Returns:** `(playerCards, dealerCards, playerScore, dealerScore, state, result)`.

### Admin Functions

* `setBetLimits(uint256 _minBet, uint256 _maxBet)` — Adjust min/max bet (only owner or DEFAULT\_ADMIN).
* `setHouseEdge(uint256 _houseEdge)` — Adjust house edge (basis points).
* `withdrawEarnings(uint256 amount, address recipient)` — Withdraw accumulated house tokens.

---

## How to Play (User Instructions)

1. **Approve Tokens:**

   ```js
   await tokenizer.connect(player).approve(dealer.address, betAmount)
   ```

2. **Start a New Game:**

   ```js
   const tx = await dealer.connect(player).startGame(betAmount)
   await tx.wait()
   ```

3. **Deal Initial Cards:**

   ```js
   const gameId = 1 // or listen for GameCreated
   const tx2 = await dealer.dealInitialCards(gameId)
   await tx2.wait()
   ```

   * Check `CardDealt` events to see your two cards & dealer’s face‑up card.

4. **Player Turn:**

   * **Hit:**

     ```js
     await dealer.hit(gameId)
     await dealer.dealHitCard(gameId)
     ```
   * **Stand:**

     ```js
     await dealer.stand(gameId)
     ```
   * **Double Down:**

     ```js
     await tokenizer.connect(player).approve(dealer.address, betAmount)
     await dealer.doubleDown(gameId)
     await dealer.dealDoubleDownCard(gameId)
     ```

5. **Dealer Turn & Settlement:**

   * Once you `stand` (or double‑down finish), the dealer draws automatically via `dealDealerCard(gameId)` calls (either by VRF callback or a keeper).
   * When the dealer is done, `GameResult` will fire with your final outcome and payout.

6. **Check Outcome:**

   ```js
   const [pCards, dCards, pScore, dScore, state, result] = await dealer.getGameState(gameId)
   console.log({ pCards, dCards, pScore, dScore, state, result })
   ```

---

Enjoy provably‑fair on‑chain Blackjack with Dealer.sol!  Good luck and play responsibly.
