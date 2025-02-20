// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFCoordinatorV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2Mock.sol";

// CasinOracle
contract VRFConsumer is VRFConsumerBaseV2
{
	VRFCoordinatorV2Interface public immutable	coordinator;
	uint64 public immutable		subscriptionId;
	bytes32	public immutable	keyHash;
	uint32 public immutable		callbackGasLimit = 100000;
	uint16 public immutable		requestConfirmations = 3;

	mapping(uint256 => address) public	requestIdToSender;
	mapping(uint256 => uint256) public	requestIdToRandomness;

	event RandomnessRequested(uint256 requestId, address requester);
	event RandomnessFulfilled(uint256 requestId, uint256 randomness);

	constructor(
		address _vrfCoordinator,
		uint64 _subscriptionId, 
		bytes32 _keyHash
	)
	VRFConsumerBaseV2(_vrfCoordinator)
	{
		coordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
		subscriptionId = _subscriptionId;
		keyHash = _keyHash;
	}

	function requestRandomness() external returns (uint256 requestId)
	{
		requestId = coordinator.requestRandomWords(
			keyHash,
			subscriptionId,
			requestConfirmations,
			callbackGasLimit,
			1
		);
		requestIdToSender[requestId] = msg.sender;
		emit RandomnessRequested(requestId, msg.sender);
	}

	function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override
	{
		uint256 randomness = randomWords[0];
		requestIdToRandomness[requestId] = randomness;

		emit RandomnessFulfilled(requestId, randomness);
	}

	function getRandomness(uint256 requestId) external view returns (uint256)
	{
		require(msg.sender == requestIdToSender[requestId], "Caller is not the requester");

		uint256	randomness = requestIdToRandomness[requestId];
		// delete requestIdToSender[requestId];
		// delete requestIdToRandomness[requestId];
		// delete requestIdToSender[requestId];

		return randomness;
	}

	function clearRandomRequest(uint256 requestId) external
	{
		delete requestIdToSender[requestId];
		delete requestIdToRandomness[requestId];
		delete requestIdToSender[requestId];
	}

}
