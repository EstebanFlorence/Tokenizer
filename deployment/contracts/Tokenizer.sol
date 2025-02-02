// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFCoordinatorV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2Mock.sol";

contract Tokenizer is ERC20, Ownable, VRFConsumerBaseV2
{
	// Chainlink VRF variables
	VRFCoordinatorV2Interface public immutable	coordinator;
	uint64 public	subscriptionId;
	bytes32	public	keyHash;
	uint32 public	callbackGasLimit = 100000;
	uint16 public	requestConfirmations = 3;

	// Time control
	uint256 public	lastQuantumEvent;
	uint256 public	quantumInterval = 1 days;

	// Mapping which address triggered which request
	mapping(uint256 => address)	quantumRequests;

	// Events
	event QuantumEventTriggered(uint256 requestId, address indexed trigger);
	event QuantumEventResult(uint256 requestId, bool isMinted, uint256 amount);

	constructor(
		uint256 initialSupply,
		uint64 _subscriptionId, 
		address _vrfCoordinator,
		bytes32 _keyHash
	)
	ERC20("Tokenizer", "TOK")
	VRFConsumerBaseV2(_vrfCoordinator)
	{
		coordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
		subscriptionId = _subscriptionId;
		keyHash = _keyHash;
		// Initial supply minted to deployer
		_mint(_msgSender(), initialSupply);
		lastQuantumEvent = block.timestamp;
	}

	function mint(address to, uint256 amount) external onlyOwner
	{
		_mint(to, amount);
	}

	function triggerQuantumEvent() external returns(uint256 requestId)
	{
		require(block.timestamp >= lastQuantumEvent + quantumInterval, "too soon for a quantum event");
		requestId = coordinator.requestRandomWords(
			keyHash,
			subscriptionId,
			requestConfirmations,
			callbackGasLimit,
			1
		);
		quantumRequests[requestId] = msg.sender;
		lastQuantumEvent = block.timestamp;
		emit QuantumEventTriggered(requestId, msg.sender);
	}

	function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override
	{
		uint256	randomResult = randomWords[0];
		bool shouldMint = (randomResult % 2) == 0;
	
		// Determine % of supply
		uint256	percentage = (randomResult % 5) + 1;
		uint256	amount = (totalSupply() * percentage) / 100;

		address trigger = quantumRequests[requestId];
		if (shouldMint)
		{
			_mint(trigger, amount);
		}
		else
		{
			// uint256 burnAmount = balanceOf(trigger) < amount ? balanceOf(trigger) : amount;
			amount = balanceOf(trigger) < amount ? balanceOf(trigger) : amount;
			_burn(trigger, amount);
		}

		emit QuantumEventResult(requestId, shouldMint, amount);
		delete quantumRequests[requestId];
	}

}