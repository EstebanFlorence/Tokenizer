// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./Tokenizer.sol";
import "./Treasury.sol";

contract Dealer {

	uint256 public minBet;
	uint256 public maxBet;
	uint256 public houseEdge;
	uint256 public gamesCount;

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
		uint64 usedCards;
		uint8[]	playerCards;
		uint8[]	dealerCards;
		uint8	playerScore;
		uint8	dealerScore;
		bool	playerHasBlackjack;
		bool	dealerHasBlackjack;
		bool	playerHasSplit;
		bool	isActive;
		GameStates	state;
		GameResults	result;
	}

	mapping(uint256 => Game) games;

	event GameCreated(uint256 gameId, address player, uint256 bet);
	event CardRequested(uint256 requestId, address trigger);
	event CardDealt(address player, uint8 card, bool isPlayerCard);
	event PlayerAction(address player, PlayerActions action);
	event GameResult(address player, GameResults result, uint256 payout);

	IVRFConsumer public	vrfConsumer;
	Tokenizer public tokenizer;
	Treasury private treasury;

	constructor(
		address _vrfConsumer,
		address _tokenizer,
		address _treasury,
		uint256 _minBet,
		uint256 _maxBet,
		uint256 _houseEdge
	) {
		require(_houseEdge <= 1000, "House edge cannot exceed 10% (1000 bps)");
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		tokenizer = Tokenizer(payable(_tokenizer));
		treasury = Treasury(payable(_treasury));
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
		require(vrfConsumer.isRandomnessFullfilled(games[gameId].requestId), "Randomness not available");
		_;
	}

	function startGame(uint256 bet) external {
		require(bet >= minBet && bet <= maxBet, "Bet outside allowed range");
		require(tokenizer.transferFrom(msg.sender, address(this), bet), "Token transfer failed");

		uint256 requestId = vrfConsumer.requestRandomness();
		gamesCount++;

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
		uint8 card;

		uint256 randomness = vrfConsumer.getRandomness(game.requestId);

		game.playerCards = new uint8[](2);
		game.dealerCards = new uint8[](1);
		card = getUniqueCard(randomness, game.usedCards);
		game.playerCards[0] = card;
		game.usedCards |= (uint64(1) << (card - 1));

		randomness = uint256(keccak256(abi.encode(randomness, 1)));
		card = getUniqueCard(randomness, game.usedCards);
		game.playerCards[1] = card;
		game.usedCards |= (uint64(1) << (card - 1));

		randomness = uint256(keccak256(abi.encode(randomness, 2)));
		card = getUniqueCard(randomness, game.usedCards);
		game.dealerCards[0] = card;
		game.usedCards |= (uint64(1) << (card - 1));

		game.playerScore = calculateScore(game.playerCards);
		game.dealerScore = calculateScore(game.dealerCards);

		game.playerHasBlackjack = (game.playerCards.length == 2 && game.playerScore == 21);

		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;

		emit CardDealt(player, game.playerCards[0], true);
		emit CardDealt(player, game.playerCards[1], true);
		emit CardDealt(player, game.dealerCards[0], false);

		if (game.playerHasBlackjack) {
			completeGame(gameId);
		}
	}

	function hit(uint256 gameId) external onlyActiveGame(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");

		emit PlayerAction(msg.sender, PlayerActions.HIT);

		uint256 requestId = vrfConsumer.requestRandomness();
		game.requestId = requestId;
		game.state = GameStates.WAITING_FOR_PLAYER_RANDOMNESS;

		emit CardRequested(requestId, msg.sender);
	}

	function dealHitCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_RANDOMNESS, "Not waiting for player action");
		address player = game.player;

		uint256 randomness = vrfConsumer.getRandomness(game.requestId);

		uint8 newCard = getUniqueCard(randomness, game.usedCards);
		game.playerCards.push(newCard);
		game.usedCards |= (uint64(1) << (newCard - 1));

		game.playerScore = calculateScore(game.playerCards);

		emit CardDealt(player, newCard, true);

		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;

		if (game.playerScore > 21) {
			game.result = GameResults.DEALER_WIN;
			completeGame(gameId);
		}

		if (game.playerScore == 21) {
			game.playerHasBlackjack = true;
			game.result = GameResults.PLAYER_WIN;
			completeGame(gameId);
		}
		
	}

	function stand(uint256 gameId) external onlyActiveGame(gameId) {
		Game storage game = games[gameId];
		require(game.state == GameStates.WAITING_FOR_PLAYER_ACTION, "Not your turn");
		
		emit PlayerAction(msg.sender, PlayerActions.STAND);
		
		startDealerTurn(gameId);
	}

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

	function dealDoubleDownCard(uint256 gameId) external onlyActiveGame(gameId) onlyRandomnessReady(gameId) {
		Game storage game = games[gameId];
		address player = game.player;

		require(game.state == GameStates.WAITING_FOR_PLAYER_RANDOMNESS, "Not waiting for player action");
		
		uint256 randomness = vrfConsumer.getRandomness(game.requestId);
		
		uint8 newCard = getUniqueCard(randomness, game.usedCards);
		game.playerCards.push(newCard);
		game.usedCards |= (uint64(1) << (newCard - 1));
		game.playerScore = calculateScore(game.playerCards);

		emit CardDealt(player, newCard, true);

		game.state = GameStates.WAITING_FOR_PLAYER_ACTION;

		if (game.playerScore > 21) {
			game.result = GameResults.DEALER_WIN;
		}

		if (game.playerScore == 21) {
			game.playerHasBlackjack = true;
			game.result = GameResults.PLAYER_WIN;
		}
		
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

		uint8 newCard = getUniqueCard(randomness, game.usedCards);
		game.dealerCards.push(newCard);
		game.usedCards |= (uint64(1) << (newCard - 1));
		game.dealerScore = calculateScore(game.dealerCards);

		emit CardDealt(address(this), newCard, false);

		if (game.dealerScore < 17) {
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

		if (game.dealerCards.length == 2 && game.dealerScore == 21) {
			game.dealerHasBlackjack = true;
		}

		if (game.result == GameResults.IN_PROGRESS) {
			if (game.playerHasBlackjack && !game.dealerHasBlackjack) {
				game.result = GameResults.PLAYER_WIN;
			} else if (!game.playerHasBlackjack && game.dealerHasBlackjack) {
				game.result = GameResults.DEALER_WIN;
			} else if (game.playerHasBlackjack && game.dealerHasBlackjack) {
				game.result = GameResults.PUSH;
			} else if (game.playerScore > 21) {
				game.result = GameResults.DEALER_WIN;
			} else if (game.dealerScore > 21) {
				game.result = GameResults.PLAYER_WIN;
			} else if (game.playerScore > game.dealerScore) {
				game.result = GameResults.PLAYER_WIN;
			} else if (game.playerScore < game.dealerScore) {
				game.result = GameResults.DEALER_WIN;
			} else {
				game.result = GameResults.PUSH;
			}
		}

		uint256 payout;
		uint256 houseEarnings;

		if (game.result == GameResults.PLAYER_WIN) {
			if (game.playerHasBlackjack) {
				payout = game.bet + (game.bet * 3 / 2);
			} else {
				payout = game.bet * 2;
			}

			houseEarnings = (payout - game.bet) * houseEdge / 10000; // Apply house edge to winnings

			payout -= houseEarnings;

			tokenizer.transfer(player, payout);

			uint256 treasuryShare = game.bet * houseEdge / 10000; // House edge on the bet
			tokenizer.transfer(address(treasury), (houseEarnings + treasuryShare));

		} else if (game.result == GameResults.PUSH) {
			payout = game.bet;
			tokenizer.transfer(player, payout);
		} else if (game.result == GameResults.DEALER_WIN) {
			tokenizer.transfer(address(treasury), game.bet);
		}

		game.state = GameStates.GAME_COMPLETED;

		emit GameResult(player, game.result, payout);

		game.isActive = false;
	}

	function completeGame(uint256 gameId) internal {
		Game storage game = games[gameId];

		if (game.playerScore > 21 || game.playerHasBlackjack) {
			finishGame(gameId);
		} else {
			startDealerTurn(gameId);
		}
	}

	function calculateScore(uint8[] memory cards) internal pure returns (uint8) {
		uint16 rawScore = 0;
		uint8  aceCount = 0;

		for (uint i = 0; i < cards.length; i++) {
			uint8 v = (cards[i] - 1) % 13 + 1;
			if (v == 1) {
				aceCount++;
				rawScore += 11;
			} else if (v >= 10) {
				rawScore += 10;
			} else {
				rawScore += v;
			}
		}

		while (rawScore > 21 && aceCount > 0) {
			rawScore -= 10;
			aceCount--;
		}

		return uint8(rawScore);
	}

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

	function setBetLimits(uint256 _minBet, uint256 _maxBet) external {
		require(address(this) == msg.sender || tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(_minBet <= _maxBet, "Min bet must be <= max bet");
		minBet = _minBet;
		maxBet = _maxBet;
	}

	function setHouseEdge(uint256 _houseEdge) external {
		require(address(this) == msg.sender || tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(_houseEdge <= 1000, "House edge cannot exceed 10%");
		houseEdge = _houseEdge;
	}

	function withdrawEarnings(uint256 amount, address recipient) external {
		require(tokenizer.hasRole(tokenizer.DEFAULT_ADMIN_ROLE(), msg.sender), "Not authorized");
		require(amount <= tokenizer.balanceOf(address(this)), "Insufficient balance");
		tokenizer.transfer(recipient, amount);
	}

	function getUniqueCard(uint256 randomness, uint64 usedCardsBitmap) internal pure returns (uint8) {
		uint8 maxAttempts = 52;

		for (uint8 i = 0; i < maxAttempts; i++) {
			uint8 card = uint8((randomness % 52) + 1);

			if (!isCardUsed(usedCardsBitmap, card)) {
				return card;
			}

			randomness = uint256(keccak256(abi.encode(randomness, i)));
		}

		revert("All cards used - deck exhausted");
	}

	function isCardUsed(uint64 usedCardsBitmap, uint8 card) internal pure returns (bool) {
		uint64 bitPosition = uint64(card) - 1;
		
		return (usedCardsBitmap & (uint64(1) << bitPosition)) != 0;
	}
}