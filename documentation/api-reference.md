# 42FIORINO (FLOR) Token Ecosystem API Reference

This document provides a comprehensive reference for the smart contract APIs in the 42FIORINO ecosystem.

## Table of Contents

- [Tokenizer Contract](#tokenizer-contract)
- [Treasury Contract](#treasury-contract)
- [Dealer Contract](#dealer-contract)
- [VRFConsumer Contract](#vrfconsumer-contract)

## Tokenizer Contract

The Tokenizer contract implements the ERC20 token standard with additional functionality for minting, burning, and pausing.

### Roles

- `DEFAULT_ADMIN_ROLE`: Can grant and revoke other roles
- `MINTER_ROLE`: Can mint new tokens
- `BURNER_ROLE`: Can burn tokens
- `PAUSER_ROLE`: Can pause and unpause token transfers

### Events

- `Received(address sender, uint256 amount)`: Emitted when plain ETH is received
- `FallbackCalled(address sender, uint256 amount, bytes data)`: Emitted when the fallback function is called

### Functions

#### Constructor

```solidity
constructor(uint256 initialSupply, address _vrfConsumer)
```

Initializes the token with the given initial supply and VRF consumer address.

- `initialSupply`: The initial amount of tokens to mint to the contract deployer
- `_vrfConsumer`: The address of the VRF consumer contract

#### Token Management

```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused
```

Mints new tokens to the specified address.

- `to`: The address receiving the minted tokens
- `amount`: The amount of tokens to mint

```solidity
function burn(address to, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused
```

Burns tokens from the specified address.

- `to`: The address from which tokens will be burned
- `amount`: The amount of tokens to burn

#### State Management

```solidity
function pause() external onlyRole(PAUSER_ROLE)
```

Pauses all token transfers.

```solidity
function unpause() external onlyRole(PAUSER_ROLE)
```

Unpauses all token transfers.

```solidity
function setPauser(address pauser) external onlyRole(DEFAULT_ADMIN_ROLE)
```

Grants the PAUSER_ROLE to the specified address.

- `pauser`: The address to receive the PAUSER_ROLE

#### Inherited ERC20 Functions

The Tokenizer contract inherits all standard ERC20 functions including:
- `transfer`
- `transferFrom`
- `approve`
- `balanceOf`
- `allowance`
- `totalSupply`

## Treasury Contract

The Treasury contract manages the ecosystem funds through a multi-signature wallet and handles random events.

### Events

- `RandomEventTriggered(uint256 requestId, address trigger)`: Emitted when a random event is triggered
- `RandomEventResult(uint256 randomness)`: Emitted when a random event completes

### Functions

#### Constructor

```solidity
constructor(address _vrfConsumer, address _tokenizer, address[] memory _owners, uint256 _requiredSignatures)
```

Initializes the Treasury with a multi-signature wallet and connections to other contracts.

- `_vrfConsumer`: The address of the VRF consumer contract
- `_tokenizer`: The address of the Tokenizer contract
- `_owners`: Array of addresses that will control the multisig wallet
- `_requiredSignatures`: The number of signatures required to execute a transaction

#### Token Management Proposals

```solidity
function proposeMint(address to, uint256 amount) external onlyOwner
```

Proposes a transaction to mint tokens.

- `to`: The address to receive the minted tokens
- `amount`: The amount of tokens to mint

```solidity
function proposeBurn(address from, uint256 amount) external onlyOwner
```

Proposes a transaction to burn tokens.

- `from`: The address from which tokens will be burned
- `amount`: The amount of tokens to burn

#### Random Events

```solidity
function triggerRandomEvent() external returns (uint256 requestId)
```

Triggers a random event that can result in tokens being minted or burned.

- Returns: `requestId` - The ID of the VRF request

```solidity
function handleRandomness(uint256 requestId) external onlyOwner
```

Processes the result of a random event.

- `requestId`: The ID of the VRF request to process

#### Inherited MultisigWallet Functions

The Treasury contract inherits functions from the MultisigWallet contract, including:
- `submitTransaction`
- `confirmTransaction`
- `executeTransaction`
- `revokeConfirmation`

## Dealer Contract

The Dealer contract implements a blackjack card game with betting functionality.

### Enums

- `GameStates`: WAITING_FOR_BET, GAME_COMPLETED, WAITING_FOR_PLAYER_ACTION, WAITING_FOR_DEALER_ACTION, WAITING_FOR_PLAYER_RANDOMNESS, WAITING_FOR_DEALER_RANDOMNESS
- `PlayerActions`: HIT, STAND, DOUBLE_DOWN
- `GameResults`: IN_PROGRESS, PLAYER_WIN, DEALER_WIN, PUSH

### Events

- `GameCreated(uint256 gameId, address player, uint256 bet)`: Emitted when a new game is started
- `CardRequested(uint256 requestId, address trigger)`: Emitted when randomness is requested for a card
- `CardDealt(address player, uint8 card, bool isPlayerCard)`: Emitted when a card is dealt
- `PlayerAction(address player, PlayerActions action)`: Emitted when a player takes an action
- `GameResult(address player, GameResults result, uint256 payout)`: Emitted when a game completes

### Functions

#### Constructor

```solidity
constructor(address _vrfConsumer, address _tokenizer, address _treasury, uint256 _minBet, uint256 _maxBet, uint256 _houseEdge)
```

Initializes the Dealer contract with the specified parameters.

- `_vrfConsumer`: The address of the VRF consumer contract
- `_tokenizer`: The address of the Tokenizer contract
- `_treasury`: The address of the Treasury contract
- `_minBet`: The minimum bet amount
- `_maxBet`: The maximum bet amount
- `_houseEdge`: The house edge in basis points (e.g. 250 = 2.5%)

#### Game Management

```solidity
function startGame(uint256 bet) external
```

Starts a new blackjack game with the specified bet amount.

- `bet`: The amount of tokens to bet

```solidity
function dealInitialCards(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId)
```

Deals the initial cards for a game.

- `gameId`: The ID of the game

#### Player Actions

```solidity
function hit(uint256 gameId) external onlyActiveGame(gameId)
```

The player requests another card.

- `gameId`: The ID of the game

```solidity
function dealHitCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId)
```

Deals a card after a hit request.

- `gameId`: The ID of the game

```solidity
function stand(uint256 gameId) external onlyActiveGame(gameId)
```

The player chooses to stand.

- `gameId`: The ID of the game

```solidity
function doubleDown(uint256 gameId) external onlyActiveGame(gameId)
```

The player chooses to double down, doubling their bet and receiving one more card.

- `gameId`: The ID of the game

```solidity
function dealDoubleDownCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId)
```

Deals a card after a double down request.

- `gameId`: The ID of the game

```solidity
function dealDealerCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId)
```

Deals a card to the dealer.

- `gameId`: The ID of the game

#### Configuration

```solidity
function setBetLimits(uint256 _minBet, uint256 _maxBet) external
```

Sets the minimum and maximum bet limits.

- `_minBet`: The minimum bet amount
- `_maxBet`: The maximum bet amount

```solidity
function setHouseEdge(uint256 _houseEdge) external
```

Sets the house edge percentage.

- `_houseEdge`: The house edge in basis points (e.g. 250 = 2.5%)

```solidity
function withdrawEarnings(uint256 amount, address recipient) external
```

Withdraws earnings from the contract.

- `amount`: The amount of tokens to withdraw
- `recipient`: The address to receive the tokens

#### View Functions

```solidity
function getGameState(uint256 gameId) external view returns (uint8[] memory cards, uint8[] memory dealerCards, uint8 playerScore, uint8 dealerScore, GameStates state, GameResults result)
```

Gets the current state of a game.

- `gameId`: The ID of the game
- Returns: The player's cards, dealer's cards, scores, game state, and result

## VRFConsumer Contract

The VRFConsumer contract manages randomness requests and responses using Chainlink's VRF.

### Events

- `RandomnessRequested(uint256 requestId, address requester)`: Emitted when randomness is requested
- `RandomnessFulfilled(uint256 requestId, uint256 randomness)`: Emitted when randomness is fulfilled

### Functions

#### Constructor

```solidity
constructor(address _vrfCoordinator, uint256 _subscriptionId, bytes32 _keyHash)
```

Initializes the VRF Consumer contract.

- `_vrfCoordinator`: The address of the VRF Coordinator contract
- `_subscriptionId`: The subscription ID for Chainlink VRF
- `_keyHash`: The key hash for the VRF request

#### Randomness Management

```solidity
function requestRandomness() external returns (uint256 requestId)
```

Requests randomness from Chainlink VRF.

- Returns: `requestId` - The ID of the VRF request

```solidity
function getRandomness(uint256 requestId) external view returns (uint256)
```

Gets the randomness result for a request.

- `requestId`: The ID of the VRF request
- Returns: The random value

```solidity
function isRandomnessFullfilled(uint256 requestId) external view returns (bool)
```

Checks if randomness has been fulfilled for a request.

- `requestId`: The ID of the VRF request
- Returns: Whether the randomness is available

```solidity
function clearRandomRequest(uint256 requestId) external
```

Clears a randomness request.

- `requestId`: The ID of the VRF request to clear
