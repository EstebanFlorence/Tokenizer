// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

// import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
// import "@chainlink/contracts/src/v0.8/vrf/VRFCoordinatorV2.sol";
// import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2Mock.sol";

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFCoordinatorV2_5.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VRFConsumer is VRFConsumerBaseV2Plus
{
	// VRFCoordinatorV2Interface public immutable	coordinator;
	uint256 public immutable	subscriptionId;
	bytes32	public immutable	keyHash;
	uint32 public immutable		callbackGasLimit = 100000;
	uint16 public immutable		requestConfirmations = 3;
	uint16 public immutable		numWords = 1;

	mapping(uint256 => address) public	requestIdToRoller;
	mapping(uint256 => uint256) public	rollerToResult;

	event RandomnessRequested(uint256 requestId, address requester);
	event RandomnessFulfilled(uint256 requestId, uint256 randomness);

	constructor(
		address _vrfCoordinator,
		uint256 _subscriptionId, 
		bytes32 _keyHash
	)
	VRFConsumerBaseV2Plus(_vrfCoordinator)
	{
		subscriptionId = _subscriptionId;
		keyHash = _keyHash;
	}

	function requestRandomness() external returns (uint256 requestId)
	{
		requestId = s_vrfCoordinator.requestRandomWords(
			VRFV2PlusClient.RandomWordsRequest({
				keyHash: keyHash,
				subId: subscriptionId,
				requestConfirmations: requestConfirmations,
				callbackGasLimit: callbackGasLimit,
				numWords: numWords,
				extraArgs: VRFV2PlusClient._argsToBytes(
					VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
				)
			})
		);
		requestIdToRoller[requestId] = msg.sender;
		emit RandomnessRequested(requestId, msg.sender);
	}

	function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override
	{
		uint256 randomness = randomWords[0];
		rollerToResult[requestId] = randomness;

		emit RandomnessFulfilled(requestId, randomness);
	}

	function getRandomness(uint256 requestId) external view returns (uint256)
	{
		require(msg.sender == requestIdToRoller[requestId], "Caller is not the requester");

		uint256	randomness = rollerToResult[requestId];

		return randomness;
	}

	function clearRandomRequest(uint256 requestId) external
	{
		delete requestIdToRoller[requestId];
		delete rollerToResult[requestId];
	}

}
