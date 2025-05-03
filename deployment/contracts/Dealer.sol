// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./Tokenizer.sol";

contract Dealer {

	uint256 public minBet;
	uint256 public maxBet;
	uint256 public houseEdge; // in basis points (1/100 of a percent), 250 = 2.5%

	// enum GameState {
	// 	Waiting, Dealing, PlayerTurn, DealerTurn, Settled
	// }
	enum GameStates { WAITING_FOR_BET, WAITING_FOR_PLAYER_ACTION, GAME_COMPLETED }
	enum PlayerActions { HIT, STAND, DOUBLE_DOWN }
	enum GameResults { IN_PROGRESS, PLAYER_WIN, DEALER_WIN, PUSH }


	struct Game {
		address	player;
		uint256	bet;
		uint256	requestId;
		uint8[]	playerCards;
		uint8[]	dealerCards;
		uint8	playerScore;
		uint8	dealerScore;
		bool playerHasBlackjack;
		bool dealerHasBlackjack;
		bool playerHasSplit;
		bool isActive;
		GameStates	state;
		GameResults result;
	}

	// mapping(uint256 => Game) games;
	mapping(address => Game) games;
	mapping(uint256 => address)	requestIdToPlayer;
	mapping(uint256 => uint256) public vrfToGame;

	event RandomEventTriggered(uint256 requestId, address trigger);
	event RandomEventResult(uint256 requestId);
	event GameCreated(address player, uint256 bet); // requestId
	event CardDealt(address player, uint8 card, bool isPlayerCard);
	event PlayerAction(address player, PlayerActions action);
	event GameResult(address player, GameResults result, uint256 payout);

	IVRFConsumer public	vrfConsumer;
	Tokenizer public tokenizer;

	constructor(
		address _vrfConsumer,
		address _tokenizer,
		uint256 _minBet,
		uint256 _maxBet,
		uint256 _houseEdge
	) {
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		tokenizer = Tokenizer(payable(_tokenizer));
		minBet = _minBet;
		maxBet = _maxBet;
		houseEdge = _houseEdge;
	}

	modifier onlyDuringActiveGame() {
		require(games[msg.sender].isActive, "No active game");
		_;
	}

	function startGame(uint256 bet) external {
		require(!games[msg.sender].isActive, "Game already in progress");
		require(bet >= minBet && bet <= maxBet, "Bet outside allowed range");
		require(tokenizer.transferFrom(msg.sender, address(this), bet), "Token transfer failed");

		// Request randomness for initial cards
		uint256 requestId = vrfConsumer.requestRandomness();
		requestIdToPlayer[requestId] = msg.sender;

		// Initialize game
		Game storage game = games[msg.sender];
		game.player = msg.sender;
		game.bet = bet;
		game.requestId = requestId;
		game.state = GameStates.WAITING_FOR_BET;
		game.result = GameResults.IN_PROGRESS;
		game.isActive = true;
		
		emit GameCreated(msg.sender, bet);
	}

	function dealInitialCards(uint256 requestId) external {
		address player = requestIdToPlayer[requestId];
		require(player != address(0), "Invalid request ID");
		require(games[player].state == GameStates.WAITING_FOR_BET, "Game not in correct state");
		
		Game storage game = games[player];
		
		// Get randomness
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		
		// Deal initial cards (2 for player, 1 for dealer)
		game.playerCards = new uint8[](2);
		game.dealerCards = new uint8[](1);
		
		game.playerCards[0] = uint8((randomness % 52) + 1);
		randomness = uint256(keccak256(abi.encode(randomness, 1)));
		game.playerCards[1] = uint8((randomness % 52) + 1);
		randomness = uint256(keccak256(abi.encode(randomness, 2)));
		game.dealerCards[0] = uint8((randomness % 52) + 1);
		
		// Calculate scores
		game.playerScore = calculateScore(game.playerCards);
		game.dealerScore = calculateScore(game.dealerCards);
		
		// Check for blackjack
		game.playerHasBlackjack = (game.playerCards.length == 2 && game.playerScore == 21);
		
		// Update game state
		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;
		
		// Emit events
		emit CardDealt(player, game.playerCards[0], true);
		emit CardDealt(player, game.playerCards[1], true);
		emit CardDealt(player, game.dealerCards[0], false);
		
		// If player has blackjack, determine outcome once dealer's hand is complete
		if (game.playerHasBlackjack) {
			completeGame(player);
		}
	}

	/**
	 * @notice Player action: hit (take another card)
	 */
	function hit() external onlyDuringActiveGame {
		Game storage game = games[msg.sender];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");

		// Request randomness for the new card
		uint256 requestId = vrfConsumer.requestRandomness();
		requestIdToPlayer[requestId] = msg.sender;
		game.requestId = requestId;

		emit PlayerAction(msg.sender, PlayerActions.HIT);
	}
	
	/**
	 * @notice Deal a card after a hit action
	 * @param requestId The VRF request ID
	 */
	function dealHitCard(uint256 requestId) external {
		address player = requestIdToPlayer[requestId];
		require(player != address(0), "Invalid request ID");
		require(games[player].state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not waiting for player action");
		
		Game storage game = games[player];
		
		// Get randomness
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		
		// Deal a new card to the player
		uint8 newCard = uint8((randomness % 52) + 1);
		uint8[] memory newPlayerCards = new uint8[](game.playerCards.length + 1);
		
		for (uint i = 0; i < game.playerCards.length; i++) {
			newPlayerCards[i] = game.playerCards[i];
		}
		newPlayerCards[game.playerCards.length] = newCard;
		game.playerCards = newPlayerCards;
		
		// Recalculate score
		game.playerScore = calculateScore(game.playerCards);
		
		emit CardDealt(player, newCard, true);
		
		// Check if player busts
		if (game.playerScore > 21) {
			game.result = GameResults.DEALER_WIN;
			completeGame(player);
		}
	}
	
	/**
	 * @notice Player action: stand (end turn)
	 */
	function stand() external onlyDuringActiveGame {
		Game storage game = games[msg.sender];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");
		
		emit PlayerAction(msg.sender, PlayerActions.STAND);
		
		// Complete the game (dealer's turn)
		completeGame(msg.sender);
	}
	
	/**
	 * @notice Player action: double down (double bet and receive one more card)
	 */
	function doubleDown() external onlyDuringActiveGame {
		Game storage game = games[msg.sender];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");
		require(game.playerCards.length == 2, "Can only double down on initial hand");
		require(tokenizer.transferFrom(msg.sender, address(this), game.bet), "Token transfer failed");
		
		// Double the bet
		game.bet *= 2;
		
		emit PlayerAction(msg.sender, PlayerActions.DOUBLE_DOWN);
		
		// Request randomness for the new card
		uint256 requestId = vrfConsumer.requestRandomness();
		requestIdToPlayer[requestId] = msg.sender;
		game.requestId = requestId;
	}
	
	/**
	 * @notice Deal a card after double down and complete the game
	 * @param requestId The VRF request ID
	 */
	function dealDoubleDownCard(uint256 requestId) external {
		address player = requestIdToPlayer[requestId];
		require(player != address(0), "Invalid request ID");
		
		Game storage game = games[player];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not waiting for player action");
		
		// Get randomness
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		
		// Deal a new card to the player
		uint8 newCard = uint8((randomness % 52) + 1);
		uint8[] memory newPlayerCards = new uint8[](game.playerCards.length + 1);
		
		for (uint i = 0; i < game.playerCards.length; i++) {
			newPlayerCards[i] = game.playerCards[i];
		}
		newPlayerCards[game.playerCards.length] = newCard;
		game.playerCards = newPlayerCards;
		
		// Recalculate score
		game.playerScore = calculateScore(game.playerCards);
		
		emit CardDealt(player, newCard, true);
		
		// Complete the game (player's turn is over)
		completeGame(player);
	}
	
	/**
	 * @notice Complete the game by playing out dealer's hand and determining the outcome
	 * @param player The player address
	 */
	function completeGame(address player) internal {
		Game storage game = games[player];
		
		// If player hasn't busted and doesn't have blackjack, dealer draws cards
		if (game.playerScore <= 21 && !game.playerHasBlackjack) {
			// Dealer hits until 17 or higher
			while (game.dealerScore < 17) {
				// Request randomness for dealer's card (in production, this would be handled differently)
				uint256 randomness = uint256(keccak256(abi.encode(blockhash(block.number - 1), game.dealerCards.length)));
				
				uint8 newCard = uint8((randomness % 52) + 1);
				uint8[] memory newDealerCards = new uint8[](game.dealerCards.length + 1);
				
				for (uint i = 0; i < game.dealerCards.length; i++) {
					newDealerCards[i] = game.dealerCards[i];
				}
				newDealerCards[game.dealerCards.length] = newCard;
				game.dealerCards = newDealerCards;
				
				// Recalculate dealer's score
				game.dealerScore = calculateScore(game.dealerCards);
				
				emit CardDealt(player, newCard, false);
			}
		}
		
		// Check for dealer blackjack (only possible with initial 2 cards)
		if (game.dealerCards.length == 2 && game.dealerScore == 21) {
			game.dealerHasBlackjack = true;
		}
		
		// Determine result if not already set
		if (game.result == GameResults.IN_PROGRESS) {
			if (game.playerHasBlackjack && !game.dealerHasBlackjack) {
				game.result = GameResults.PLAYER_WIN; // Blackjack pays 3:2
			} else if (!game.playerHasBlackjack && game.dealerHasBlackjack) {
				game.result = GameResults.DEALER_WIN;
			} else if (game.playerHasBlackjack && game.dealerHasBlackjack) {
				game.result = GameResults.PUSH; // Both have blackjack = push
			} else if (game.playerScore > 21) {
				game.result = GameResults.DEALER_WIN; // Player busts
			} else if (game.dealerScore > 21) {
				game.result = GameResults.PLAYER_WIN; // Dealer busts
			} else if (game.playerScore > game.dealerScore) {
				game.result = GameResults.PLAYER_WIN; // Player has higher score
			} else if (game.playerScore < game.dealerScore) {
				game.result = GameResults.DEALER_WIN; // Dealer has higher score
			} else {
				game.result = GameResults.PUSH; // Equal scores = push
			}
		}
		
		// Calculate and pay winnings
		uint256 payout = 0;
		if (game.result == GameResults.PLAYER_WIN) {
			if (game.playerHasBlackjack) {
				// Blackjack typically pays 3:2
				payout = game.bet + (game.bet * 3 / 2);
			} else {
				payout = game.bet * 2; // Even money (1:1)
			}
			tokenizer.transfer(player, payout);
		} else if (game.result == GameResults.PUSH) {
			// Return original bet
			payout = game.bet;
			tokenizer.transfer(player, payout);
		}

		// Update game state
		game.state = GameStates.GAME_COMPLETED;

		emit GameResult(player, game.result, payout);

		// Clean up
		delete requestIdToPlayer[game.requestId];
		game.isActive = false;
	}

	/**
	 * @notice Calculate the score of a hand
	 * @param cards The array of card values
	 * @return score The blackjack score
	 */
	function calculateScore(uint8[] memory cards) internal pure returns (uint8 score) {

		score = 0;
		uint8 aceCount = 0;
		
		for (uint i = 0; i < cards.length; i++) {
			uint8 cardValue = (cards[i] - 1) % 13 + 1; // Convert to 1-13 range

			if (cardValue == 1) {
				// Ace
				aceCount++;
				score += 11;
			} else if (cardValue >= 10) {
				// Face cards (10, J, Q, K)
				score += 10;
			} else {
				// Number cards (2-9)
				score += cardValue;
			}
		}
		
		// Adjust for aces if score is over 21
		while (score > 21 && aceCount > 0) {
			score -= 10; // Change one ace from 11 to 1
			aceCount--;
		}
		
		return score;
	}


	/**
	 * @notice Get a player's current game state
	 * @param player The player address
	 * @return cards The player's cards
	 * @return dealerCards The dealer's cards
	 * @return playerScore The player's current score
	 * @return dealerScore The dealer's current score
	 * @return state The current game state
	 * @return result The game result
	 */
	function getGameState(address player) external view returns (
		uint8[] memory cards,
		uint8[] memory dealerCards,
		uint8 playerScore,
		uint8 dealerScore,
		GameStates state,
		GameResults result
	) {
		Game storage game = games[player];
		return (
			game.playerCards,
			game.dealerCards,
			game.playerScore,
			game.dealerScore,
			game.state,
			game.result
		);
	}

	/**
	 * @notice Set the minimum and maximum bet amounts
	 * @param _minBet The minimum bet amount
	 * @param _maxBet The maximum bet amount
	 */
	function setBetLimits(uint256 _minBet, uint256 _maxBet) external {
		require(address(this) == msg.sender || tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(_minBet <= _maxBet, "Min bet must be <= max bet");
		minBet = _minBet;
		maxBet = _maxBet;
	}

	/**
	 * @notice Set the house edge percentage (in basis points)
	 * @param _houseEdge The house edge in basis points (e.g., 250 = 2.5%)
	 */
	function setHouseEdge(uint256 _houseEdge) external {
		require(address(this) == msg.sender || tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(_houseEdge <= 1000, "House edge cannot exceed 10%");
		houseEdge = _houseEdge;
	}

	/**
	 * @notice Withdraw house earnings
	 * @param amount The amount to withdraw
	 * @param recipient The recipient address
	 */
	function withdrawEarnings(uint256 amount, address recipient) external {
		require(tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(amount <= tokenizer.balanceOf(address(this)), "Insufficient balance");
		tokenizer.transfer(recipient, amount);
	}

}