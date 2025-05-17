// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFCoordinatorV2_5.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VRFConsumer is VRFConsumerBaseV2Plus {
	uint256 public immutable	subscriptionId;
	bytes32	public immutable	keyHash;
	uint32 public immutable		callbackGasLimit = 100000;
	uint16 public immutable		requestConfirmations = 3;
	uint16 public immutable		numWords = 1;

	enum RandomnessStatus { DOES_NOT_EXIST, IN_PROGRESS, FULFILLED }
	uint256 private constant RANDOMNESS_IN_PROGRESS = type(uint256).max;

	mapping(uint256 => address) public	requestIdToSender;
	mapping(address => uint256) public	senderToRandomness;

	event RandomnessRequested(uint256 requestId, address requester);
	event RandomnessFulfilled(uint256 requestId, uint256 randomness);

	constructor(
		address _vrfCoordinator,
		uint256 _subscriptionId, 
		bytes32 _keyHash
	)
	VRFConsumerBaseV2Plus(_vrfCoordinator) {
		subscriptionId = _subscriptionId;
		keyHash = _keyHash;
	}

	/**
	 * @notice Requests randomness from Chainlink VRF
	 * @dev Each address can only have one request in progress at a time
	 * @return requestId The ID of the randomness request
	 */
	function requestRandomness() external returns (uint256 requestId) {
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

		requestIdToSender[requestId] = msg.sender;
		senderToRandomness[msg.sender] = RANDOMNESS_IN_PROGRESS;

		emit RandomnessRequested(requestId, msg.sender);
	}

	/**
	 * @notice Callback function used by VRF Coordinator to deliver randomness
	 * @param requestId The ID of the randomness request
	 * @param randomWords The random result returned by the VRF Coordinator
	 */
	function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
		uint256 randomness = randomWords[0];

		senderToRandomness[requestIdToSender[requestId]] = randomness;

		emit RandomnessFulfilled(requestId, randomness);
	}

	/**
	 * @notice Gets the randomness result for the caller
	 * @dev Caller must be the original requester
	 * @param requestId The ID of the randomness request
	 * @return The random value
	 */
	function getRandomness(uint256 requestId) external view returns (uint256) {
		require(msg.sender == requestIdToSender[requestId], "Caller is not the requester");

		uint256	randomness = senderToRandomness[msg.sender];
		require(randomness != 0 && randomness != RANDOMNESS_IN_PROGRESS, "Randomness not available");

		return randomness;
	}

	function isRandomnessFullfilled(uint256 requestId) external view returns (bool) {
		uint256 randomness = senderToRandomness[requestIdToSender[requestId]];
		return randomness != 0 && randomness != RANDOMNESS_IN_PROGRESS;
	}

	/**
	 * @notice Clears randomness request data for an address
	 * @dev Can only be called by the original requester
	 * @param requestId The ID of the request to clear
	 */
	function clearRandomRequest(uint256 requestId) external {
		require(msg.sender == requestIdToSender[requestId], "Caller is not the requester");

		delete requestIdToSender[requestId];
		delete senderToRandomness[msg.sender];
	}

}
