// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./Tokenizer.sol";

contract Dealer {

	uint256 public minBet;
	uint256 public maxBet;
	uint256 public houseEdge; // in basis points (1/100 of a percent), 250 = 2.5%
	uint256 public gamesCount;

	// enum GameState {
	// 	Waiting, Dealing, PlayerTurn, DealerTurn, Settled
	// }
	enum GameStates { 
		WAITING_FOR_BET, GAME_COMPLETED, 
		WAITING_FOR_PLAYER_ACTION, WAITING_FOR_DEALER_ACTION, 
		WAITING_FOR_PLAYER_RANDOMNESS, WAITING_FOR_DEALER_RANDOMNESS
	}
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
		bool	playerHasBlackjack;
		bool	dealerHasBlackjack;
		bool	playerHasSplit;
		bool	isActive;
		GameStates	state;
		GameResults result;
	}

	mapping(uint256 => Game) games;
	// mapping(address => Game) games;
	// mapping(uint256 => address)	requestIdToPlayer;
	// mapping(uint256 => uint256) public vrfToGame;

	event GameCreated(uint256 gameId, address player, uint256 bet);
	event CardRequested(uint256 requestId, address trigger);
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
		gamesCount = 0;
	}

	modifier onlyActiveGame(uint256 gameId) {
		require(games[gameId].isActive, "No active Game");
		require(games[gameId].player == msg.sender, "Caller is not the Player");
		_;
	}

	modifier onlyRandomnessReady(uint256 gameId) {
		require(vrfConsumer.isRandomnessFullfilled(games[gameId].requestId), "Randomness not ready or non existent");
		_;
	}

	function startGame(uint256 bet) external {
		require(bet >= minBet && bet <= maxBet, "Bet outside allowed range");
		require(tokenizer.transferFrom(msg.sender, address(this), bet), "Token transfer failed");

		// Request randomness for initial cards
		uint256 requestId = vrfConsumer.requestRandomness();
		gamesCount++;

		// Initialize game
		Game storage game = games[gamesCount];
		game.player = msg.sender;
		game.bet = bet;
		game.requestId = requestId;
		game.state = GameStates.WAITING_FOR_BET;
		game.result = GameResults.IN_PROGRESS;
		game.isActive = true;

		emit GameCreated(gamesCount, msg.sender, bet);
	}

	function dealInitialCards(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_BET, "Game not in correct state");
		address player = game.player;

		uint256 randomness = vrfConsumer.getRandomness(game.requestId);

		// Deal initial cards (2 for player, 1 for dealer)
		game.playerCards = new uint8[](2);
		game.dealerCards = new uint8[](1);

		game.playerCards[0] = uint8((randomness % 52) + 1);
		randomness = uint256(keccak256(abi.encode(randomness, 1)));
		game.playerCards[1] = uint8((randomness % 52) + 1);
		randomness = uint256(keccak256(abi.encode(randomness, 2)));
		game.dealerCards[0] = uint8((randomness % 52) + 1);

		game.playerScore = calculateScore(game.playerCards);
		game.dealerScore = calculateScore(game.dealerCards);

		game.playerHasBlackjack = (game.playerCards.length == 2 && game.playerScore == 21);

		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;

		emit CardDealt(player, game.playerCards[0], true);
		emit CardDealt(player, game.playerCards[1], true);
		emit CardDealt(player, game.dealerCards[0], false);

		// If player has blackjack, determine outcome once dealer's hand is complete
		if (game.playerHasBlackjack) {
			completeGame(gameId);
		}
	}

	/**
	 * @notice Player action: hit (take another card)
	 */
	function hit(uint256 gameId) external onlyActiveGame(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");

		emit PlayerAction(msg.sender, PlayerActions.HIT);

		uint256 requestId = vrfConsumer.requestRandomness();
		game.requestId = requestId;
		game.state = GameStates.WAITING_FOR_PLAYER_RANDOMNESS;

		emit CardRequested(requestId, msg.sender);
	}

	/**
	 * @notice Deal a card after a hit action
	 */
	function dealHitCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_RANDOMNESS, "Not waiting for player action");
		address player = game.player;

		uint256 randomness = vrfConsumer.getRandomness(game.requestId);

		uint8 newCard = uint8((randomness % 52) + 1);
		game.playerCards.push(newCard);
		game.playerScore = calculateScore(game.playerCards);

		emit CardDealt(player, newCard, true);

		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;

		// Check if player busts
		if (game.playerScore > 21) {
			game.result = GameResults.DEALER_WIN;
			completeGame(gameId);
		}

		// Check if player has blackjack
		if (game.playerScore == 21) {
			game.playerHasBlackjack = true;
			game.result = GameResults.PLAYER_WIN;
			completeGame(gameId);
		}
	}

	/**
	 * @notice Player action: stand (end turn)
	 */
	function stand(uint256 gameId) external onlyActiveGame(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");
		
		emit PlayerAction(msg.sender, PlayerActions.STAND);
		
		// Complete the game (dealer's turn)
		startDealerTurn(gameId);
	}
	
	/**
	 * @notice Player action: double down (double bet and receive one more card)
	 */
	function doubleDown(uint256 gameId) external onlyActiveGame(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");
		require(game.playerCards.length == 2, "Can only double down on initial hand");
		require(tokenizer.transferFrom(msg.sender, address(this), game.bet), "Token transfer failed");
		
		game.bet *= 2;
		
		emit PlayerAction(msg.sender, PlayerActions.DOUBLE_DOWN);
		
		uint256 requestId = vrfConsumer.requestRandomness();
		game.requestId = requestId;
		game.state = GameStates.WAITING_FOR_PLAYER_RANDOMNESS;

		emit CardRequested(requestId, msg.sender);
	}

	/**
	 * @notice Deal a card after double down and complete the game
	 */
	function dealDoubleDownCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		address player = game.player;

		require(game.state == GameStates.WAITING_FOR_PLAYER_RANDOMNESS, "Not waiting for player action");
		
		uint256 randomness = vrfConsumer.getRandomness(game.requestId);
		
		uint8 newCard = uint8((randomness % 52) + 1);
		game.playerCards.push(newCard);
		
		game.playerScore = calculateScore(game.playerCards);
		
		emit CardDealt(player, newCard, true);
		
		completeGame(gameId);
	}

	function startDealerTurn(uint256 gameId) internal {
		Game storage game = games[gameId];
		game.state = GameStates.WAITING_FOR_DEALER_ACTION;

		uint256 requestId = vrfConsumer.requestRandomness();
		game.requestId = requestId;

		emit CardRequested(requestId, address(this));
	}

	function dealDealerCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_DEALER_ACTION, "Not dealer turn");

		uint256 randomness = vrfConsumer.getRandomness(game.requestId);
		uint8 newCard = uint8((randomness % 52) + 1);

		game.dealerCards.push(newCard);
		game.dealerScore = calculateScore(game.dealerCards);

		emit CardDealt(address(this), newCard, false);

		// Continue if score < 17, else finish
		if (game.dealerScore < 17) {
			// startDealerTurn
			uint256 newRequestId = vrfConsumer.requestRandomness();
			game.requestId = newRequestId;
			emit CardRequested(newRequestId, address(this));
		} else {
			finishGame(gameId);
		}
	}

	function finishGame(uint256 gameId) internal {
		Game storage game = games[gameId];
		address player = game.player;

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
		// delete requestIdToPlayer[game.requestId];
		game.isActive = false;
	
	}

	/**
	 * @dev Called whenever the player is done (busted, blackjack or stand).
	 */
	function completeGame(uint256 gameId) internal {
		Game storage game = games[gameId];

		// If player busted or hit blackjack, skip straight to finish
		if (game.playerScore > 21 || game.playerHasBlackjack) {
			finishGame(gameId);
		} else {
			startDealerTurn(gameId);
		}
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
	 * @return cards The player's cards
	 * @return dealerCards The dealer's cards
	 * @return playerScore The player's current score
	 * @return dealerScore The dealer's current score
	 * @return state The current game state
	 * @return result The game result
	 */
	function getGameState(uint256 gameId) external view returns (
		uint8[] memory cards,
		uint8[] memory dealerCards,
		uint8 playerScore,
		uint8 dealerScore,
		GameStates state,
		GameResults result
	) {
		Game storage game = games[gameId];
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