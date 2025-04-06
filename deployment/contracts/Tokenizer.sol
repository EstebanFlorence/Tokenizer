// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IVRFConsumer {
	function requestRandomness() external returns (uint256 requestId);
	function getRandomness(uint256 requestId) external view returns (uint256);
}

contract Tokenizer is ERC20, Pausable, AccessControl {

	bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
	bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
	bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

	IVRFConsumer public	vrfConsumer;

	uint256 public	lastRandomEvent;
	uint256 public	randomInterval = 1 days;

	mapping(uint256 => address)	requestIdToAddress;

	event RandomEventTriggered(uint256 requestId, address indexed trigger);
	event RandomEventResult(uint256 requestId, bool isMinted, uint256 amount);
	event Received(address sender, uint256 amount);
	event FallbackCalled(address sender, uint256 amount, bytes data);

	/**
	 * @notice Fallback function to handle plain Ether transfers
	 * @dev Emits a FallbackCalled event with the sender's address, value, and data
	 */
	fallback() external payable {

		emit FallbackCalled(msg.sender, msg.value, msg.data);
	}

	/**
	 * @notice Receive function to handle plain Ether transfers
	 * @dev Emits a Received event with the sender's address and value
	 */
	receive() external payable {

		emit Received(msg.sender, msg.value);
	}

	constructor(
		uint256 initialSupply,
		address _vrfConsumer
	)
	ERC20("Fiorino42", "FI") {
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		_mint(_msgSender(), initialSupply);
		lastRandomEvent = block.timestamp;

		_grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
		_grantRole(PAUSER_ROLE, _msgSender());
	}

	function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
		_mint(to, amount);
	}

	function burn(address to, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
		_burn(to, amount);
	}

	function pause() external onlyRole(PAUSER_ROLE) {
		_pause();
	}

	function unpause() external onlyRole(PAUSER_ROLE) {
		_unpause();
	}

	function setPauser(address pauser) external onlyRole(DEFAULT_ADMIN_ROLE) {
		_grantRole(PAUSER_ROLE, pauser);
	}

	/**
	 * @notice Triggers a random event if the required time interval has passed since the last event.
	 * @dev Requests random words from the VRF consumer and stores the request ID with the caller's address.
	 * @return requestId The ID of the random words request.
	 */
	function triggerRandomEvent() external whenNotPaused returns(uint256 requestId) {
		require(block.timestamp >= lastRandomEvent + randomInterval, "Too soon for a random event");

		requestId = vrfConsumer.requestRandomness();
		requestIdToAddress[requestId] = msg.sender;
		lastRandomEvent = block.timestamp;

		emit RandomEventTriggered(requestId, msg.sender);
	}

	/**
	 * @notice Handles the randomness response from the VRF consumer
	 * @dev Mints or burns tokens based on the randomness result
	 * @param requestId The ID of the randomness request
	 */
	function handleRandomness(uint256 requestId) external whenNotPaused {
		require(msg.sender == requestIdToAddress[requestId], "Caller is not the requester");
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		require(randomness != 0, "Randomness not available");

		address	requester = requestIdToAddress[requestId];
		bool	shouldMint = (randomness % 2) == 0;
		uint256	percentage = (randomness % 5) + 1;
		uint256	amount = (totalSupply() * percentage) / 100;

		if (shouldMint) {
			_mint(requester, amount);
		} else {
			amount = balanceOf(requester) < amount ? balanceOf(requester) : amount;
			_burn(requester, amount);
		}

		emit RandomEventResult(requestId, shouldMint, amount);
		delete requestIdToAddress[requestId];
	}
}