// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVRFConsumer {
	function requestRandomness() external returns (uint256 requestId);
	function getRandomness(uint256 requestId) external view returns (uint256);
}

contract Tokenizer is ERC20, Ownable
{
	// Chainlink VRF 
	IVRFConsumer public	vrfConsumer;

	// Time control
	uint256 public	lastRandomEvent;
	uint256 public	randomInterval = 1 days;

	// Mapping which address triggered which request
	mapping(uint256 => address)	requestIdToAddress;

	// Events
	event RandomEventTriggered(uint256 requestId, address indexed trigger);
	event RandomEventResult(uint256 requestId, bool isMinted, uint256 amount);
	event Received(address sender, uint256 amount);
	event FallbackCalled(address sender, uint256 amount, bytes data);

	// Fallback function to handle plain Ether transfers
	fallback() external payable
	{

		emit FallbackCalled(msg.sender, msg.value, msg.data);
	}

	// Receive function to handle plain Ether transfers
	receive() external payable
	{

		emit Received(msg.sender, msg.value);
	}

	constructor(
		uint256 initialSupply,
		address _vrfConsumer
	)
	ERC20("Tokenizer", "TOK")
	{
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		_mint(_msgSender(), initialSupply);
		lastRandomEvent = block.timestamp;
	}

	function mint(address to, uint256 amount) external onlyOwner
	{
		_mint(to, amount);
	}

	/**
	 * @notice Triggers a random event if the required time interval has passed since the last event.
	 * @dev Requests random words from the VRF consumer and stores the request ID with the caller's address.
	 * @return requestId The ID of the random words request.
	 */
	function triggerRandomEvent() external returns(uint256 requestId)
	{
		require(block.timestamp >= lastRandomEvent + randomInterval, "Too soon for a random event");
		requestId = vrfConsumer.requestRandomness();
		requestIdToAddress[requestId] = msg.sender;
		lastRandomEvent = block.timestamp;
		emit RandomEventTriggered(requestId, msg.sender);
	}

	function handleRandomness(uint256 requestId) external
	{
		// require(msg.sender == requestIdToAddress[requestId], "Caller is not the requester");
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		require(randomness != 0, "Randomness not available");

		address	requester = requestIdToAddress[requestId];
		bool	shouldMint = (randomness % 2) == 0;
		uint256	percentage = (randomness % 5) + 1;
		uint256	amount = (totalSupply() * percentage) / 100;

		if (shouldMint)
		{
			_mint(requester, amount);
		}
		else
		{
			amount = balanceOf(requester) < amount ? balanceOf(requester) : amount;
			_burn(requester, amount);
		}

		emit RandomEventResult(requestId, shouldMint, amount);
		delete requestIdToAddress[requestId];
	}

}